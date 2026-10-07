# Mycalorie: project status and handoff

Last updated: 2026-10-08. Start here when picking the project back up.
- **PRODUCT.md:** the product decisions.
- **DESIGN.md:** the visual system.
- **This file:** what's built, how it fits together, what's pending, and how to work on it.

## What it is

A meal tracker for Indian food, used as an installed web app on the owner's iPhone, with room for a few invited people.
- **Logging:** you photograph a meal, or describe it or type it in. An AI estimates the items in Indian household measures, you correct them, and the meal counts toward daily targets for protein, calories, carbs and fat. Protein is the main number.
- **Regulars:** repeat meals log in one tap, with no AI involved.
- **Gamification:** adult-style, with a day score, a protein streak with a 12-week graph, and milestones.
- **AI:** for the owner, Claude Sonnet 5.5 reads meals first, with free Gemini as the automatic fallback and a one-tap second opinion. Everyone else uses Gemini.

**Live:** deployed on Vercel behind per-person access codes.
- The address is kept out of the repo.
- Vercel project `mycalorie-app`, functions in `iad1`.
- A free Redis database is connected through Vercel's Storage integration (it sets `REDIS_URL`).

**Repo:** https://github.com/sankhadeeproy007/mycalorie-app.
- Public, so commits use the GitHub noreply email set in this repo's git config.
- The live URL, personal targets and any keys stay out of the repo.
- Pushing to `main` deploys on Vercel automatically.

**Constraints:**
- Free tiers for everything except Claude. Claude is the owner's only spend: $2–3 a month at most, used only for new meals.
- Each person's data is separate. Claude and the model comparison are owner-only.
- Mature look: the owner rejected a cartoonish design.

## Owner context and preferences

- **Food:** lives in India and eats mostly Indian food. Dishes, portions (katori, roti count, ladle) and nutrition follow Indian conventions (IFCT 2017), with en-IN number grouping.
- **Daily targets:** all four are set in the app and add up at 4/4/9. The numbers are kept out of the repo.
- **Look:** the "Console" design was picked from 5 mockups, after the hand-drawn "Prep Shelf" look was rejected as childish. No mascots, confetti or guilt cues.
- **Mockups first:** show options before big visual changes.
- **Gamification:** streaks, day score and milestones are wanted. Levels/XP were not chosen.
- **Eggs:** eats only egg whites (2026-10-07). Whole eggs in a photo or description count as whites unless the yolk is mentioned.
- **AI:** prefers Claude Sonnet's answers to Gemini's (2026-10-05), so Sonnet is the default reader for the owner. Opus was judged too expensive for the budget.
- **Developer-only controls** live in the hidden developer panel (5 taps on the date): demo data, the Claude switch, and CSV export.

## Stack

- **Framework:**
  - Next.js 16.3 (App Router, TypeScript, CSS modules) and React 19.
  - Next 16 renames middleware to **`src/proxy.ts`**.
  - Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).
- **UI:** Geist and Geist Mono via `next/font`; icons from `lucide-react`.
- **AI:**
  - **Claude Sonnet 5.5** (`claude-sonnet-5-5`) via the official `@anthropic-ai/sdk`.
  - **Gemini** (`gemini-flash-latest` by default, `GEMINI_MODEL` to override) via REST with a JSON response schema.
  - Both use the same prompts and schemas (`src/lib/meal-prompt.ts`).
- **Data:**
  - Browser storage (`localStorage`) is the working copy, mirrored to **Redis** through `/api/data`.
  - Redis is reached via `REDIS_URL` with the `redis` package, or Upstash REST if the `KV_REST_API_*` variables are set.
  - Comparison photos stay in IndexedDB on the phone.
- **Dev:** `tsx` runs the comparison script. The local test harness lives in `.local-test/` (git-ignored); see "Working on it".

## Environment variables

