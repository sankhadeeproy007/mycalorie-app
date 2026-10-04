# Mycalorie: project status and handoff

Last updated: 2026-10-04. Start here when picking the project back up. PRODUCT.md holds the product decisions and DESIGN.md the visual system; this file covers what's built, how it fits together, what's pending, and how to work on it.

## What it is

A personal, single-user meal tracker for Indian food, used as an installed web app on the owner's iPhone. You photograph a meal, or describe it or type it in. Gemini estimates the items in Indian household measures, you correct them, and the meal counts toward daily targets for protein, calories, carbs and fat. Protein is the main number. On top of that sits adult gamification: a day score, a protein streak with a 12-week graph, and milestones. Repeat meals (regulars) log in one tap.

- **Live:** deployed on Vercel behind an access code. The address is kept out of the repo.
- **Repo:** https://github.com/sankhadeeproy007/mycalorie-app (public; commits use the GitHub noreply email set in this repo's git config, and the live URL and personal targets are kept out of the repo). Pushing to `main` deploys on Vercel automatically.
- **Hard constraints:**
  - Zero running cost: Gemini free tier, Vercel Hobby. The owner's budget is at most $2–3/month if it ever moves to a paid model.
  - Single user, no accounts.
  - Mature look: the owner rejected a cartoonish design.

## Owner context and preferences

- Lives in India and eats mostly Indian food. Dishes, portions (katori, roti count, ladle) and nutrition use Indian conventions (IFCT 2017), with en-IN number grouping.
- **Daily targets:** all four (protein, calories, carbs, fat) are set in the app and add up at 4/4/9. The numbers are kept out of the repo.
- **Look:** the "Console" design was picked from 5 mockups, after the earlier hand-drawn "Prep Shelf" look was rejected as childish. No mascots, confetti or guilt cues.
- **Mockups first:** show options before big visual changes.
- **Gamification:** streaks, day score and milestones are wanted. Levels/XP were not chosen.

## Stack

- Next.js 16.3 (App Router, TypeScript, CSS modules), React 19. Next 16 renames middleware to **`src/proxy.ts`**. Read `node_modules/next/dist/docs/` before using unfamiliar Next APIs (see AGENTS.md).
- Fonts: Geist and Geist Mono via `next/font`. Icons: `lucide-react`.
- AI: **Gemini** (`gemini-flash-latest` by default; override with `GEMINI_MODEL`) through REST with a JSON response schema.
- Data: **browser storage only** for now. App state lives in `localStorage`; comparison photos live in IndexedDB.
- Dev tools: `tsx` and `@anthropic-ai/sdk`, both used only by the comparison script.

## Environment variables

On Vercel (Project → Settings → Environment Variables; **redeploy after changing any of them**), and in `.env.local` for local work:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key, free tier. Never enable billing, or the free allowance ends. |
| `GEMINI_MODEL` | Optional model override. |
| `ACCESS_CODE` | 4–8 digits for the unlock screen. Changing it signs every device out. |
| `ACCESS_CODES` | Other people: `name:code,name:code`, codes the same length as `ACCESS_CODE`. Malformed entries are skipped with a log warning. |
| `SESSION_SECRET` | Random string that signs the session cookie (`openssl rand -hex 32`). |
| `ANTHROPIC_API_KEY` | Claude for Claude in the app (Production on Vercel), and for `npm run compare` locally. Without it the button says Claude isn't set up. |
| `CLAUDE_EFFORT` | Optional: `low` (default), `medium` or `high` for "Try Claude". |
| `REDIS_URL` | Cloud sync over a direct Redis connection; set by the Redis integration connected on Vercel (this is what production uses). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Alternative: Upstash's REST API (`UPSTASH_REDIS_REST_URL` / `_TOKEN` also work); wins over `REDIS_URL` when set. With neither, sync is off. |
| `MOCK_GEMINI=1` | Development only: canned AI answers so the screens work without a key. |

## What's built

