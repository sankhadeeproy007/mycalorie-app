# Mycalorie

A meal tracker for Indian food, built for one person's phone and a few invited people.
- **Log:** photograph a meal or describe it. An AI estimates the items in Indian household measures, you correct anything that's off, and it counts toward daily targets for protein, calories, carbs and fat.
- **Track:** a day score, a protein streak with a 12-week graph, and quiet milestones.
- **Repeat:** saved meals ("regulars") log again in one tap, with no AI call.

The full picture of what's built, how it fits together and what's next is in [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md). Product decisions are in [`PRODUCT.md`](PRODUCT.md), the visual system in `DESIGN.md`.

## What it does

- **Log a meal** from a photo, a description ("2 rotis and a katori of dal"), a nutrition label, or typed numbers.
- **Review and correct:** step quantities (½ roti, ½ tsp ghee, 25 g), fix any item's protein, calories, carbs and fat, add or remove items, or type over the totals. Logged meals can be edited or deleted later, including on past days.
- **Regulars:** save a meal with its items and photo, then log it with one tap, at any portion, or adjust it first. Regulars can be edited or removed.
- **Two AIs:** for the owner, Claude Sonnet 5.5 reads meals first (about 2¢ a photo) and free Gemini takes over if Claude can't answer. A Claude | Gemini switch on each photo asks the other one and flips between the answers. Everyone else uses Gemini.
- **Several people:** each has their own access code and completely separate data.
- **Sync and backup:** data syncs to a free Redis database, so a new phone or reinstall restores itself. Backup files and CSV exports are extra copies.

## Run it

```bash
npm install
cp .env.example .env.local   # then add keys (see below)
npm run dev                  # http://localhost:3000
```

Useful modes:
- **`?demo`** (http://localhost:3000/?demo) fills the screen with synthetic sample data. It's stored separately and never mixes with real logs. In the app it's in the developer panel.
- **`MOCK_GEMINI=1 npm run dev`** returns canned answers from both Gemini and Claude, so the review screens work without keys. A hint containing "label" returns a sample nutrition label. The mock never runs in production.
- **Before pushing:** `npx tsc --noEmit && npm run lint && npm run build`. Pushing to `main` deploys on Vercel.

## Configuration

Set these in `.env.local`, and on Vercel under Project → Settings → Environment Variables. Redeploy after any change.

| Variable | What it's for |
|---|---|
| `GEMINI_API_KEY` | Gemini free tier (Google AI Studio, no card). Never enable billing on it. |
| `GEMINI_MODEL` | Optional; defaults to `gemini-flash-latest`. |
| `ANTHROPIC_API_KEY` | Claude for the owner. Needs **API credit** from platform.claude.com → Billing; claude.ai plan credit doesn't work for the API. Without credit, Gemini answers instead. |
| `CLAUDE_EFFORT` | Optional: `low` (default), `medium` or `high`. |
| `ACCESS_CODE` | The owner's access code, 4–8 digits. |
| `ACCESS_CODES` | Other people, as `name:code` pairs: `priya:48291736,rahul:20556611`. |
| `SESSION_SECRET` | A long random string that signs sessions (`openssl rand -hex 32`). |
| `REDIS_URL` | Cloud sync. Vercel's Redis integration sets it. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Alternative cloud sync through Upstash's REST API. |

## Access and people

The deployed app opens on an access-code screen.
- **The owner:** signs in with `ACCESS_CODE`.
- **Others:** listed in `ACCESS_CODES`. Names are lower-case letters, digits or dashes. Each code has the same number of digits as `ACCESS_CODE` and differs from every other code.
- **Separate data:** each person has their own meals, regulars, targets and cloud copy, and changing a code signs out only that person.
- **Owner only:** Claude and the model comparison, since the owner pays for Claude. Everyone shares the free Gemini allowance.

A device stays unlocked for six months, and five wrong codes in a row lock that connection out for 15 minutes. Locally, without `ACCESS_CODE`, the lock is off; in production a missing code keeps the app locked.

## Claude and Gemini

For the owner:
- **Order:** photos and descriptions go to Claude Sonnet 5.5 first. If it fails (no API credit, rate limit), Gemini answers automatically and the sheet shows why.
- **Second opinion:** the switch at the top of a photo's review asks the other model. Each answer keeps its own edits, and the Claude side shows what that answer cost.
- **Changing the order:** "Read meals with Claude Sonnet" in the developer panel puts Gemini first. Tap the date at the top 5 times to show the panel.

Logging, adjusting or editing a regular never calls either model, so credit is spent only on new meals.

**Eggs are whites only** (developer panel, per person; on by default for the owner): boiled, fried or poached eggs are counted as egg whites unless the hint or description mentions the yolk or whole eggs. Omelettes and bhurji go by what the photo shows.

## Data, sync and backups

- **Working copy:** the phone's browser storage, so the app opens instantly and works offline.
- **Cloud sync:** with `REDIS_URL` (or the Upstash pair) set, every change is also sent to Redis, and other devices pick it up when they open.
  - When copies disagree, meals and regulars are combined, and the most recently changed settings win.
  - Redis also keeps the last state of each day for 30 days, as a way back from a bad overwrite.
  - To turn it on: Vercel project → **Storage** → create a free Redis database, connect it to the project, and redeploy.
- **Backups:** the **Sync & backup** panel saves or restores a backup file through the share sheet. When sync isn't working, a daily prompt asks for one.
- **Export:** the developer panel exports every meal (`mycalorie-meals-<day>.csv`) and daily totals against targets (`mycalorie-daily-<day>.csv`) for Numbers, Excel or Google Sheets.

## Comparing AI models on your own meals

- **In the app:** with **Keep meal photos for comparison** on (owner only), each logged photo is kept on the phone with the answers you asked for (Gemini's, Claude's or both), which one you logged from, and what you finally logged. Tap **Export** to get one JSON file.
- **On a Mac:** to score more models against your own meals, run:

  ```
  npm run compare -- --from ~/Downloads/mycalorie-comparison-<date>.json
  ```

  It re-sends each photo to Gemini Flash and Claude Haiku 4.5, Sonnet 5.5 and Opus 5.5 with the instructions the app uses, scores each against what you logged, and writes `compare/report-*.html` with real cost per photo. Before spending anything it shows the estimated Claude cost and asks you to confirm.

To run it without an export:
1. Put photos in `compare/photos/` (JPEG, PNG or HEIC).
2. Optionally add `compare/notes.txt` with one line per photo:
   ```
   IMG_1234: 3 egg omelette, 2 slices brown bread | 26
   ```
3. Run `npm run compare`.

Options:
- `--models gemini,sonnet` runs only those models.
- `--limit 10` caps the number of photos.
- `--effort low|medium|high` sets Claude's effort.
- `--yes` skips the confirmation.

`compare/` is git-ignored.