Set these on Vercel (Project → Settings → Environment Variables) and in `.env.local` for local work. **Redeploy after changing any of them.**

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key, free tier. Never enable billing, or the free allowance ends. |
| `GEMINI_MODEL` | Optional Gemini model override. |
| `ANTHROPIC_API_KEY` | Claude for the owner (Production). Needs **API credit** from platform.claude.com → Billing; claude.ai plan credit doesn't apply. Without credit, Claude fails and Gemini answers. |
| `CLAUDE_EFFORT` | Optional: `low` (default), `medium` or `high`. |
| `ACCESS_CODE` | The owner's code, 4–8 digits. |
| `ACCESS_CODES` | Other people: `name:code,name:code`, with lower-case names and codes the same length as `ACCESS_CODE`. Malformed entries are skipped with a log warning. |
| `SESSION_SECRET` | Random string that signs session cookies (`openssl rand -hex 32`). |
| `REDIS_URL` | Cloud sync over a direct Redis connection; set by Vercel's Redis integration. This is what production uses. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Alternative: Upstash's REST API (`UPSTASH_REDIS_REST_*` also works). Wins over `REDIS_URL` when set. With neither, sync is off. |
| `MOCK_GEMINI=1` | Development only: canned answers for both Gemini and Claude, so the screens work without keys. |

Production currently has `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ACCESS_CODE`, `SESSION_SECRET` and `REDIS_URL`. `ACCESS_CODES` is not set yet.

## What's built

### Home screen (`src/app/HomeScreen.tsx`)

In the Console design: graphite panels, hairline seams, mono figures. From the top:
- **Launch screen:** the 4×4 logo lights up in a wave, then fades. It's in the server HTML, so it shows instead of a blank screen.
- **Status line:** the date on the left, which reveals the developer panel after 5 taps within 2.5 s. On the right, a drawn status dot (a ring while today is open) with "18d streak", or "18d streak · hit".
- **Backup prompt:** at the top on the first open of each day, until acted on, but only while cloud sync isn't working (off, offline or failing). It offers "Back up today", or "Restore a backup?" on a fresh install with no data.
- **Protein panel:** "N g to go" (or "+N g past target"), a bar, and kcal/carbs/fat rows. The sliders icon opens the **targets sheet**: protein (required), calories, carbs and fat, with "Use N kcal" suggested from 4/4/9.
- **Day score panel:** "N so far", 7 past days plus today (outlined) on one 0–100 scale, and the 7-day average as a dashed line.
- **Streak panel:** a 12-week graph in a protein-blue ramp, with a legend (none / under / hit).
  - Tapping it opens the nearest day in the **day sheet**: totals against targets, the score, and that day's meals with their items, with ‹ › to step between days.
  - Tapping a meal there opens **Edit meal**; closing it returns to the day.
  - **+ Add a meal to this day** opens the log sheet titled "Add to <day>" (`addToDay` in HomeScreen). Photo, Describe, a regular, or adjust all land on that day, preset to the current clock time on that date (`timeOnDay` in `day.ts`). Afterwards the day sheet reopens.
- **Regulars:** photo tiles, and the panel folds from its header.
  - A tap logs 1×.
  - The "1×" tab opens the portion picker (½, 1, 1½, 2), plus a pencil (**edit regular**) and sliders (**adjust before logging**).
  - **Edit regular:** rename, change items, Save changes, or Remove from regulars with undo (undo also relinks past logs). A product is edited as its per-serving label values, and `per100` is rescaled to match.
- **Today:** the meal list, with save-to-regulars and remove (with undo).
  - Tapping a meal opens **Edit meal**: its items as eaten (or its totals, for a meal typed as numbers), Save changes, and Delete meal (with undo). Time, day and portion stay as logged.
  - Saving also updates that meal's kept comparison sample.
- **Model comparison panel (owner only):** the "Keep meal photos for comparison" switch, a count, Export (JSON) and Clear.
- **Sync & backup panel:** starts folded to its status line while sync is on.
  - Opened, it shows the sync state (synced / syncing / offline / sync failed), the last sync time, and the last backup file.
  - Without sync it's titled "backup". Back up now and Restore are always there.