**Home screen** (`src/app/HomeScreen.tsx`), in the Console design: graphite panels, hairline seams, mono figures.
- **Launch screen:** the 4×4 logo lights up in a wave, then fades. It's in the server HTML, so it shows instead of a blank screen.
- **Status line:** the date on the left; on the right, a drawn status dot (a ring while today is open) with "18d streak", or "18d streak · hit". Tapping the date 5 times within 2.5 s reveals the developer panel.
- **Backup prompt:** at the top on the first open of each day, until acted on: "Back up today" with Save backup / Not today. It's skipped on a day that already has a backup, never shows in demo mode, and stays away while cloud sync is working (it returns when sync is off, offline or failing). On a fresh install with no data it offers "Restore a backup?" instead.
- **Protein panel:** "N g to go" (or "+N g past target"), a bar, and kcal/carbs/fat rows showing what's left and the target. The sliders icon opens the targets sheet.
- **Day score panel:** "N so far", 7 past days plus today (outlined) on one 0–100 scale, and the 7-day average as a dashed line.
- **Streak panel:**
  - A 12-week contribution graph in a protein-blue ramp, with a legend (none / under / hit).
  - Tapping anywhere on it opens the nearest day in the **day sheet**: read-only totals against targets, the score, and meals with their items, with ‹ › to step between days. Tapping a meal opens it in **Edit meal**; closing that sheet returns to the day.
- **Regulars:** photo tiles. A tap logs 1×. The "1×" tab opens the portion picker (½, 1, 1½, 2) plus a pencil (**edit regular**) and "adjust before logging". Edit regular reopens it in the meal sheet: rename, change items, Save changes, or Remove from regulars (with undo, which also relinks past logs). A product is edited as its per-serving label values; `per100` is rescaled to match. Tapping the panel header folds it to just the header and count; the choice is remembered on the phone.
- **Reading with Claude Sonnet (owner's default):** for the owner, photos and descriptions go to Claude Sonnet 5.5 first; if Claude fails (no API credit, rate limit), Gemini answers automatically and the switch shows why Claude didn't. "Read meals with Claude Sonnet" in the developer panel (`settings.readWith`, default `claude`) puts Gemini first instead. Other people always use Gemini. Regulars never call either.
- **Gemini | Claude switch:** after a photo is read, the switch sits under the sheet header, the preferred AI first. "Try Gemini" / "Try Claude ~2¢" asks the other one about the same photo; the Claude call is Claude Sonnet 5.5 (`src/lib/providers/claude.ts`, official SDK, effort `low`, structured output, server-side refusal fallback `"default"`); its answer opens as a second review with its own edits, and the switch flips between them. The cost of each Claude answer shows on the switch. If Gemini fails, the same switch offers Claude instead. A kept comparison sample records Claude's answer (`claudeEstimate`) and which answer was logged (`chosen`). `MOCK_GEMINI=1` mocks both.
- **Item numbers:** in every meal sheet, each item shows protein · kcal with a pencil; tapping opens four fields to correct its numbers for the amount shown. That sets the item's base to the corrected values, so stepping the quantity scales from them (`ItemRow.tsx`).
- **Today:** the meal list, with save-to-regulars and remove (with undo). Tapping a meal opens **Edit meal**: the meal sheet with its items as eaten (or its totals, for a meal typed as numbers), Save changes, and Delete meal (with undo). Time, day and portion stay as logged. Saving also updates that meal's kept comparison sample (`updateSampleForLog`), so the comparison scores against the corrected numbers.
- **Model comparison panel:** the "Keep meal photos for comparison" switch, a count, Export and Clear.
- **Sync & backup panel:** folds like regulars (`useFolded`, key `mycalorie:backup-collapsed`); it starts folded to its status line unless sync is off. With sync set up, the sync state (synced / syncing / offline / sync failed, last synced time) and the last backup file; without it, "backup" with the last backup date. Back up now and Restore either way.
- **Developer panel (hidden, 5 taps on the date):** a "Demo data" switch, "Reset demo data", "hide", the owner's "Read meals with Claude Sonnet" switch, and **Export**: two CSVs (with a UTF-8 BOM for Excel) via the share sheet: `mycalorie-meals-<day>.csv` (date, time, meal, portion, macros, items) and `mycalorie-daily-<day>.csv` (per-day totals, meal count, today's targets, score). It exports what's on screen, so demo data while demo is on (`src/lib/export-csv.ts`).
- **Dock:** "Log a meal" and "Type" (describe it, or enter numbers). With regulars saved, "Log a meal" opens the **log sheet** (`LogSheet.tsx`): Photo and Describe, then the regulars in shelf order (time of day first); a tap logs 1×, the sliders icon opens "adjust before logging", and a filter appears past 8 regulars. With no regulars it opens the camera directly.

