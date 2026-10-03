# Mycalorie

A personal meal tracker for Indian food: snap a meal, get a protein estimate, and track protein, calories, carbs and fat against daily targets, with a day score and protein streak. Saved meals (regulars) log again in one tap.

## Run it

```bash
npm install
cp .env.example .env.local   # then add your Gemini key (and ACCESS_CODE/SESSION_SECRET to test the lock)
npm run dev
```

Open http://localhost:3000. Add `?demo` (http://localhost:3000/?demo) to see the screen filled with synthetic sample data; it's stored separately and never mixes with your real logs.

## Photo analysis

Photos are read by the Gemini API free tier. Get a free key (no card) at Google AI Studio and set `GEMINI_API_KEY` in `.env.local`. `GEMINI_MODEL` is optional and defaults to `gemini-flash-latest`.

Without a key, or when the free allowance runs out, the app falls back to entering a meal by hand.

For working on the review screens without a key, run `MOCK_GEMINI=1 npm run dev`: photo reads return a sample omelette, a hint containing "label" returns a sample nutrition label, and text estimates return one sample item. The mock never runs in production.

## Comparing AI models on your own meals

The easiest way: in the app, switch on **Keep meal photos for comparison** (bottom of the home screen). Every photo you log is then kept with Gemini's first estimate and what you logged after fixing it. After a few weeks, tap **Export** and AirDrop the file to your Mac, then run:

```
npm run compare -- --from ~/Downloads/mycalorie-comparison-<date>.json
```

Each photo is re-sent with the hint and Outside-food setting you used, and every model is scored against what you actually logged. The report also shows how far off the app's original Gemini answer was.

Alternatively, `npm run compare` sends the same photos to Gemini Flash and to Claude Haiku 4.5, Sonnet 5.5 and Opus 5.5, using the exact instructions the app sends. It then writes a side-by-side report, with each model's items, protein and real cost per photo, to `compare/report-*.html`.

Without an export:

1. Put photos in `compare/photos/`. JPEG, PNG and iPhone HEIC all work, and they're resized the same way the app resizes them.
2. Optionally note what you actually ate in `compare/notes.txt`, one line per photo, keyed by file name without its extension. A protein figure after `|` lets the report score each model:
   ```
   IMG_1234: 3 egg omelette, 2 slices brown bread | 26
   IMG_1240: home thali - dal, 2 rotis, rice, sabzi | 24
   ```
3. Add `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` to `.env.local`, then run `npm run compare`. Before spending anything it shows the estimated Claude cost and asks you to confirm.

Options: `--from <export.json>` uses photos kept by the app, `--models gemini,sonnet` runs a subset, `--limit 10` caps the number of photos, `--effort low|medium|high` sets Claude's effort (default `low`, which keeps cost down), and `--yes` skips the confirmation. The `compare/` folder is git-ignored, so your photos stay on your machine.

## Access code

The deployed app opens on an access-code screen. Set two environment variables (in Vercel: Project → Settings → Environment Variables):

- `ACCESS_CODE`: 4–8 digits. Change it any time to sign every device out.
- `SESSION_SECRET`: a long random string, e.g. the output of `openssl rand -hex 32`.

A device stays unlocked for six months. Five wrong codes in a row lock that connection out for 15 minutes. When you run locally without `ACCESS_CODE`, the lock is off; in production, a missing code keeps the app locked.

## Where data lives (for now)

Meals, saved meals and your target are stored in this browser's local storage. Moving to Supabase, so data syncs across devices, is the next data milestone (`src/lib/store.ts` is the only file that changes).