- **Developer panel (hidden):**
  - "Demo data" switch and "Reset demo data".
  - **"Eggs are whites only"** (per person; on by default for the owner, off for others).
  - The owner's **"Read meals with Claude Sonnet"** switch.
  - **Export your data:** Meals CSV and Daily totals CSV.
  - "hide".
- **Dock:** "Log a meal" and "Type".
  - With regulars saved, "Log a meal" opens the **log sheet** (`LogSheet.tsx`): Photo and Describe, then the regulars in shelf order (time of day first). A tap logs 1×, sliders opens "adjust before logging", and a filter appears past 8 regulars.
  - With no regulars it opens the camera directly.

### Meal sheet (`src/components/meal/`)

Stages: compose → reading → review, or label.
- **Compose:**
  - Photo, optional hint, and the **Outside food** switch.
  - With Type, a description field instead, plus "Enter numbers instead".
- **Reading with the preferred AI:**
  - For the owner, Claude Sonnet first (`settings.readWith`, default `claude`). If it fails, Gemini is asked automatically.
  - Descriptions follow the same rule (`estimateDescription` in `meal-api.ts`).
  - Everyone else uses Gemini.
- **Claude | Gemini switch** (`ModelToggle.tsx`, owner only): under the sheet header, preferred AI first.
  - "Try Gemini free" / "Try Claude ~2¢" asks the other AI about the same photo.
  - Each answer is its own review with its own edits, and flipping keeps them.
  - The Claude side shows the actual cost (e.g. "1.9¢").
  - A failed side shows "Retry …" and the reason, e.g. "API credit may be used up".
- **When field** (`WhenField.tsx`): "Eaten · Today · 13:30" at the top of every review except edit regular. The row is an invisible native `datetime-local` input, so tapping opens the iOS picker. Times after the sheet opened clamp to now.
  - New meals log at that time (`LogEntry.eatenAt` → `logMeal({ eatenAt })`).
  - Editing a meal can move it: `updateLog` recomputes `day` from a new `eatenAt`.
  - The toast names the day when it isn't today ("logged Poha to Mon 5 Oct +9 g").
  - Today's list is sorted by time eaten.
- **Review:**
  - **Items:** a − value unit + stepper per item (½ steps, ½ tsp for oil and ghee, 25 g by weight, a g/ml toggle where weight is known). Items the AI is unsure of are marked **check** and shown first. Items can be removed.
  - **Item numbers** (`ItemRow.tsx`): each item shows "protein g · kcal ✎". Tapping it edits all four numbers for the amount shown. This sets the item's base to the corrected values, so later quantity changes scale from them.
  - **+ add:** regulars and products, or a described extra (an AI estimate).
  - **Matched regular:** a "Log that instead" banner.
  - **Totals:** live, with "Edit totals" to type over them.
  - **Save to regulars:** keeps all the items and a small photo.
- **Label:** a nutrition-label photo is read exactly: product name, values per serving and per 100 g, and a servings stepper. It's saved as a **product** (a regular with `product` info), usable as an ingredient.
- **Other modes** reuse the same review:
  - adjust before logging (a one-off change to a regular);
  - edit regular;
  - edit meal.

### AI (`src/lib/`)

- **Shared:** `meal-prompt.ts` holds the instructions, JSON schemas, and clean-up for both models.
  - **Photo answers** are `meal`, `label` or `not_food`.
  - **Item rules:** Indian dish names and household units; grams per item with a liquid flag; oil/ghee as its own tsp item; `uncertain` for hidden quantities.
  - **Bones:** for bone-in meat and fish, only the edible meat counts (leg/thigh ~30% bone, drumstick ~35%, mutton piece ~30%, fish ~40%), and the cut is named.
  - **Regulars:** the person's regulars are sent along so a photo can match one.
  - **Egg whites:** with `eggWhitesOnly` (from `settings.eggs`; `eggWhitesOnly()` in `meal-api.ts`), photos and descriptions get an extra rule. Separable-yolk eggs (boiled, fried, poached) count as "Egg whites", about 3.6 g protein and 17 kcal each, unless the yolk is mentioned. For photos, beaten-in dishes go by colour; for descriptions, they count whole unless "whites" is said. Kept comparison samples record the flag, and the compare script replays it.
