/**
 * Runs the same meal photos through Gemini and Claude, using the app's own
 * instructions, and writes a side-by-side report so you can judge which
 * model reads your food best and what it would cost.
 *
 *   npm run compare                      # every model, asks before spending
 *   npm run compare -- --models gemini,sonnet --limit 10
 *   npm run compare -- --effort medium --yes
 *
 * Put photos in compare/photos/ (JPEG, PNG, or iPhone HEIC) and, optionally,
 * what you actually ate in compare/notes.txt, one line per photo:
 *
 *   IMG_1234: 3 egg omelette, 2 slices toast | 26
 *
 * The part after "|" is the protein you believe is right; when present the
 * report scores each model against it. Keys are file names without extension.
 *
 * Keys come from .env.local: GEMINI_API_KEY, and ANTHROPIC_API_KEY (or an
 * `ant auth login` profile) for Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { interpretPhoto, PHOTO_SCHEMA, photoInstructions, type RawPhoto } from "../src/lib/meal-prompt";
import { callGemini, DEFAULT_GEMINI_MODEL } from "../src/lib/providers/gemini";
import type { Analysis } from "../src/lib/types";

const ROOT = "compare";
const PHOTOS = join(ROOT, "photos");
const PREPARED = join(ROOT, ".prepared");
const NOTES = join(ROOT, "notes.txt");
const PHOTO_TYPES = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]);
const MAX_EDGE = 1024;
const MONTHLY_VOLUMES = [100, 150];

type Effort = "low" | "medium" | "high";

type ModelSpec = {
  label: string;
  provider: "gemini" | "claude";
  id: string;
  /** USD per million tokens. */
  price: { input: number; output: number };
  /** Rough output tokens per photo, for the up-front estimate only. */
  typicalOutput: number;
  free?: boolean;
  /** Haiku 4.5 rejects the effort setting. */
  supportsEffort?: boolean;
};

const MODELS: Record<string, ModelSpec> = {
  gemini: {
    label: "Gemini Flash (free tier)",
    provider: "gemini",
    id: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    price: { input: 0.3, output: 2.5 },
    typicalOutput: 700,
    free: true,
  },
  haiku: { label: "Claude Haiku 4.5", provider: "claude", id: "claude-haiku-4-5", price: { input: 1, output: 5 }, typicalOutput: 700 },
  sonnet: {
    label: "Claude Sonnet 5.5",
    provider: "claude",
    id: "claude-sonnet-5-5",
    price: { input: 2, output: 10 },
    typicalOutput: 1200,
    supportsEffort: true,
  },
  opus: {
    label: "Claude Opus 5.5",
    provider: "claude",
    id: "claude-opus-5-5",
    price: { input: 4, output: 20 },
    typicalOutput: 1200,
    supportsEffort: true,
  },
};

const TYPICAL_INPUT_TOKENS = 1800;

type Usage = { inputTokens: number; outputTokens: number };

type Outcome =
  | { ok: true; analysis: Analysis; usage: Usage; cost: number; ms: number }
  | { ok: false; error: string; ms: number; cost: number };

type PhotoRun = { key: string; file: string; note?: string; protein?: number; outcomes: Record<string, Outcome> };

/* Setup */

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && match[2] && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv: string[]) {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const models = (value("--models") ?? Object.keys(MODELS).join(",")).split(",").map((name) => name.trim());
  const unknown = models.filter((name) => !MODELS[name]);
  if (unknown.length) throw new Error(`Unknown model(s): ${unknown.join(", ")}. Choose from ${Object.keys(MODELS).join(", ")}.`);
  const effort = (value("--effort") ?? "low") as Effort;
  if (!["low", "medium", "high"].includes(effort)) throw new Error("--effort must be low, medium or high");
  const limit = value("--limit") ? Number(value("--limit")) : Infinity;
  return { models, effort, limit, yes: argv.includes("--yes") };
}

