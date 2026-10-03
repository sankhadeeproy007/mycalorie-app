---
name: Mycalorie
description: Snap a meal, see your protein for the day.
colors:
  ground: "#0d1117"
  panel: "#151a21"
  raised: "#1b2129"
  well: "#10151c"
  seam: "#262c36"
  seam-strong: "#353c47"
  text: "#e6edf3"
  muted: "#8b949e"
  protein: "#79c0ff"
  kcal: "#d2a8ff"
  carbs: "#e3b341"
  fat: "#7ee787"
  accent: "#1f6feb"
  accent-edge: "#388bfd"
  accent-hover: "#2f7cf3"
  danger: "#f85149"
  graph-0: "#1b222c"
  graph-1: "#2c3e52"
  graph-2: "#3c5976"
  graph-3: "#4f79a0"
  graph-4: "#79c0ff"
typography:
  display:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "2.1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    letterSpacing: "0.06em"
    fontFeature: "smcp, c2sc"
  data:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  cell: "2px"
  tab: "4px"
  tile: "6px"
  control: "8px"
  panel: "10px"
  sheet: "14px"
spacing:
  hairline: "1px"
  cell-gap: "3px"
  stack: "10px"
  panel-pad: "12px"
  gutter: "14px"
  sheet-stack: "16px"
  dock-height: "52px"
  column-max: "560px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.panel}"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "0 14px"
    height: "52px"
  button-control:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  icon-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    size: "44px"
  icon-button-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "12px"
  panel-header:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "38px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "46px"
  portion-tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.tab}"
    padding: "1px 6px"
  toast:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "4px 4px 4px 14px"
    height: "48px"
  sheet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet} {rounded.sheet} 0 0"
    width: "560px"
---

# Design System: Mycalorie

## Overview

**Creative North Star: "The Console"**

Your nutrition as a console you would build for yourself. A graphite ground carries a faint dot grid; graphite panels sit on it, joined by 1px seams, each with a small-caps header, a body, and sometimes a mono footer. Figures are monospaced and tabular. The colours that carry meaning are borrowed from syntax highlighting, and they mark data and state, never decoration. The protein streak is drawn as a contribution graph.

The game layer is the instrument's own readout: a 0–100 day score, a protein streak, a 12-week consistency graph and the next milestone. It uses the same seams, cells and figures as everything else, with nothing celebratory on top. An unfinished day is drawn as unfinished, a missed day is a dim cell, and a value over target is stated plainly in muted text.

Density is that of a tool checked one-handed at the table. It uses a single 560px column, compact 12px panel padding and 44px touch targets everywhere, including around compact controls. The only imagery is the owner's own meal photos.