**Meal sheet** (`src/components/meal/`). It moves through stages: compose → reading → review, or label.
- **Compose:**
  - Photo, optional hint, and the **Outside food** switch (restaurant oil and portions).
  - With **Type**, a description field instead, plus "Enter numbers instead".
- **Review:**
  - **Items:** each item has a − value unit + stepper: ½ steps, ½ tsp for oil and ghee, 25 g by weight, and a g/ml toggle where the weight is known. Items the AI is unsure of are marked **check** and shown first. Items can be removed.
  - **+ add:** pick from regulars and products, or describe something to add (text estimate).
  - **Matched regular:** a "Log that instead" banner.
  - **Totals:** shown live, and editable directly.
  - **Save to regulars:** keeps all the items and a small photo.
- **Label:** a nutrition-label photo is read exactly: product name, values per serving and per 100 g, a servings stepper. It's saved as a **product**, which is a regular with `product` info, usable as an ingredient.
- **Adjust before logging:** opens a regular's items for a one-off change.

**Targets sheet:** protein (required), calories, carbs and fat. When P/C/F are all filled it suggests the calorie total (4/4/9) with "Use N kcal".

**AI** (`src/lib/meal-prompt.ts` holds the shared instructions, schema and clean-up; `src/lib/providers/gemini.ts` makes the call):
- **Photo:** returns `meal`, `label` or `not_food`.
- **Item rules:**
  - Indian dish names and household units.
  - Grams per item, with a liquid flag.
  - Oil/ghee as its own tsp item.
  - `uncertain` for hidden quantities.
- **Bones:** for bone-in meat and fish, only the edible meat counts (leg/thigh ~30% bone, drumstick ~35%, mutton piece ~30%, fish ~40%), and the cut is named.
- **Regulars:** the owner's regulars are sent along so a photo can match one.
- **Text estimates:** a separate endpoint takes a description.
- **Routes:** `/api/analyze` and `/api/estimate`. Errors map to `not_configured`, `quota`, `unreadable`, `upstream`, and the UI falls back to manual entry.

**Access lock:**
- **Proxy:** `src/proxy.ts` gates everything except `/unlock`, `/api/unlock` and the icons/manifest.
- **Unlock route:** `/api/unlock` checks `ACCESS_CODE` timing-safely, sets an HMAC session cookie for 180 days, adds a 700 ms delay on wrong codes, and locks out after 5 failures for 15 min (in memory, so best-effort on serverless).
- **Defaults:** with no code set the app is open in development and closed in production.

**Phone polish:**
- Fields are ≥16px, so iOS doesn't zoom on focus.
- `ViewportSync` publishes `--keyboard-inset` and `--visual-height`, so sheets sit above the keyboard. Return keys go next/done/go, ignoring keyboards that are still composing.
- When installed, the top keeps at least 54px clear of the status bar (`--top-inset`). Installed mode is detected two ways: the `display-mode: standalone` media query, and `data-standalone`, which ViewportSync sets from `navigator.standalone`. A solid strip (`body::before`) sits behind the status bar so scrolled content slides under it.
- While any sheet is open the page behind it is frozen (`src/lib/scroll-lock.ts` pins the body), because iOS otherwise scrolls the page under a modal dialog. Closing restores the exact scroll position.
- PWA manifest and generated icons (`icon.tsx`, `apple-icon.tsx`).