function readNotes(): Map<string, { note: string; protein?: number }> {
  const notes = new Map<string, { note: string; protein?: number }>();
  if (!existsSync(NOTES)) return notes;
  for (const line of readFileSync(NOTES, "utf8").split("\n")) {
    const match = line.match(/^\s*([^:#]+?)\s*:\s*(.+)$/);
    if (!match) continue;
    const [description, protein] = match[2].split("|").map((part) => part.trim());
    const grams = protein ? Number(protein.replace(/[^\d.]/g, "")) : NaN;
    notes.set(match[1].replace(/\.[a-z]+$/i, "").toLowerCase(), {
      note: description,
      protein: Number.isFinite(grams) ? grams : undefined,
    });
  }
  return notes;
}

/** The same size and format the app sends: JPEG, longest edge 1024 px. Uses macOS `sips`, which also reads HEIC. */
function preparePhoto(file: string): string {
  const source = join(PHOTOS, file);
  const target = join(PREPARED, `${basename(file, extname(file))}.jpg`);
  if (existsSync(target)) return target;
  if (process.platform !== "darwin") {
    if (![".jpg", ".jpeg"].includes(extname(file).toLowerCase())) {
      throw new Error(`${file}: convert to JPEG first (automatic conversion needs macOS)`);
    }
    return source;
  }
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", String(MAX_EDGE), source, "--out", target], {
    stdio: "ignore",
  });
  return target;
}

/* Calls */

const costOf = (spec: ModelSpec, usage: Usage) =>
  (usage.inputTokens * spec.price.input + usage.outputTokens * spec.price.output) / 1_000_000;

async function askGemini(spec: ModelSpec, image: string): Promise<{ raw: RawPhoto; usage: Usage }> {
  const { data, usage } = await callGemini<RawPhoto>(
    [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: photoInstructions({}) }],
    PHOTO_SCHEMA,
    { apiKey: process.env.GEMINI_API_KEY, model: spec.id },
  );
  return { raw: data, usage };
}

async function askClaude(client: Anthropic, spec: ModelSpec, image: string, effort: Effort) {
  const response = await client.messages.create({
    model: spec.id,
    max_tokens: 8000,
    output_config: {
      ...(spec.supportsEffort ? { effort } : {}),
      format: { type: "json_schema", schema: PHOTO_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: photoInstructions({}) },
        ],
      },
    ],
  });

  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  if (response.stop_reason === "refusal") {
    throw Object.assign(new Error(`declined (${response.stop_details?.category ?? "no category"})`), { usage });
  }
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("ran out of output tokens"), { usage });
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw Object.assign(new Error("no answer"), { usage });
  return { raw: JSON.parse(text.text) as RawPhoto, usage };
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "Claude rejected the API key";
  if (error instanceof Anthropic.RateLimitError) return "Claude rate limit; try again shortly";
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

async function runModel(name: string, image: string, client: Anthropic | null, effort: Effort): Promise<Outcome> {
  const spec = MODELS[name];
  const started = Date.now();
  try {
    const { raw, usage } =
      spec.provider === "gemini" ? await askGemini(spec, image) : await askClaude(client!, spec, image, effort);
    const cost = spec.free ? 0 : costOf(spec, usage);
    try {
      return { ok: true, analysis: interpretPhoto(raw, {}), usage, cost, ms: Date.now() - started };
    } catch (error) {
      return { ok: false, error: describeError(error), cost, ms: Date.now() - started };
    }
  } catch (error) {
    const usage = (error as { usage?: Usage }).usage;
    const cost = usage && !spec.free ? costOf(spec, usage) : 0;
    return { ok: false, error: describeError(error), cost, ms: Date.now() - started };
  }
}

/* Report */

const proteinOf = (analysis: Analysis) =>
  analysis.kind === "label"
    ? analysis.label.perServing.protein
    : analysis.items.reduce((sum, item) => sum + item.macros.protein, 0);

const kcalOf = (analysis: Analysis) =>
  analysis.kind === "label" ? analysis.label.perServing.kcal : analysis.items.reduce((sum, item) => sum + item.macros.kcal, 0);