**Key Characteristics:**
- Dark-first graphite ground (#0d1117) with a 1px dot grid at 5% opacity on a 16px pitch.
- Panels on 1px seams, one elevation step, no drop shadows.
- Four syntax-derived data colours: protein, kcal, carbs, fat.
- One blue primary accent, used only by the primary action.
- Geist for words, Geist Mono for figures, times and the status line.
- Motion is in place and on one axis: numbers roll, bars scale, panels expand.

## Colors

Cool graphite neutrals, a quartet of syntax-highlight data hues, and one saturated blue reserved for the primary action.

### Primary
- **Commit Blue** (accent): fills the primary action only, which means the docked "Log a meal" button, sheet submit buttons and the checked checkbox. **Commit Blue Edge** (accent-edge) is its 1px border and the system focus ring. **Commit Blue Lift** (accent-hover) is its hover fill.

### Secondary (data hues)
- **Protein Blue** (protein): protein figures, the hero "to go" number, the protein bar, the protein figure on every regular and log row, and the default portion in the picker. Also used for live state: an active streak count, a filled status dot, the text caret and the travelling analysis bar.
- **Calorie Violet** (kcal): the calorie mini bar and calorie figures where they are the subject.
- **Carb Amber** (carbs): the carbs mini bar.
- **Fat Green** (fat): the fat mini bar.

### Tertiary
- **Failure Red** (danger): the hover/focus state of a destructive icon, and the tinted border (45%) and wash (8%) of a system failure message. Nothing else.

### Neutral
- **Graphite Ground** (ground): page background under the dot grid, the browser theme colour, and the base of the translucent dock (94%).
- **Graphite Panel** (panel): panels, sheets, secondary buttons and portion cells.
- **Graphite Raised** (raised): the one elevation step. Used for the toast, hover fills, the picker head, the photo-less tile and the targets control.
- **Graphite Well** (well): recessed fields such as inputs, checkboxes, the itemised estimate and the suggestion box.
- **Seam** (seam): 1px panel borders, header and footer rules, and list dividers.
- **Strong Seam** (seam-strong): control outlines, the dashed demo chip, and the 1px gaps between picker cells.
- **Console White** (text): primary text and the "now" bar fill.
- **Comment Grey** (muted): panel headers, units, labels, times and quiet icons.

### Graph ramp
- **Protein ramp** (graph-0 to graph-4): the protein hue stepped down toward the empty cell. Levels are: nothing logged, under half, under 80%, under target, and target hit. Full strength appears only on a hit. graph-0 is also the track for every bar.

### Named Rules
**The Data-Only Rule.** Protein, kcal, carbs and fat colours mark data and state. They are never used for ornament, backgrounds, borders or buttons.

**The One Commit Rule.** The blue accent appears only on the primary action: one filled button per view, plus the checked checkbox. Every other button is a graphite outline.

**The No Red Intake Rule.** Danger red is for destructive hover and system failure only. Intake over target is shown with the word "over" in muted text, never in red.

## Typography

**Body Font:** Geist (with -apple-system, Segoe UI, sans-serif)
**Label/Mono Font:** Geist Mono (with ui-monospace, SF Mono, Menlo)

**Character:** Geist reads like a well-made tool and speaks every sentence and button. Geist Mono is the instrument readout: it sets figures in tabular columns so numbers align and tick without jitter. Tabular numerals are on globally.

### Hierarchy
- **Display** (Geist Mono 600, 2.75rem, line-height 1, -0.03em): the protein "to go" figure, in protein blue. The unit sits beside it in Geist Mono 500 at 1.5rem, followed by a muted Geist label ("to go").
- **Headline** (Geist Mono 600, 2.1rem, line-height 1, -0.02em): the day score figure, followed by a muted "so far".
- **Title** (Geist 600, 1rem): sheet titles.
- **Body** (Geist 400, 15px, line-height 1.45): sentences, meal names (0.8–0.9rem, clamped to two lines) and button labels (500–600).
- **Label** (Geist 500, 0.8rem, all-small-caps, +0.06em, muted): panel headers, form field labels and the picker title (0.75rem).
- **Data** (Geist Mono 400, 0.7–0.85rem): panel meta and footers, macro rows, log times and figures, regular protein figures, portion tabs and the status line.

### Named Rules
**The Mono Is Data Rule.** Geist Mono sets figures, times and the status line only. Sentences, names and buttons stay in Geist. Mono is never a costume.

**The Small Caps Header Rule.** Panel headers are lowercase source text set in all-small-caps, never uppercase strings, never in mono.

## Layout

A single centred column, 560px max, with a 14px gutter and safe-area insets. Panels stack with a 10px gap. Panel interiors use 12px padding, headers have a 38px minimum height, and footers have 8px vertical padding. The progress row splits into two columns at 1fr / 1.5fr (score and graph) with a 10px gap. Regulars are a strict three-column grid with a 14px row gap and a 10px column gap. Sheet forms stack at 16px, and macro fields form a three-column grid with protein spanning the full row.

The dock is fixed to the bottom edge, 52px tall, with a 1px top seam over 94% ground and a 12px backdrop blur. The page reserves the dock's height plus 96px at the bottom. The toast floats 34px above the dock.

Every interactive control reaches 44px. Compact controls (the 28px edit action, the portion tab, the picker close) extend their hit area with an invisible pseudo-element rather than growing visually.

The dot grid is a 1px dot at Console White, 5% opacity, on a 16px pitch, drawn on the body behind everything.

## Elevation & Depth

The world is flat and tonal: no drop shadows anywhere. Depth has exactly three tones: ground, panel and raised, with well as the one recessed tone for fields. Edges are drawn by 1px seams. The only overlay effects are the sheet backdrop (rgba(1, 4, 9, 0.7)) and the dock's translucency and blur. Inset 1px box-shadows appear only as drawn outlines (the open status dot, today's score bar, future graph cells), never as lift.