- **Claude:** `providers/claude.ts`.
  - Sonnet 5.5, effort `low`, structured output (`output_config.format`).
  - Server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
  - Reports cost from usage at $2/$10 per million input/output tokens.
  - Out of API credit becomes the "quota" error.
- **Gemini:** `providers/gemini.ts`, REST with `toGeminiSchema`.
- **Routes:** `/api/analyze` (photo, body `model`) and `/api/estimate` (description, body `model`).
  - Both return 403 for Claude unless the caller is the owner (`mayUseClaude` in `session.ts`).
  - Errors map to `not_configured`, `quota`, `unreadable` and `upstream`, each with a short `detail` shown in the UI.

### People and access (`src/lib/access.ts`, `session.ts`, `current-user.ts`, `users.ts`)

- **Codes:** the owner signs in with `ACCESS_CODE`; others come from `ACCESS_CODES`.
- **Gating:** `src/proxy.ts` gates everything except `/unlock`, `/api/unlock` and the icons/manifest.
- **Unlock** (`/api/unlock`):
  - finds whose code it is (comparing every code timing-safely);
  - sets a 180-day cookie `<user>.<HMAC of user and code>`;
  - waits 700 ms after a wrong code, and locks out after 5 failures for 15 minutes (in memory, so best-effort on serverless).
  - The owner's older cookies (an HMAC of the code alone) are still accepted.
- **Defaults:** with no code set the app is open in development and closed in production.
- **Per-person storage:** the home page reads the session per request and passes the user to `HomeScreen`, which calls `setCurrentUser` before anything reads storage.
  - The owner keeps the original keys: `mycalorie:v1`, `mycalorie:sync` and `mycalorie:backup` in the browser; `mycalorie:state`, `mycalorie:rev` and `mycalorie:snapshot:*` in Redis.
  - Others get `…:<user>` in the browser and `mycalorie:u:<user>:…` in Redis.
  - Demo data and device preferences (folded panels, developer flag) are shared per device.

### Cloud sync (`src/lib/sync.ts`, `src/app/api/data/route.ts`, `src/lib/cloud-store.ts`)