const usd = (value: number) => (value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`);
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const fmt = (value: number) => (Math.round(value * 10) / 10).toString();

function summarise(runs: PhotoRun[], models: string[]) {
  return models.map((name) => {
    const outcomes = runs.map((run) => ({ run, outcome: run.outcomes[name] }));
    const ok = outcomes.filter(({ outcome }) => outcome.ok);
    const scored = ok.filter(({ run }) => run.protein !== undefined);
    const errors = scored.map(({ run, outcome }) =>
      Math.abs(proteinOf((outcome as Extract<Outcome, { ok: true }>).analysis) - run.protein!),
    );
    const spend = outcomes.reduce((sum, { outcome }) => sum + outcome.cost, 0);
    const paidCostPerPhoto = ok.length
      ? ok.reduce((sum, { outcome }) => sum + costOf(MODELS[name], (outcome as Extract<Outcome, { ok: true }>).usage), 0) / ok.length
      : 0;
    return {
      name,
      label: MODELS[name].label,
      read: ok.length,
      total: outcomes.length,
      meanError: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
      within5: errors.length ? errors.filter((value) => value <= 5).length / errors.length : null,
      avgMs: outcomes.reduce((sum, { outcome }) => sum + outcome.ms, 0) / Math.max(1, outcomes.length),
      spend,
      perPhoto: paidCostPerPhoto,
      free: Boolean(MODELS[name].free),
    };
  });
}

function outcomeHtml(outcome: Outcome): string {
  if (!outcome.ok) return `<p class="error">${escapeHtml(outcome.error)}</p>`;
  const { analysis } = outcome;
  if (analysis.kind === "label") {
    const { label } = analysis;
    return `<p class="kind">label · per ${escapeHtml(label.servingLabel)} (${fmt(label.servingSize)} ${label.servingUnit})</p>
      <p class="total"><b>${fmt(label.perServing.protein)} g</b> protein · ${fmt(label.perServing.kcal)} kcal</p>`;
  }
  const items = analysis.items
    .map(
      (item) =>
        `<li${item.uncertain ? ' class="unsure"' : ""}><span>${fmt(item.quantity)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}${item.uncertain ? " ?" : ""}</span><span>${fmt(item.macros.protein)} g</span></li>`,
    )
    .join("");
  return `<p class="kind">${escapeHtml(analysis.name)}</p><ul>${items}</ul>
    <p class="total"><b>${fmt(proteinOf(analysis))} g</b> protein · ${Math.round(kcalOf(analysis))} kcal</p>`;
}

function reportHtml(runs: PhotoRun[], models: string[], effort: Effort, stamp: string): string {
  const summary = summarise(runs, models);
  const summaryRows = summary
    .map(
      (row) => `<tr><th>${escapeHtml(row.label)}</th><td>${row.read}/${row.total}</td>
        <td>${row.meanError === null ? "–" : `${fmt(row.meanError)} g`}</td>
        <td>${row.within5 === null ? "–" : `${Math.round(row.within5 * 100)}%`}</td>
        <td>${(row.avgMs / 1000).toFixed(1)} s</td>
        <td>${row.free ? "$0 (free tier)" : usd(row.spend)}</td>
        <td>${row.read === 0 ? "–" : row.free ? `$0 · ${usd(row.perPhoto)} if paid` : usd(row.perPhoto)}</td>
        ${MONTHLY_VOLUMES.map((volume) => `<td>${row.free ? "$0" : row.read === 0 ? "–" : usd(row.perPhoto * volume)}</td>`).join("")}</tr>`,
    )
    .join("");

  const photoSections = runs
    .map(
      (run) => `<section class="photo">
        <div class="meta"><img src=".prepared/${escapeHtml(basename(run.file, extname(run.file)))}.jpg" alt="">
          <p class="name">${escapeHtml(run.file)}</p>
          <p>${run.note ? escapeHtml(run.note) : '<span class="muted">no note</span>'}</p>
          ${run.protein !== undefined ? `<p class="truth">you said <b>${fmt(run.protein)} g</b> protein</p>` : ""}</div>
        ${models.map((name) => `<div class="model"><h3>${escapeHtml(MODELS[name].label)}</h3>${outcomeHtml(run.outcomes[name])}</div>`).join("")}
      </section>`,
    )
    .join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model comparison · ${stamp}</title>
<style>
:root{color-scheme:dark;--ground:#0d1117;--panel:#151a21;--seam:#262c36;--text:#e6edf3;--muted:#8b949e;--protein:#79c0ff;--warn:#e3b341;--danger:#f85149}
*{box-sizing:border-box}body{margin:0;padding:24px 16px 48px;background:var(--ground);color:var(--text);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
main{max-width:1200px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 4px}h2{font-size:1rem;margin:32px 0 10px}.muted{color:var(--muted)}
.table-wrap{overflow-x:auto;border:1px solid var(--seam);border-radius:10px}table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{padding:9px 12px;border-bottom:1px solid var(--seam);text-align:right;white-space:nowrap}th:first-child{text-align:left}thead th{color:var(--muted);font-weight:500}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
.photo{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1px;margin-bottom:16px;border:1px solid var(--seam);border-radius:10px;overflow:hidden;background:var(--seam)}
.photo>div{padding:12px;background:var(--panel);min-width:0}.meta img{width:100%;border-radius:6px;display:block}.name{color:var(--muted);font-size:.8rem;margin:8px 0 2px}
.meta p{margin:4px 0}.truth b,.total b{color:var(--protein)}h3{margin:0 0 6px;font-size:.85rem;color:var(--muted);font-weight:500}
.kind{margin:0 0 6px;font-weight:600}ul{list-style:none;margin:0;padding:0;font-size:.85rem}li{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--seam)}
li.unsure span:first-child{color:var(--warn)}.total{margin:8px 0 0;font-size:.85rem}.error{color:var(--danger);font-size:.85rem}
</style></head><body><main>
<h1>Meal photo model comparison</h1>
<p class="muted">${stamp} · ${runs.length} photos · Claude effort “${effort}” · same instructions the app sends, no hints · amber items are ones the model marked unsure</p>
<h2>Summary</h2>
<div class="table-wrap"><table><thead><tr><th>Model</th><th>Read</th><th>Avg protein error</th><th>Within 5 g</th><th>Avg time</th><th>This run</th><th>Per photo</th>${MONTHLY_VOLUMES.map((volume) => `<th>${volume} photos/mo</th>`).join("")}</tr></thead>
<tbody>${summaryRows}</tbody></table></div>
<p class="muted">Protein error is only scored for photos where notes.txt gives a protein figure. Costs come from each response's real token counts at list prices; Gemini's "if paid" uses Flash list prices.</p>
<h2>Photos</h2>${photoSections}
</main></body></html>`;
}