### Named Rules
**The One Step Rule.** Panel to raised is the only elevation step. Hover fills, the toast and the picker head use raised. Nothing sits above raised except a modal sheet.

**The Seam Not Shadow Rule.** Separation is a 1px seam (seam or seam-strong). If something needs to stand apart, give it a seam, not a shadow or a glow.

## Shapes

Corners are rounded small and get smaller as the object gets smaller. Sheets use 14px on their top corners only, panels and dock buttons 10px, controls and inputs 8px, photos and the picker 6px, the portion tab 4px, and graph cells and score tracks 2px. Bars are capsules (6px tall with a 3px radius; minis are 4px with a 2px radius). The status dot is a 7px circle. Borders are always 1px. Dashed strokes are reserved for references and provisional marks: the 7-day average line and the demo-data chip.

## Components

### Buttons
Precise and quiet: graphite outlines, with one blue fill per view.
- **Shape:** dock and submit buttons are 52px tall with 10px corners. Inline controls are 44px tall with 8px corners.
- **Primary:** Commit Blue fill, a 1px Commit Blue Edge border, white Geist 600 text, and an optional leading 20px line icon. It is the docked "Log a meal" button and every sheet submit button.
- **Hover / Focus:** the primary lifts to accent-hover over 150ms; pressing it scales to 0.99. Focus is a 2px accent-edge outline with a 2px offset everywhere.
- **Disabled primary:** drops to raised fill, a strong seam border and muted text.
- **Secondary:** panel or raised fill, a 1px strong seam border and Geist 500–600 text. On hover only the border brightens, to muted. Examples are the dock's "Type", "Set targets" and "Use calories".
- **Icon buttons:** borderless and muted, 44px. On hover they get a raised fill and text colour. Icons are 1.5–2px line icons (lucide).
- **Destructive:** an icon button that stays muted until hover or focus, then turns Failure Red. It is never a filled red button.
- **Text action:** the toast's "Undo" is Geist 600 underlined at a 3px offset, and gets a panel fill on hover.

### Cards / Containers (Panel)
- **Corner Style:** 10px.
- **Background:** Graphite Panel on the dot-grid ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px seam all round. Header and footer are divided by 1px seam rules.
- **Internal Padding:** 12px body. The header is 0 12px at a 38px minimum, with a small-caps title on the left and mono meta (figures, a streak count, a count) on the right. The optional footer is 8px 12px in muted mono.

### Inputs / Fields
- **Style:** Graphite Well, 1px strong seam, 8px corners, 46px minimum height. The label above is in small caps. Numeric fields are set in mono with the unit right-aligned inside in muted mono. The protein field is 54px tall in Geist Mono 600 at 1.5rem, in protein blue.
- **Focus:** a 2px accent-edge outline at 0 offset, and the border turns accent-edge.
- **Checkbox:** a 20px well square with 5px corners. When checked it is Commit Blue with a white drawn tick.
- **Failure:** a block with a Failure Red tint (45% border, 8% wash) and Console White text.

### Navigation (Status line and Dock)
- **Status line:** a 28px mono row in muted 0.75rem, with the date on the left and streak status on the right. The streak status is led by a drawn 7px dot: a 1.5px muted ring while today is open, and filled protein blue once today's target is hit. The streak count is protein blue when it is live.
- **Dock:** fixed at the bottom, with a translucent ground, 12px blur and a 1px top seam. It holds the blue primary ("Log a meal", with a camera icon) and an outlined secondary ("Type", minimum width 84px). While a photo is analysed, the primary becomes a raised readout: a 36px thumbnail, the mono text "reading photo…", and a 3px track with a protein-blue segment travelling along one axis.

### Protein Panel (signature)
The display figure in protein blue sits over a 6px full-width protein bar. Below it is a mono definition list of three rows (kcal, carbs, fat). Each row has a label, a 4px mini bar in its data hue, the amount with "left" or "over" in muted text, and the "/target". The header meta shows "eaten / target g" next to a sliders icon for editing targets.

### Day Score (game layer)
The headline score is followed by a muted "so far". Below it are eight 44px bars on one shared 0–100 scale: seven finished days in a faint white (16%) on graph-0 tracks, and today drawn as an open outline (1px inset muted) with a Console White fill inset 2px, labelled "now". The 7-day average is a 1px dashed line at 70% Console White drawn across all bars, repeated as "7-day avg N" in the mono footer. Today is never averaged against finished days.

