---
name: Wishlist
description: A personal wishlist read like Persona 3 Reload's menus by moonlight, priced in dollars.
colors:
  ground: "#eef3fa"
  ground-2: "#e2eaf5"
  panel: "#ffffff"
  panel-2: "#f5f8fd"
  line: "#d6dfec"
  line-strong: "#b9c6d9"
  ink: "#0b1a3a"
  ink-2: "#34446a"
  ink-3: "#56658a"
  on-navy: "#ffffff"
  on-navy-2: "#b9c8ea"
  navy: "#0b1a3a"
  blue: "#1f5fff"
  blue-deep: "#1747c9"
  blue-tint: "#e6eeff"
  cyan: "#2fd3ff"
  cyan-tint: "#ddf6ff"
  cyan-line: "#9fe3f7"
  cyan-ink: "#006f8f"
  danger: "#c42a43"
  danger-tint: "#fde9ec"
typography:
  display:
    fontFamily: "Barlow Condensed, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, sans-serif"
    fontSize: "78px"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Condensed, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
  title:
    fontFamily: "Barlow Condensed, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.05em"
  body:
    fontFamily: "Barlow, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Hiragino Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow Condensed, Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  none: "0px"
  tag: "2px"
  r: "4px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  gutter: "28px"
components:
  button-go:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "38px"
  button-go-hover:
    backgroundColor: "{colors.blue-deep}"
  button-quiet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "38px"
  tab:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "34px"
  tab-selected:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.r}"
  price-band:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.none}"
    padding: "10px 18px 10px 16px"
  panel-header:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "9px 26px 8px 22px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0 10px"
    height: "38px"
  tag:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: "22px"
---

# Design System: Wishlist

## Overview

**Creative North Star: "The Moonlit Menu"**

The wishlist reads like Persona 3 Reload's menus at night, transposed to a light theme: a pale moonlit ground, white panels square to the grid, deep navy ink, and a single fixed slant (-12°) that every active surface shares. Tabs, buttons, store flags, panel headers, the price band and the calendar block all lean the same way; their labels are set back upright inside them. Numbers are the heroes, set in heavy italic condensed numerals.

The palette is neutral by design (the owner asked for "more neutral"): navy and white carry the structure, Reload blue carries action, and moonlight cyan is reserved for what is selected or worth noticing. The world evokes the game's UI language only; it uses no logos, characters or game assets.

Density is a working tool's density: a card grid on the left, a sticky status panel on the right, the total and monthly plan always in view.

**Key Characteristics:**
- One slant, -12°, shared by every interactive or heading plane; panels and cards stay upright.
- Navy slanted bands carry prices and headers; heavy italic Barlow Condensed numerals sit on them.
- Cyan marks selection and signal only, never decoration.
- One layered device: the calendar's Reload-blue back plane.
- Flat white panels with soft navy-tinted lift; square, unrounded slanted shapes.

## Colors

A cool, neutral moonlit palette: navy and white structure, one action blue, one signal cyan.

### Primary
- **Reload Blue** (blue): primary action (Add to Wishlist, Buy), links, focus ring, caret, spinner, the plan's monthly figure, and the calendar's back plane. Hover deepens to **Reload Blue Deep** (blue-deep). **Blue Wash** (blue-tint) backs icon-button hover and the high-priority tag.

### Secondary
- **Moonlight Cyan** (cyan): selection fills (category tabs, plan segments, Domestic/Import), the USD line on the price band, sale and price-drop markers, currency signs, the live-rate dot, and small marks (wordmark dash, country codes on store flags and chips, toast marker, text selection). **Cyan Wash** (cyan-tint) with **Cyan Edge** (cyan-line) backs notices and alerts; **Deep Cyan** (cyan-ink) is the legible cyan for text on light ground (savings, current month).

### Neutral
- **Midnight Navy** (navy, also ink): price bands, panel headers, store flags, the calendar block, toasts, the mobile total bar, and all primary text.
- **Dusk Ink** (ink-2) and **Mist Ink** (ink-3): secondary and tertiary text, labels, counts, hints.
- **Moonlit Ground** (ground) and **Ground Shade** (ground-2): page background and skeleton fills.
- **Panel White** (panel) and **Panel Mist** (panel-2): cards, panels, inactive segments, readouts and tags.
- **Hairline** (line) and **Strong Hairline** (line-strong): dividers, card borders, input and inactive-tab strokes.
- **On-Navy** (on-navy) and **On-Navy Muted** (on-navy-2): primary and secondary text on navy.
- **Danger** (danger, danger-tint): delete hover and editor errors only.

### Named Rules
**The Signal Cyan Rule.** Cyan appears only as a selection fill, a price signal (USD line, sale, drop, currency sign), the live-rate dot, or a small mark. There are no decorative cyan planes.

**The Neutral Ground Rule.** Everything that is not action, selection or price signal stays navy, white or blue-gray. No store-flyer yellow or red.

## Typography

**Display Font:** Barlow Condensed (with Zen Kaku Gothic New, then Hiragino Kaku Gothic ProN)
**Body Font:** Barlow (with Zen Kaku Gothic New, Hiragino, system-ui)
**CJK:** Zen Kaku Gothic New, self-hosted in the app; the extension popup falls back to Hiragino.

**Character:** A Persona-style condensed sans in heavy italic for numerals and headings, against a plain, legible Barlow for titles and prose. All fonts are self-hosted for offline use. Numerals are tabular throughout.