- **Redis contents:** `…state` (`{ state, updatedAt }`), `…rev`, and `…snapshot:YYYY-MM-DD` (that day's last state, kept 30 days as a way back from a bad overwrite).
- **`/api/data`:**
  - GET; `?have=<rev>` skips sending the state when it's unchanged.
  - PUT `{ state, baseRev, day }`. A Lua script saves only if the cloud is still at `baseRev`; otherwise it returns 409 with the current copy.
  - The route checks the session itself as well as relying on the proxy.
- **On the phone:**
  - `…sync` holds `rev`, `dirty`, `replace` and `syncedAt`.
  - It syncs on open, 1.2 s after each change (`onRealDataChange` in `store.ts`), on returning to the front, and on coming back online.
- **Resolving differences:**
  - A phone with no unsent changes takes a newer cloud copy.
  - A phone with unsent changes merges meals and regulars by id (its own version wins) and sends the result.
  - **Settings:** carry `changedAt`, stamped by every settings setter, and the newer settings win. Between two unstamped copies, a set of targets beats none. This fixed a bug where a second copy with no targets, such as a Safari tab, blanked targets everywhere.
  - A backup restore is sent as is, replacing the cloud copy.
  - Known gap: a meal deleted on one device while another was offline with changes can come back.
- **Connection:** `REDIS_URL` uses one connection per warm function instance, with a 6 s command timeout.
- **Not synced:** demo data and comparison photos.

### Backups and export

- **Backup file** (`src/lib/backup.ts`, `src/components/Backup.tsx`): `mycalorie-backup-YYYY-MM-DD.json` = `{ app: "mycalorie", version: 1, exportedAt, data: AppState }`.
  - Real data only: regular photos are included, comparison photos aren't.
  - Shared through the share sheet (`src/lib/share-file.ts`).
  - Restore validates the file (`app-state-check.ts`), shows its date and counts, and replaces everything after a confirm.
  - Status lives in `…backup` (`lastAt`, `dismissedDay`).
- **CSV export** (`src/lib/export-csv.ts`, developer panel). Both files have a UTF-8 BOM so Excel reads ½ correctly, and both go through the share sheet. The panel exports what's on screen, so demo data while demo is on.
  - `mycalorie-meals-<day>.csv`: date, time, meal, portion, macros, items.
  - `mycalorie-daily-<day>.csv`: per-day totals, meal count, today's targets, score.

### Model comparison

- **In the app (owner only):** with "Keep meal photos for comparison" on, each logged photo is kept with:
  - its hint and the Outside setting;
  - Gemini's first answer (`estimate`) and Claude's (`claudeEstimate`), when asked;
  - which answer was logged (`chosen`);
  - what was finally logged.

  Editing the logged meal updates the kept copy. Export shares one JSON file. Demo meals are never kept, and undoing a log drops its photo.
- **On the Mac:** `npm run compare -- --from <export.json>` re-sends each photo to Gemini Flash and Claude Haiku 4.5, Sonnet 5.5 and Opus 5.5 (effort `low` by default) and scores each against what was logged. It writes `compare/report-*.html` and asks before spending. `compare/` is git-ignored.

### Phone polish

- **No zoom:** fields are ≥16px, so iOS doesn't zoom on focus.
- **Keyboard:** `ViewportSync` publishes `--keyboard-inset` and `--visual-height`, so sheets sit above the keyboard. Return keys go next / done / go.
- **Status bar:** installed, the top keeps at least 54px clear (`--top-inset`).
  - Installed mode is detected by the `display-mode: standalone` media query and by `data-standalone` (from `navigator.standalone`).
  - A solid strip (`body::before`) sits behind the status bar.
- **Sheets:** while one is open, the page behind it is frozen (`src/lib/scroll-lock.ts`). `Sheet`'s `onClose` fires only when the person dismisses it (Escape, backdrop, Close), not when the app closes it to hand over to another sheet. Before this, handing from the log sheet to the describe sheet cancelled the hand-over.
- **Folding:** panels fold with `Panel`'s `collapsible` prop; the state is stored by `useFolded` (`src/lib/use-folded.ts`).
- **Install:** PWA manifest and generated icons (`icon.tsx`, `apple-icon.tsx`).

## Data model (`src/lib/types.ts`)

- **`AppState`:** `{ settings, saved: SavedMeal[], logs: MealLog[] }`.
- **`Settings`:** `targets` (each `number | null`), plus optional `keepForComparison`, `readWith` (`"claude" | "gemini"`), `eggs` (`"whites" | "whole"`) and `changedAt`.
- **`MealItem`:**
  - `quantity`, `unit`, `baseQuantity`, `baseMacros`;
  - optional `gramsPerUnit`, `weightUnit`, `uncertain`, `cookingFat` and `sourceId`.
  - Macros scale linearly from the base (`src/lib/items.ts`).
- **`SavedMeal`** (a regular): `macros` for 1×, plus optional `items`, `product` and `photo` (a data URL).
- **`MealLog`:** `macros` as eaten, `portion`, `day` (local date), `eatenAt`, and optional `items` and `savedMealId`.
- **Browser keys:**
  - The data: `mycalorie:v1` (or `:<user>`).
  - Demo: `mycalorie:demo:v5`, with the demo switch in `mycalorie:demo-mode` and the developer flag in `mycalorie:developer`.
  - Folded panels: `mycalorie:regulars-collapsed` and `mycalorie:backup-collapsed`.
- **Demo data** (`src/lib/demo.ts`): 12 weeks of 3–4 Indian meals a day with items, an 18-day streak, and a best run of 26.
- **Migration:** older data is migrated in `store.ts`; for example, `proteinTarget` becomes `targets`.

## Working on it

```bash
npm install
npm run dev                      # http://localhost:3000 (add ?demo for sample data)
MOCK_GEMINI=1 npm run dev        # canned Gemini and Claude answers; hint "label" returns a sample label
npx tsc --noEmit && npm run lint && npm run build   # all three should pass before pushing
npm run compare -- --from <export.json>             # model comparison (needs keys; asks before spending)
```

- **Checking UI changes:** take Puppeteer screenshots at 390×844 @2x with `puppeteer-core` and the local Chrome.
  - Scripts live in `.local-test/` (git-ignored). Examples: `users-test.mjs` (two people), `targets-test.mjs` (settings merge), `sonnet-default.mjs` (Claude first, fallback, switch), `export-test.mjs`.
  - Puppeteer can't emulate iOS standalone mode or the real keyboard.
- **Testing sync:** run Redis in Docker (`docker run -d --rm --name mycalorie-redis -p 6390:6379 redis:7-alpine`), then start dev with `REDIS_URL=redis://localhost:6390`.
- **Testing several people:** start dev with `ACCESS_CODE`, `SESSION_SECRET` and `ACCESS_CODES` set.
- **Spend:** never call the real Claude API in tests without asking; use `MOCK_GEMINI=1`.
- **Vercel:** the Vercel plugin (MCP) can list env var names, deployments and project settings. Runtime logs returned 403 for it, and env values are never decrypted.
- **Design workflow:** the Impeccable skill (`.impeccable/`). The direction contract is in `.impeccable/surfaces/src-app-page-tsx.md`, and the design detector should report no non-advisory findings.
- **Commits:** end each message with the Claude co-author line. Push to `main` to deploy, then confirm with `gh api repos/sankhadeeproy007/mycalorie-app/deployments`.

## Not yet verified for real

- **Claude in production:** the key is set, but the Anthropic account had **no API credit**. The owner's $5 was claude.ai plan credit, which the API can't use. So no real Claude answer has come back yet, and until it does, Gemini answers.
  - Once API credit is added at platform.claude.com → Billing, the first photo is the first real test.
  - If it fails, the switch shows the reason in its "details" line.
- **Gemini:** the newer response schema, the bone-in rules, text estimates and regular matching have only been tested with the mock. A real banana photo worked. If a real call fails on the schema, look at `toGeminiSchema` in `meal-prompt.ts`.
- **Redis sync in production:** working as far as the owner has seen. After the `REDIS_URL` fix, the panel switched to "sync & backup" and the daily backup prompt went away. The settings-merge fix (2026-10-05) came after the owner noticed missing targets, so if targets are blank they need entering once more.

## Next steps

1. **Claude API credit:** the owner adds credit at platform.claude.com → Billing and sets a monthly spend limit (about $5). Then check the first Claude answer and its cost on the switch.
2. **Other people:** when ready, set `ACCESS_CODES` on Vercel and redeploy, then send each person the link and their code.
3. **Later:**
   - Store targets per day, so past days are scored against the targets in force then.
   - Change or remove a regular's photo.
   - A running total of Claude spend (offered, not built).
   - A history screen.
   - Learning from corrections.
   - iOS splash images, to cover the brief dark moment before the HTML loads.
4. **Known limitations:**
   - The unlock lockout counter lives in server memory.
   - Targets aren't kept per day, so CSV exports use today's targets.
   - Deleting the home-screen app deletes local data; sync restores it after the access code, but comparison photos are only on the phone.
