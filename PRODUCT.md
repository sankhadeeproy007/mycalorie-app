# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Used mainly as mobile web on the owner's phone and installable to the home screen as a PWA. Desktop use is not a target.

## Stack

Next.js + TypeScript, deployed on Vercel (Hobby). Supabase (free tier) for Postgres and saved-meal photo storage. Gemini API free tier (Flash) for meal-photo analysis. Chosen from Claude's recommendation; the hard constraint is zero running cost and no Anthropic API key.

## Users

One user: the owner, who lives in India and mostly eats Indian food (home-cooked North and South Indian meals, thalis, tiffin, street and restaurant food). They log meals on their phone at mealtime, often one-handed, by photographing the plate just before or after eating. They eat many of the same meals repeatedly.

## Product Purpose

Turn a meal photo into a macro estimate in seconds, let the owner correct it, and add it to today's running total. Success means logging takes less effort than skipping it, especially for repeat meals, and the owner always knows where they stand against their daily protein target.

## Positioning

A private, single-user tool built around one person's routine rather than a food database. Photo analysis handles new meals; saved meals turn the meals they repeat into one-tap logs that need no analysis.

## Operating Context

- Logging happens at the table, mid-day, on a phone; sessions last seconds.
- The main daily question is "how much protein do I still need today?" Calories, carbs and fat are tracked against their own targets as secondary questions.
- Food is Indian, so dish names, portions and nutrition values follow Indian conventions: household measures (rotis counted, katori, ladle, plate), regional dish names, cooking oil and ghee accounted for, and the Indian Food Composition Tables (IFCT 2017, NIN) as the reference. Numbers use Indian digit grouping.
- AI estimates are approximate (portion size is the main source of error), so every analyzed meal goes through a quick review-and-correct step before it's added.

## Capabilities and Constraints

- **Analyze a photo:** take or pick a photo, optionally add a free-text hint ("3 eggs, 1 tsp ghee") and flip an **Outside food** switch; without it the AI judges home vs restaurant from the photo. The AI (Gemini free tier) treats the hint as fact and returns each item in Indian household measures with grams, a separate oil/ghee line for cooked dishes, and a confidence flag per item.
- **Nutrition labels:** the same camera recognises a nutrition label and reads exact per-serving and per-100 g/ml values. The product is saved (name asked for if the brand isn't visible) and counted in servings, with grams or ml one tap away.
- **Regular matching:** the AI is told the owner's regulars; when a photo confidently matches one, the review offers to log that regular instead.
- **Review:** items the AI is unsure of come first, marked "check". Each item has a quantity control (½ steps for countables and katori/ladle/scoop/cup, ½ tsp for oil/ghee/sugar, 25 g or ml by weight) that rescales its macros; wrong items can be deleted; **+ add** pulls in saved products and regulars or a short text description the AI estimates without a photo. Totals stay directly editable.
- **Text logging:** Type accepts a description ("2 rotis and a katori of dal"), estimated by the AI, as well as raw numbers.
- **Save for later:** an opt-in checkbox saves the meal with all its items (and a small copy of the photo) as a regular. Already-logged meals can also be saved afterward.
- **Products and regulars:** scanned products are one-tap regulars and also ingredients (whey shake = 2 scoops whey + 300 ml milk). Regulars remember their items: one tap logs them as saved, the portion picker scales everything, and "Adjust before logging" changes items for that log only.
- **Quick add:** regulars appear as photo tiles; one tap logs a meal, with a portion multiplier (½×, 1×, 1½×, 2×). No AI call.
- **Daily targets:** protein (required), calories, carbs and fat, each optional except protein. The targets sheet can suggest calories from the three macros (4/4/9 kcal per gram).
- **Daily total:** today's totals against each target, showing what's left. Protein is the main number; calories, carbs and fat are secondary rows. "Today" follows the owner's timezone.
- **Daily score:** one number for the day, from how close intake landed to all four targets (protein weighted most).
- **Streaks and consistency:** consecutive days protein target was hit, plus a weekly consistency view.
- **Milestones:** quiet marks for real achievements (e.g. a 30-day streak, 100 meals logged). No confetti.
- **History:** past days' logs.
- Photos of one-off meals aren't stored; only saved meals keep a photo.
- Access is protected by a single password (env var). No multi-user accounts.
- **Zero cost:** free tiers only. The Gemini free tier's limits can change without notice, so the AI provider sits behind a single function that can be swapped.
- Free-tier Gemini data may be used by Google for training. The owner accepts this for food photos.
- **Later:** learning from corrections over time, a screen to edit/manage regulars, and an accuracy comparison of Gemini vs Claude on the owner's own photos (decided 2026-10-03 to stay on Gemini's free tier).
- **Undecided:** the product name ("mycalorie" is the working name).

## Evidence on Hand

None yet: no meal photos, logs, or assets. Don't invent sample data presented as real history.

## Product Principles

1. **Repeat meals cost one tap.** The fastest path is for meals the owner already eats.
2. **Protein first.** Every screen answers "how much protein is left today?" before anything else.
3. **Estimates are editable, never final.** AI output is a draft the owner confirms in seconds.
4. **Built for one hand at the table.** Mobile-first, big targets, minimal typing.
5. **Free and private by default.** No paid services, no accounts, no stored photos unless the owner chooses to save one.
6. **Gamified like an adult.** Streaks, a daily score and milestones reward consistency, presented with the restraint of a serious instrument: no cartoons, stickers, mascots, confetti or childish copy. A missed day is information, not a scolding.

## Brand Commitments

- Mature and premium: it should feel like a grown professional's tool, not a kids' or college app. The owner rejected a hand-drawn, cartoon-like look (masking tape and marker) as too childish (2026-10-03).
- Saved meals stay as a grid of photo tiles that log in one tap.
