---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

# Home screen

## Scope and mode

The home route (`/`). Mode: Operate. This is a redesign that replaces the Prep Shelf world, which the owner rejected as cartoonish and childish on 2026-10-03. The task is a one-handed check at the table that answers how much protein is left, then logs a meal in one tap (a regular) or one photo.

## Audience, task, content

- **Owner:** a single adult in India and a developer, who wants a mature, premium tool.
- **Content:**
  - Protein to go against the target.
  - Calories, carbs and fat left against their targets.
  - Day score (0–100).
  - Protein streak, best streak, and a 12-week consistency graph.
  - Next milestone.
  - Regulars (saved meals) as photo tiles.
  - Today's log.
- **States:**
  - First run: no targets, no regulars.
  - Typical day.
  - Over target, shown neutrally.
  - Just logged, with undo.
  - Analysing a photo.
  - Analysis failed or the free quota is used up.
  - New day.
- **Gamification:** mature only (score, streaks, milestones). Never cartoons, stickers, mascots, confetti or guilt copy. A missed day is information.

## Memorable moment

Logging a regular makes the protein bar and its numbers advance in place, and today's cell in the contribution graph steps up a shade. On the day the target is hit, that cell lights fully and the streak counter ticks.

## Direction contract

THESIS: Your nutrition as a console you'd build for yourself: graphite panels joined by hairline seams, monospaced figures, and your protein streak as a contribution graph. It refuses the category's white cards, protein ring and tab bar, and it refuses the dark-ground-with-one-neon-glow look.

OWN-WORLD:
- Graphite ground #0d1117, panels #151a21 with 1px seams #262c36, one elevation step and no drop shadows.
- Text #e6edf3; muted #8b949e.
- Syntax-derived data colours mark state only: protein #79c0ff, calories #d2a8ff, carbs #e3b341, fat #7ee787.
- One primary accent, blue #1f6feb, appears only on the primary action. Destructive actions stay outlined.
- Type: Geist for UI and Geist Mono for every figure. Panel headers are in small caps.
- Meal photos are the only imagery.

STORY: You see "37 g to go" before anything else, then what's left of each macro and how today scores. You tap a regular or snap a photo, the bar and graph advance, and you leave in under five seconds with your streak intact.

FIRST VIEWPORT:
1. A mono status line: date left, streak status right.
2. The protein panel, full width:
   - Header: "protein", with "63 / 100 g" and an edit-targets action on the right.
   - "37 g to go" in mono at 44px, in protein blue, over a full-width bar.
   - Three mono rows (kcal, carbs, fat), each with a mini bar, the amount left and the target.
3. A split row: a day-score panel ("78", plus the gap to the 7-day average) beside a 12-week contribution-graph panel (streak in the header; best streak and next milestone in the footer).
4. A "regulars" panel of photo tiles, three per row, tap to log.
5. Fixed at the bottom: the blue "Log a meal" button with an outlined "Type" button beside it.

FORM: Dark-first developer console (catalog challenger digital-design-canon-dark-first-developer-console). The owner chose it over the rolled "Black Card" and my "The Chase" pick. Seed key 35015948.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions

- **Score formula:** a weighted closeness to the four targets. Protein counts 50% and is capped at 100% once hit; calories, carbs and fat share the rest by closeness. Targets without a value are skipped.
- **History:** past days are scored against today's targets, because targets aren't stored per day yet.