**Model comparison:**
- **In the app:** with the switch on, each logged photo is kept with its hint, the Outside setting, Gemini's first answer and what was finally logged. Export shares one JSON file. Demo meals are never kept, and undoing a log drops its photo.
- **On the Mac:** `npm run compare -- --from <export.json>` re-sends each photo to Gemini Flash and Claude Haiku 4.5, Sonnet 5.5 and Opus 5.5 (effort `low` by default). It scores each model against what was logged, adds a column for the app's original Gemini answer, measures real cost per photo, and writes `compare/report-*.html`. It asks before spending. `compare/` is git-ignored.

**Cloud sync (`src/lib/sync.ts`, `src/app/api/data/route.ts`, `src/lib/cloud-store.ts`):**
- The phone's localStorage stays the working copy. Redis holds `mycalorie:state` (`{ state, updatedAt }`), `mycalorie:rev`, and `mycalorie:snapshot:YYYY-MM-DD` (that day's last state, kept 30 days).
- `/api/data`: GET (`?have=<rev>` skips the state when unchanged) and PUT `{ state, baseRev, day }`. A Lua script saves only if the cloud is still at `baseRev`; otherwise 409 with the current copy. The route checks the session itself as well as the proxy.
- The phone keeps `mycalorie:sync` (`rev`, `dirty`, `replace`, `syncedAt`). It syncs on open, 1.2 s after each change (`onRealDataChange` in `store.ts`), on returning to the front, and on coming back online. A clean phone takes a newer cloud copy (`writeRealState`); a phone with unsent changes merges by id (its own version wins) and sends the result. Settings carry `changedAt` (stamped by every settings setter); the merge keeps the newer settings, and between two unstamped copies a set of targets beats none. Before this, a second copy with no targets (a Safari tab, say) could blank the targets everywhere. A meal deleted on one device while another was offline with changes can come back. A backup restore is sent as is, replacing the cloud copy.
- Demo data never syncs. Comparison photos stay on the phone.
- Redis is reached through `REDIS_URL` with the `redis` package (one connection per warm function, 6 s command timeout), or through Upstash's REST API when the `KV_REST_API_*` pair is set.
- Tested end to end (two devices, merge, outage and recovery, restore) against Redis 7 in Docker and a stand-in Upstash REST server; harness in `.local-test/` (git-ignored).

**Backups (`src/lib/backup.ts`, `src/components/Backup.tsx`):**
- A backup is `mycalorie-backup-YYYY-MM-DD.json`: `{ app: "mycalorie", version: 1, exportedAt, data: AppState }`, the real data only (regular photos included, comparison photos not). It goes to the share sheet (Save to Files) via `src/lib/share-file.ts`, or downloads where sharing isn't available.
- Restore validates the file, shows its date and counts, and replaces all real data after a confirm. A bad file shows an error. Restore and backup are off in demo mode.
- Status lives in `mycalorie:backup` (`lastAt`, `dismissedDay`). A restore records the file's own date as the last backup.

**People (`src/lib/access.ts`, `src/lib/session.ts`, `src/lib/current-user.ts`):**
- The owner signs in with `ACCESS_CODE`; others come from `ACCESS_CODES`. The session cookie is `<user>.<HMAC of user and code>`; the owner's older cookies (an HMAC of the code alone) are still accepted.
- The home page reads the session per request and passes the user to `HomeScreen`, which calls `setCurrentUser` before anything reads storage. The owner keeps the original keys (`mycalorie:v1`, `mycalorie:sync`, `mycalorie:backup`, and in Redis `mycalorie:state` / `rev` / `snapshot:*`); others get `…:<user>` in the browser and `mycalorie:u:<user>:…` in Redis. Demo data and device preferences (folded panels, developer flag) are shared per device.
- Owner only: "Try Claude" (the route returns 403 for anyone else) and the model comparison panel and samples.
- Tested end to end with two people, a legacy owner cookie, a forged cookie, and malformed entries (`.local-test/users-test.mjs`).

