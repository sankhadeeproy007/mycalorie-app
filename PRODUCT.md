# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Used mainly as mobile web on the owner's iPhone, installed to the home screen as a PWA. Desktop use is not a target.

## Stack

Next.js + TypeScript on Vercel (Hobby). The phone's browser storage is the working copy, mirrored to a free Redis database connected through Vercel for sync and restore. Claude Sonnet 5.5 reads the owner's meals first; the Gemini API free tier (Flash) is the fallback, the second opinion, and the only reader for everyone else.

## Users

- **The owner:** lives in India and mostly eats Indian food: home-cooked North and South Indian meals, thalis, tiffin, street and restaurant food. Logs on their phone at mealtime, often one-handed, by photographing the plate just before or after eating, and eats many of the same meals repeatedly.
- **A few other people (up to about 5):** family or friends the owner invites, each with their own access code and fully separate data. They read meals with Gemini only.

## Product Purpose

Turn a meal photo or a short description into a macro estimate in seconds, let the person correct it, and add it to today's running total. Success means logging takes less effort than skipping it, especially for repeat meals, and the owner always knows where they stand against their daily protein target.

## Positioning

A private tool built around one person's routine (and a handful of invited people), not a food database. AI reading handles new meals; saved meals ("regulars") turn the meals people repeat into one-tap logs that need no AI at all.

## Operating Context

- Logging happens at the table, on a phone; sessions last seconds.
- The main daily question is "how much protein do I still need today?" Calories, carbs and fat are tracked against their own targets as secondary questions.
- Food is Indian, so dish names, portions and nutrition values follow Indian conventions:
  - household measures (rotis counted, katori, ladle, plate);
  - regional dish names;
  - cooking oil and ghee accounted for;
  - the Indian Food Composition Tables (IFCT 2017, NIN) as the reference;
  - Indian digit grouping for numbers.
- AI estimates are approximate (portion size is the main source of error), so every AI-read meal goes through a quick review-and-correct step before it's added, and anything logged can be corrected later.

## Capabilities and Constraints

**Logging**
- **Log a meal:** with regulars saved, the button opens a sheet with Photo, Describe, and the regulars, ordered for the time of day. With no regulars it opens the camera directly.
- **Photo:** an optional hint ("3 eggs, 1 tsp ghee") and an **Outside food** switch. The AI treats the hint as fact and returns each item in Indian household measures with grams, a separate oil/ghee line for cooked dishes, and a flag on items it's unsure of.
- **Describe / Type:** a description ("2 rotis and a katori of dal") is estimated by the AI, or numbers can be entered directly.
- **Nutrition labels:** the camera recognises a label and reads exact per-serving and per-100 g/ml values. The result is saved as a product, counted in servings, and usable as an ingredient.
- **Eggs mean whites:** the owner eats only egg whites, so boiled, fried or poached eggs count as whites unless the hint or description mentions the yolk or whole eggs. Omelettes and bhurji go by what the photo shows (yellow means whole). It's a per-person switch in the developer panel: on by default for the owner, off for everyone else.
- **Regular matching:** the AI is told the person's regulars; when a photo confidently matches one, the review offers to log that regular instead.

**Which AI reads**
- **The owner:** Claude Sonnet 5.5 reads photos and descriptions first (about 2¢ a photo). If Claude can't answer (no API credit, rate limit), Gemini answers automatically and the sheet says why.
- **Second opinion:** a Claude | Gemini switch on each photo asks the other AI about the same photo. Each answer keeps its own edits, and the switch shows what the Claude answer cost.
- **Switching back:** "Read meals with Claude Sonnet" in the developer panel puts Gemini first instead.
- **Everyone else:** reads with Gemini only.

**Review and correction**
- **Unsure items:** shown first, marked "check".
- **Quantities:** each item has a stepper that rescales its macros: ½ steps for countables and katori/ladle/scoop/cup, ½ tsp for oil/ghee/sugar, 25 g or ml by weight.
- **Item numbers:** tapping an item's figures edits its protein, calories, carbs and fat directly; later quantity changes scale from the corrected numbers.
- **Removing and adding items:** wrong items can be removed. **+ add** pulls in regulars, products, or a described extra.
- **Totals:** can be typed over directly.
- **Correcting later:** any logged meal, today's or a past day's, can be edited or deleted with undo.

**Regulars (saved meals)**
- **Saving:** an opt-in checkbox saves a meal with all its items and a small photo. Already-logged meals can be saved afterwards.
- **Tiles:** regulars show as photo tiles. One tap logs 1×; a portion picker offers ½×, 1×, 1½× and 2×. "Adjust before logging" changes items for that log only.
- **Edit and remove:** each regular can be renamed, re-itemised or removed (with undo).
- **No AI cost:** logging, adjusting and editing regulars never call an AI.

**Targets, score and streaks**
- **Daily targets:** protein (required), plus calories, carbs and fat. The targets sheet can suggest calories from the three macros (4/4/9 kcal per gram).
- **Today:** totals against each target, showing what's left. Protein is the main number. "Today" follows the phone's timezone.
- **Day score:** one 0–100 number from how close intake landed to all four targets, with protein weighted most.
- **Streak:** consecutive days the protein target was hit, a 12-week consistency graph (tap a day to see it), and quiet milestones.

**Data**
- **Sync:** each person's data syncs to the cloud, so a reinstall or a new phone restores itself after the access code. When devices disagree, the newest settings win.
- **Backups:** backup files (Files / iCloud Drive) are an extra copy. A daily backup prompt appears only when sync isn't working.
- **Export:** meals and daily totals export as CSV spreadsheets from the developer panel.
- **Photos:** photos of one-off meals aren't stored. Only regulars keep a small photo, plus the owner's comparison photos when that switch is on, on the phone only.

**Access**
- Each person has a personal numeric access code: the owner's in `ACCESS_CODE`, others in `ACCESS_CODES`.
- A device stays signed in for six months, and changing a code signs out only that person.

**Cost**
- Everything runs on free tiers except Claude, which is the owner's only spend: within $2–3 a month, and only for new meals.
- The Gemini free tier's limits can change without notice; it's shared by everyone.

**Data use and naming**
- Free-tier Gemini data may be used by Google for training. The owner accepts this for food photos.
- The product name is undecided; "mycalorie" is the working name.

**Later**
- Targets stored per day, so past days are scored against the targets in force then.
- Changing a regular's photo.
- Learning from corrections over time.
- A history screen.

## Evidence on Hand

Real logs exist on the owner's phone and in the cloud copy, but none are in the repo. Never invent sample data presented as real history; demo data is clearly labelled and kept separate.

## Product Principles

1. **Repeat meals cost one tap.** The fastest path is for meals people already eat, and it never calls an AI.
2. **Protein first.** Every screen answers "how much protein is left today?" before anything else.
3. **Estimates are editable, never final.** AI output is a draft confirmed in seconds, and any number can be corrected later.
4. **Built for one hand at the table.** Mobile-first, big targets, minimal typing.
5. **Cheap and private.** Free tiers by default; the owner's only spend is Claude, kept small. Each person's data is theirs alone, and photos are kept only when someone chooses to.
6. **Gamified like an adult.** Streaks, a daily score and milestones reward consistency, presented with the restraint of a serious instrument: no cartoons, stickers, mascots, confetti or childish copy. A missed day is information, not a scolding.

## Brand Commitments

- Mature and premium: it should feel like a grown professional's tool, not a kids' or college app. The owner rejected a hand-drawn, cartoon-like look (masking tape and marker) as too childish (2026-10-03) and chose the dark "Console" design.
- Regulars stay as a grid of photo tiles that log in one tap.