/* Main */

async function main() {
  loadEnvFile(".env.local");
  const { models, effort, limit, yes } = parseArgs(process.argv.slice(2));

  if (!existsSync(PHOTOS)) {
    mkdirSync(PHOTOS, { recursive: true });
    console.log(`Created ${PHOTOS}/. Put your meal photos there (and notes in ${NOTES}), then run this again.`);
    return;
  }
  const files = readdirSync(PHOTOS)
    .filter((file) => PHOTO_TYPES.has(extname(file).toLowerCase()))
    .sort()
    .slice(0, limit);
  if (files.length === 0) {
    console.log(`No photos in ${PHOTOS}/ yet.`);
    return;
  }

  const missing = [
    models.some((name) => MODELS[name].provider === "gemini") && !process.env.GEMINI_API_KEY && "GEMINI_API_KEY",
    models.some((name) => MODELS[name].provider === "claude") &&
      !process.env.ANTHROPIC_API_KEY &&
      !process.env.ANTHROPIC_AUTH_TOKEN &&
      "ANTHROPIC_API_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.log(`Missing ${missing.join(" and ")} in .env.local. Add ${missing.length > 1 ? "them" : "it"}, or leave those models out with --models (e.g. --models gemini).`);
    process.exitCode = 1;
    return;
  }

  const paid = models.filter((name) => !MODELS[name].free);
  const estimate = paid.reduce(
    (sum, name) =>
      sum + files.length * costOf(MODELS[name], { inputTokens: TYPICAL_INPUT_TOKENS, outputTokens: MODELS[name].typicalOutput }),
    0,
  );
  console.log(`${files.length} photos × ${models.map((name) => MODELS[name].label).join(", ")}`);
  if (paid.length) {
    console.log(`Estimated Claude spend: about ${usd(estimate)} (effort "${effort}"). Gemini free tier: $0.`);
    if (!yes) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await prompt.question("Go ahead? [y/N] ");
      prompt.close();
      if (!/^y(es)?$/i.test(answer.trim())) return console.log("Stopped; nothing was spent.");
    }
  }

  mkdirSync(PREPARED, { recursive: true });
  const notes = readNotes();
  const client = paid.length ? new Anthropic() : null;
  const runs: PhotoRun[] = [];

  for (const [index, file] of files.entries()) {
    const key = basename(file, extname(file)).toLowerCase();
    const image = readFileSync(preparePhoto(file)).toString("base64");
    const entries = await Promise.all(models.map(async (name) => [name, await runModel(name, image, client, effort)] as const));
    const run: PhotoRun = { key, file, ...notes.get(key), outcomes: Object.fromEntries(entries) };
    runs.push(run);
    const line = entries
      .map(([name, outcome]) => `${name} ${outcome.ok ? `${fmt(proteinOf(outcome.analysis))} g` : "failed"}`)
      .join(" · ");
    console.log(`[${index + 1}/${files.length}] ${file}: ${line}${run.protein !== undefined ? ` (you: ${run.protein} g)` : ""}`);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const fileStamp = stamp.replace(/[ :]/g, "-");
  writeFileSync(join(ROOT, `results-${fileStamp}.json`), JSON.stringify({ stamp, effort, models, runs }, null, 2));
  const reportPath = join(ROOT, `report-${fileStamp}.html`);
  writeFileSync(reportPath, reportHtml(runs, models, effort, stamp));

  console.log("\nSummary");
  for (const row of summarise(runs, models)) {
    const accuracy = row.meanError === null ? "nothing scored" : `avg error ${fmt(row.meanError)} g`;
    const cost = row.free
      ? "free"
      : row.read === 0
        ? "no cost measured"
        : `${usd(row.perPhoto)}/photo, ~${usd(row.perPhoto * 150)} at 150 photos/month`;
    console.log(`  ${row.label}: read ${row.read}/${row.total}, ${accuracy}, ${cost}`);
  }
  console.log(`\nReport: ${reportPath}`);
}

main().catch((error) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