## Data model (`src/lib/types.ts`)

- `AppState = { settings: { targets, keepForComparison? }, saved: SavedMeal[], logs: MealLog[] }`, stored in localStorage under `mycalorie:v1`. Demo data uses `mycalorie:demo:v5`: 12 weeks of 3–4 real meals per day with items, built from Indian meal templates in `src/lib/demo.ts`, with an 18-day streak and a best run of 26. It uses the demo switch `mycalorie:demo-mode`, and the developer flag `mycalorie:developer`. Whether the regulars panel is folded lives in `mycalorie:regulars-collapsed`.
- `MealItem`: `quantity`, `unit`, `baseQuantity`, `baseMacros`, plus optional `gramsPerUnit`, `weightUnit`, `uncertain`, `cookingFat` and `sourceId`. An item's macros scale linearly from its base (`src/lib/items.ts`).
- `SavedMeal` (a regular): `macros` for 1×, plus optional `items` and `product`.
- `MealLog`: `macros` as eaten, `portion`, `day` (the local date), and optional `items` and `savedMealId`.
- Older saved data is migrated in `store.ts`; for example, `proteinTarget` becomes `targets`.

## Working on it

```bash
npm install
npm run dev                      # http://localhost:3000 (add ?demo for sample data)
MOCK_GEMINI=1 npm run dev        # canned AI answers; hint "label" returns a sample label
npx tsc --noEmit && npm run lint && npm run build   # all three should pass before pushing
npm run compare -- --from <export.json>             # model comparison (needs keys)
```

- **Checking UI changes:** take Puppeteer screenshots at 390×844 @2x with `puppeteer-core` and the local Chrome. The scripts lived in the session scratchpad; recreate them as needed. Puppeteer can't emulate iOS standalone mode or the real keyboard, so a fake `visualViewport` was used to simulate the keyboard.
- **Design workflow:** the Impeccable skill (`.impeccable/`).
  - The direction contract is in `.impeccable/surfaces/src-app-page-tsx.md`.
  - The design detector should report no non-advisory findings.
- **Commits:** end each message with the Claude co-author line. Push to `main` to deploy, then confirm with `gh api repos/sankhadeeproy007/mycalorie-app/deployments`.

## Not yet verified on real Gemini

The production key exists only on Vercel, so these have only been tested with the mock:
- the newer response schema (nullable fields, enum, label kind);
- the bone-in rules (a tandoori leg piece);
- text estimates;
- regular matching.

The owner confirmed a banana photo works. If a real call fails on the schema, the place to look is the `toGeminiSchema` conversion in `meal-prompt.ts`.

## Next steps

1. **Collect photos (in progress):** the owner is logging meals with "Keep meal photos for comparison" switched on. At about 30–40 photos: add $5 of Claude API credit (it expires a year after purchase), export from the app, run `npm run compare -- --from …`, and pick a model. Sonnet 5.5 fits the $2–3 budget; Opus may not.
2. **If Claude wins:** add a provider setting and a `src/lib/providers/claude.ts` (the comparison script already has a working Claude call to reuse), then switch `analyze-meal.ts` to it. If the user asks for refusal fallbacks, add them deliberately.
3. **Offered, not built:** a targets calculator (protein + calories + fat %, with carbs filled in). The owner entered all four targets by hand instead.
4. **Later:**
   - Storing targets per day, so past days are scored against the targets in force then.
   - Changing or removing a regular's photo (editing covers name, items and values).
   - History and settings screens.
   - Learning from corrections.
   - iOS splash images, to cover the brief dark moment before the HTML loads.
5. **Known limitations:**
   - The lockout counter lives in server memory.
   - iOS may clear a home-screen app's storage after weeks without use, and deleting the app deletes its data. Cloud sync (once Redis is connected) or the backup file covers meals, regulars and targets; export comparison photos separately.
   - A logged meal's time and day can't be changed.