### Hierarchy
- **Display** (800 italic, 78px, 0.85): the calendar date only (54px on mobile).
- **Headline** (800 italic, 42-44px, 1): the price on each band and the list total (30px price on mobile); readout figures at 34px.
- **Title** (800 italic, 22-24px, 1, 0.05em, uppercase): panel headers, editor heading, empty-state heading (34px).
- **Body** (400-600, 15px, 1.5): item titles (600, 15px/1.35, two-line clamp), receipt rows, prose to 62ch; small print at 12-13px.
- **Label** (700, 13-16px, 0.05-0.07em, uppercase, Barlow Condensed): tabs, buttons, segments, field labels, store flags, sort.

### Named Rules
**The Italic Numeral Rule.** Money and dates are set in Barlow Condensed 800 italic; prose and product titles never are.

## Layout

A centered wrap (max 1320px, 24px side padding, 16px under 860px). The header is a white band with the wordmark and add-link bar on the left and the calendar block on the right. Below, a two-column grid: the card shelf (auto-fill, min 236px columns, 20px by 18px gaps) and a 360px sticky status panel (320px under 1080px), 28px gutter. Under 860px the panel drops below the shelf and a fixed navy total bar appears at the bottom; under 600px the grid becomes two columns (one under 360px), tabs scroll horizontally and the add bar stacks. Spacing runs in a loose 6 / 10 / 14 / 18 / 24 / 28 rhythm.

## Elevation & Depth

Mostly flat: white panels sit on the moonlit ground with a soft navy-tinted lift, deepening on hover. Depth in the world comes from stacked slanted planes, not shadows.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgba(11,26,58,.06), 0 6px 18px rgba(11,26,58,.07)`): cards, status panels, empty state at rest.
- **Lift High** (`box-shadow: 0 2px 4px rgba(11,26,58,.08), 0 14px 32px rgba(11,26,58,.13)`): card hover, toasts, new-item arrival.
- **Dialog** (`box-shadow: 0 24px 60px rgba(11,26,58,.3)`): the item editor, over a navy 45% backdrop.

### Named Rules
**The One Back Plane Rule.** The only layered plane is the calendar's: a Reload-blue blade at skewX(-24deg) behind the navy -12° panel, on its right half only, jutting past the right edge. Do not repeat the device elsewhere.

## Shapes

Two shape families. Slanted planes (buttons, tabs, segments, flags, headers, price band, calendar, toast marker) are square-cornered and skewed -12°, with their content counter-skewed upright. Upright containers (cards, panels, inputs, selects, image plates) keep a small 4px radius; tags use 2px. Selected states trade the 1px hairline for a 2px navy inset stroke.

**The One Slant Rule.** Every slanted element uses exactly -12° (the calendar back plane's -24° is the sole exception). Panels and cards never lean.

## Components

### Buttons
- **Shape:** slanted -12°, square corners, 38px tall (48px in the add bar), label upright.
- **Primary (Go):** Reload blue, white Barlow Condensed 700 uppercase label; hover deepens to blue-deep.
- **Quiet:** white with a strong-hairline inset; hover turns label and stroke blue.
- **Icon buttons:** 34px, 4px radius, transparent; hover gets blue wash (danger wash for delete).
- **Focus:** a 3px Reload-blue ring at 35%.

### Tabs and Segments
- **Style:** slanted, white or panel-mist, strong-hairline inset, uppercase condensed labels with a Barlow count.
- **Selected:** cyan fill behind a 2px navy inset stroke, navy label. On the owner's click the cyan bar sweeps in from the left (scaleX, 0.34s cubic-bezier(.16,1,.3,1)); it never sweeps on load.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** panel white, hairline border, Lift shadow (Lift High on hover).
- **Contents:** square photo plate, a navy slanted store flag (cyan country code) at top left, include checkbox at top right, title and tags, then the price band, the Domestic/Import switch, and a footer of qty, Buy and icon actions.
- **Arrival:** a new item slides in along the slant (translateX -24px with skewX -6deg, 1.4s).

### Price Band (signature)
A navy -12° band holding the price in heavy italic numerals with a cyan currency sign, the USD line in cyan italic below, a "was" price above, a cyan sale marker overhanging the top right, and a cyan price-drop chip. Missing prices become a dashed panel-mist slot with a one-step fix button.

### Calendar Block (signature)
A navy -12° panel in the header: month/day in 78px italic numerals, weekday and moon phase in cyan, and the day's rate with a dot that turns cyan when rates are live. Backed by the Reload-blue plane described in Elevation.

### Panel Headers
Navy slanted plates with italic uppercase titles, hung off the top-left edge of status panels and the editor.

### Inputs / Fields
- **Style:** 38px, white, strong-hairline 1px border, 4px radius; labels above in uppercase condensed 700.
- **Focus:** border turns Reload blue with the focus ring. Affixed inputs carry a panel-mist unit cell.
- **Add bar:** a 2px navy frame with the slanted Go button bleeding off its right edge.

### Chips and Tags
- **Tags:** 22px, 2px radius, panel-mist with hairline; high priority in blue wash, warnings in cyan wash.
- **Store chips:** panel-mist chip with a navy cell carrying the cyan country code.

### Toasts
Navy bar, bottom center, rising in at 0.25s, led by a small slanted cyan marker.

## Do's and Don'ts

### Do:
- **Do** slant every new tab, button, flag, header or band at exactly -12° and counter-skew its content upright.
- **Do** set money and dates in Barlow Condensed 800 italic with tabular numerals.
- **Do** keep cyan to selection, price signals, the live-rate dot and small marks.
- **Do** run the selection sweep only in response to the owner's click, and honor prefers-reduced-motion.
- **Do** keep fonts self-hosted so the app works offline.

### Don't:
- **Don't** use Persona logos, character art or game assets; evoke the UI language only.
- **Don't** lay down decorative cyan planes or fills.
- **Don't** repeat the calendar's stacked back plane on other components.
- **Don't** reintroduce the store-flyer yellow and red palette.
- **Don't** slant cards, panels or image plates.