### Streak Graph (game layer)
A contribution graph of 12 weeks. Columns are weeks running left to right, rows are days with Monday at the top, cells are square with a 3px gap and 2px corners, and they step through graph-0 to graph-4. Today's cell gets a 1px Console White outline offset 1px. Future cells are empty 1px seam outlines. The header meta is "Nd streak", in protein blue when it is live. The footer reads "best Nd" and "next 21d · 3 to go", with the values in Console White 500. A streak counts today only once it is hit, so it never breaks mid-day.

### Regulars (signature)
These are bare photo tiles in a three-column grid, without frames or cards. Each tile has a 4:3 photo with 6px corners and a Geist name clamped to two lines. The caption row below has the protein figure in protein-blue mono on the left and a "1×" portion tab on the right: a 4px-cornered strong-seam outline in muted mono, which brightens on hover. Tapping the photo logs one portion. On hover the photo dims to 88%; when pressed it gets a 2px protein outline inset.

The portion picker is one flat surface laid over the tile. Its cells are divided by 1px strong-seam gaps, with no boxes inside boxes. A raised head row holds the small-caps title and a close cell; below it is a 2×2 grid of panel-filled portion cells in mono, each with its grams in muted. The default portion is in protein blue. The picker expands vertically from the top (scaleY 0.6 to 1 over 160ms).

### Today Log
A seam-divided list that runs flush to the panel edges. Each 52px row has the time in muted mono, the name in Geist (two lines, with the portion multiplier in muted), the protein in blue mono above the kcal in muted mono, and quiet 44px icon actions (save to regulars, delete).

### Toast
A single raised strip with 10px corners and a 1px strong seam, 48px tall, floating above the dock. It holds one line of Geist text and an underlined "Undo". It rises 8px while fading in over 180ms.

### Sheet
A bottom sheet built on the native dialog, 560px max and up to 90dvh. It has a panel fill, a 1px seam with no bottom border, and 14px top corners. The header is a 52px row with a seam rule, the title on the left and a 44px close button on the right. The backdrop is rgba(1, 4, 9, 0.7). The sheet slides up 32px while fading in over 220ms.

### Motion
- Numbers roll from the old value to the new one over 420ms with a cubic ease-out.
- Bars and score fills scale in place along one axis over 420ms on the ease-out curve cubic-bezier(0.16, 1, 0.3, 1).
- Graph cells change colour over 420ms.
- Panels and overlays expand or slide along one axis only: the picker on Y, the sheet on Y, the toast on Y.
- Under prefers-reduced-motion, rolls jump straight to the final value and every transition and animation collapses to 1ms.

## Do's and Don'ts

### Do:
- **Do** separate surfaces with 1px seams (seam #262c36) and convey depth only through ground, panel, raised and well tones.
- **Do** reserve Commit Blue (#1f6feb) for the single primary action in view and the checked checkbox.
- **Do** colour a figure by what it measures: protein #79c0ff, kcal #d2a8ff, carbs #e3b341, fat #7ee787.
- **Do** set figures, times and the status line in Geist Mono with tabular numerals, and everything else in Geist.
- **Do** set panel headers in muted all-small-caps at 0.8rem with +0.06em tracking.
- **Do** draw an unfinished day as unfinished, with "so far", an outlined "now" bar, and an open status ring.
- **Do** put every bar of a comparison on one shared scale, and draw references (such as an average) as dashed lines.
- **Do** animate change in place, rolling numbers and scaling bars over 420ms with ease-out, and honour reduced motion.
- **Do** keep every touch target at 44px, extending compact controls with an invisible hit area.

### Don't:
- **Don't** use drop shadows, glows or a second elevation step.
- **Don't** fill any button other than the primary action with blue, or use blue as decoration.
- **Don't** use danger red (#f85149) for intake, totals or "over" values. It is only for destructive hover and system failure.
- **Don't** set sentences, names or buttons in Geist Mono to look technical.
- **Don't** add confetti, mascots, stickers, levels, badges or guilt copy. A missed day is a dim cell, not a scolding.
- **Don't** break a streak mid-day or compare today's partial score against finished days as if it were complete.
- **Don't** frame regulars as cards, or nest boxes inside the portion picker.
- **Don't** use imagery other than the owner's meal photos.
