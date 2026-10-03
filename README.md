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

## Access code

The deployed app opens on an access-code screen. Set two environment variables (in Vercel: Project → Settings → Environment Variables):

- `ACCESS_CODE`: 4–8 digits. Change it any time to sign every device out.
- `SESSION_SECRET`: a long random string, e.g. the output of `openssl rand -hex 32`.

A device stays unlocked for six months. Five wrong codes in a row lock that connection out for 15 minutes. When you run locally without `ACCESS_CODE`, the lock is off; in production, a missing code keeps the app locked.

## Where data lives (for now)

Meals, saved meals and your target are stored in this browser's local storage. Moving to Supabase, so data syncs across devices, is the next data milestone (`src/lib/store.ts` is the only file that changes).
