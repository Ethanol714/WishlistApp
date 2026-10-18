---
name: Wishlist
description: A personal wishlist priced like a Tokyo electronics-store shelf, in dollars.
colors:
  blue: "#0a4ea2"
  blue-deep: "#083b7b"
  blue-tint: "#e6eefa"
  blue-line: "#b9cdec"
  pop: "#ffe100"
  pop-deep: "#f2c700"
  pop-hover: "#ffea3d"
  pop-soft: "#fff6a6"
  pop-tint: "#fff8c2"
  red: "#e60012"
  red-ink: "#b3000e"
  red-tint: "#fde8ea"
  cn: "#c8102e"
  green: "#00813a"
  ink: "#14161a"
  ink-2: "#3f4652"
  ink-3: "#59606c"
  floor: "#edf0f5"
  shelf: "#ffffff"
  shelf-2: "#f6f8fb"
  line: "#d9dfe8"
  line-strong: "#c3cbd6"
typography:
  price:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  total:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  brand:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.3
  item-title:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
  usd:
    fontFamily: "Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, YuMincho, Noto Serif JP, serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  body:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Hiragino Sans, Yu Gothic, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  control:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Hiragino Sans, Yu Gothic, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.01em"
  label:
    fontFamily: "Zen Kaku Gothic New, Hiragino Kaku Gothic ProN, Hiragino Sans, Yu Gothic, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  badge: "4px"
  sm: "6px"
  md: "10px"
  dialog: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  card: "14px"
  lg: "16px"
  xl: "24px"
  shelf-row: "30px"
components:
  button-pop:
    backgroundColor: "{colors.pop}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    typography: "{typography.control}"
    padding: "0 16px"
    height: "38px"
  button-pop-hover:
    backgroundColor: "{colors.pop-hover}"
  button-blue:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.shelf}"
    rounded: "{rounded.sm}"
    typography: "{typography.control}"
    padding: "0 16px"
    height: "38px"
  button-blue-hover:
    backgroundColor: "{colors.blue-deep}"
  button-quiet:
    backgroundColor: "{colors.shelf}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    typography: "{typography.control}"
    padding: "0 16px"
    height: "38px"
  button-quiet-hover:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.blue}"
  tab:
    backgroundColor: "{colors.shelf}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shelf}"
  item-card:
    backgroundColor: "{colors.shelf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  price-card:
    backgroundColor: "{colors.pop}"
    textColor: "{colors.red}"
    rounded: "{rounded.sm}"
    typography: "{typography.price}"
    padding: "9px 12px 10px"
  sale-band:
    backgroundColor: "{colors.red}"
    textColor: "{colors.shelf}"
    typography: "{typography.label}"
    padding: "4px 10px"
  buyway-toggle:
    backgroundColor: "{colors.pop-soft}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    height: "30px"
  buyway-toggle-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shelf}"
  register-till:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.shelf}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
  register-total:
    backgroundColor: "{colors.pop}"
    textColor: "{colors.red}"
    rounded: "{rounded.sm}"
    typography: "{typography.total}"
    padding: "12px 12px 10px"
  field:
    backgroundColor: "{colors.shelf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "38px"
  tag:
    backgroundColor: "{colors.shelf-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.badge}"
    typography: "{typography.label}"
    padding: "0 8px"
    height: "22px"
  tag-high:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red-ink}"
  store-header:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.shelf}"
    padding: "18px 0 20px"
---

# Design System: Wishlist

## Overview

**Creative North Star: "The Shelf POP"**

Every wished-for thing is priced the way a Tokyo electronics store (Bic Camera, Yodobashi) prices a shelf: a white product card standing on a shelf rail, and under it a bright yellow POP price card with the price in big red mincho numerals and its dollar cost beneath. The app shell is the store itself: a store-blue header with a yellow shelf-edge stripe, and a store-blue "register" column that rings up the total on another yellow card. The look turns down the generic finance dashboard, a gray table with one blue accent.

The palette is saturated and flat: store blue, POP yellow and price red do the talking, on a cool light-gray floor with white shelf cards. Type pairs a heavy Japanese mincho serif for prices, titles and totals with a clean Japanese gothic for controls, labels and body text, so Japanese and Chinese product names read as native text. Every number uses tabular figures. Density is retail-shelf density: a grid of compact cards, each carrying a lot of information, organized by color blocks instead of whitespace.

Depth is minimal and physical: cards lift slightly off the floor with a short, soft, blue-tinted shadow and stand on a rail that runs the width of their row. Everything else is flat color with crisp 1px edges.

**Key Characteristics:**
- Light theme only: cool gray floor (#edf0f5 family), white shelf cards.
- Store blue frames the app; POP yellow carries price; red is reserved for price and sale.
- Heavy mincho (800) for money and titles, gothic for everything you operate.
- Flat fills, 1px edges, short soft shadows only on lifted cards and floating layers.
- Stroked line icons (2px stroke, round caps and joins), inline SVG.

## Colors

A three-color store palette (blue, yellow, red) at full saturation, set on cool blue-gray neutrals.

### Primary
- **Store Blue** (blue): the shell. Header band, the register's total card, editor dialog header, mobile total bar, the Buy and Save buttons, selected segmented-control buttons, links, store names on cards, the caret and the focus ring tint.
- **Store Blue Deep** (blue-deep): hover for blue buttons, the rates pill and bookmark panel inside the header, the till's border.
- **Blue Tint** (blue-tint) and **Blue Line** (blue-line): hover wash and hover border for quiet buttons, tabs and icon buttons.

### Secondary
- **POP Yellow** (pop): the price card, the register's total card, the primary "Add to wishlist" button, the 4px shelf-edge stripe under the header (3px on the mobile total bar and popup bar), text selection, and highlighted figures on blue.
- **POP Edge** (pop-deep): the 1px inset edge of the price card, the border of the yellow button, dividers inside the price card, warning borders.
- **POP Soft** (pop-soft): the unselected Domestic/Import toggle strip under each price. Its hover is #fff07a.
- **POP Hover** (pop-hover): hover fill for yellow buttons.
- **POP Tint** (pop-tint): warning surfaces only (notices, the editor alert, "Couldn't auto-update" tags, skeleton price cards).

### Tertiary
- **Price Red** (red): price numerals on the yellow card, the till total, the editor's USD figure, and the sale band. Also the JP country badge (the `--jp` token aliases this value).
- **Red Ink** (red-ink): error text, danger hover icon color, high-priority tag text.
- **Red Tint** (red-tint): danger hover wash and high-priority tag fill (border #f6c2c7).
- **China Red** (cn): the CN country badge, a deeper crimson than the JP red.
- **Savings Green** (green): price-drop badges and the "now" month in the plan timeline. On blue, savings and live status use the lighter #7ff0a6 and #5fe08f.

### Neutral
- **Ink** (ink): primary text, and the solid fill for selected tabs, the selected Domestic/Import half, and toasts. Never pure black.
- **Ink 2** (ink-2): secondary text, field labels, tag text.
- **Ink 3** (ink-3): tertiary text, placeholders, idle icon buttons, sort label.
- **Floor** (floor): page background, the cool gray the shelf stands on.
- **Shelf** (shelf): card, panel and field surfaces.
- **Shelf 2** (shelf-2): recessed fills such as segmented-control tracks, image placeholders, affix cells, the editor footer and plain tags.
- **Line** (line) and **Line Strong** (line-strong): 1px card and divider edges; control and field borders.
- On the blue till, secondary text steps through #dce7f7, #c9d7ec and #b9cbe6, and dividers are white at 28% alpha (dashed between receipt rows).

### Named Rules
**The Price Card Rule.** Full-strength POP yellow belongs to price: the item price card, the till's total, the one Add action, and the shelf-edge stripe. Warnings use POP Tint, never full yellow.

**The Red Is Money Rule.** Price red appears only on prices, sale bands and the JP badge. Errors and danger use Red Ink, so a red number always means a price.

**The Blue Shell Rule.** Store blue is the frame (header, register, dialog header, mobile bar) and the action color for Buy and Save. Selected states that sit on white or yellow use Ink, not blue.

## Typography

**Display Font:** Shippori Mincho B1 (with Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, serif)
**Body Font:** Zen Kaku Gothic New (with Hiragino Kaku Gothic ProN, Hiragino Sans, Yu Gothic, system-ui, sans-serif)

**Character:** A heavy, inky Japanese mincho gives prices and titles the weight of a printed store POP card; a quiet, even gothic handles every control. Both cover kana and kanji, so Japanese and Chinese product titles set in the same voice as English ones.

Both faces load from Google Fonts (`display=swap`, weights mincho 500/700/800, gothic 400/500/700). Self-hosting them is an open decision waiting on the owner; offline, the stacks fall back to Hiragino Mincho ProN and Hiragino Kaku Gothic ProN on the Mac. The Chrome extension popup can't load the CDN faces and uses the Hiragino-first system stacks with the same roles and weights.

### Hierarchy
- **Price** (mincho 800, 46px, line-height 1, -0.02em; 30px under 600px): the price numerals on each price card. The currency mark sets at 0.5em.
- **Total** (mincho 800, 32px, line-height 1): the till's USD total. The monthly figure on blue is 30px, the editor's USD figure and mobile total 22px.
- **Brand** (mincho 800, 26px, line-height 1, 0.01em; 22px on mobile): the Wishlist wordmark beside the yellow tag mark.
- **Headline** (mincho 800, 24px, line-height 1.25): empty-state heading. The dialog title is 20px.
- **Title** (mincho 800, 18px, line-height 1.3): register card titles ("Your total", "Paying for it").
- **Item title** (mincho 700, 15px, line-height 1.35, clamped to two lines; 14px on mobile): product names on cards.
- **USD** (mincho 700, 17px, line-height 1.2): the dollar cost on the price card.
- **Body** (gothic 400, 14px, line-height 1.5): running text and inputs; long copy max 62ch. The add-bar input is 16px.
- **Control** (gothic 700, 14px, 0.01em): button labels. Tabs are 500.
- **Label** (gothic 700, 12px): field labels, store names, tags, badges, sale band (0.04em), toggle labels. 12px is the floor for text in the app.

### Named Rules
**The Mincho Money Rule.** Any figure that is the point of its block (a price, a dollar cost, a total, a monthly amount) sets in mincho at 700 to 800. Small supporting figures (rates, landed costs, quantities) stay in gothic.

**The Tabular Rule.** `font-variant-numeric: tabular-nums` is set on body; every number in the system lines up.

## Layout

A centered wrap (max 1320px, 24px side padding; 16px under 860px). Under the full-bleed blue header, a two-column grid: the shelf (fluid) and the register (360px; 320px under 1080px), 24px gap (18px under 1080px), sticky at 16px from the top. Under 860px the register stacks below the shelf and a fixed blue mobile total bar with a 3px yellow top stripe appears at the bottom, with safe-area padding.

The shelf is an auto-fill grid of cards, minimum 232px wide, 30px row gap and 16px column gap so each row's rail has room. Under 600px it is a fixed two-column grid (26px by 10px gaps) and one column under 360px. Category tabs scroll horizontally on mobile instead of wrapping.

Spacing runs on small steps: 4, 6, 8, 10, 12, 14, 16, 18, 24px. Card internals use 12 to 14px (10px on mobile); register cards use 16 by 18px; gaps between inline controls are 6 to 8px. The editor dialog is min(800px, viewport minus 32px) with a 180px image column that collapses on mobile.

## Elevation & Depth

A hybrid: flat color blocks with 1px edges for structure, and short, soft, blue-tinted shadows only on things that physically lift off the floor (cards, the register cards, the add bar, the dialog, toasts). Shadows are tinted with dark navy, never neutral gray, except the add bar on blue.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgba(10,30,60,.06), 0 4px 14px rgba(10,30,60,.06)`): resting shelf cards, register cards, empty state.
- **Lift High** (`box-shadow: 0 2px 4px rgba(10,30,60,.08), 0 12px 28px rgba(10,30,60,.12)`): card hover and toasts.
- **Add Bar** (`box-shadow: 0 6px 20px rgba(0,0,0,.22)`): the white add-link bar floating on the blue header.
- **Dialog** (`box-shadow: 0 24px 60px rgba(6,30,70,.35)`, backdrop rgba(8,30,66,.5)): the item editor.
- **Price Card Edge** (`box-shadow: inset 0 0 0 1px #f2c700`): the price card's crisp edge, drawn inside so it never adds height.
- **Focus** (`box-shadow: 0 0 0 3px rgba(10,78,162,.35)`): the focus ring on everything; fields also switch their border to blue.

### Named Rules
**The Shelf Rail Rule.** Each item card stands on a rail that overhangs it by 9px on each side and runs 9px tall below it: a 4px white top face over #dde3ec, rounded 3px at the bottom corners, with a 1px #9eaabb lip and a soft 3px shadow. On mobile it shrinks to 6px overhang, 8px height, 3px top face. Cards in a row share a height, so their rails read as one continuous shelf.

**The Arrive Rule.** A newly added card flashes a 4px POP-yellow ring and settles from 4px up over 1.6s on cubic-bezier(.16,1,.3,1). All motion collapses under prefers-reduced-motion.

## Shapes

Gently rounded, retail-crisp rectangles. Containers (cards, register cards, notices, toasts, add bar) use 10px; controls and anything nested inside a container (buttons, fields, price card, total card, image placeholder) use 6px; small badges and tags use 4px (3px for the inner country code); the dialog uses 12px. Pills (999px) are reserved for category tabs, the rates indicator and store chips. Edges are always 1px solid lines; dashed lines appear only between receipt rows and timeline rows, like a printed receipt.

The brand mark is a yellow price tag (a pointed tag with a punched hole), drawn the same in the header, favicon and popup.

## Components

### Buttons
Solid, compact and confident; bold gothic labels, a 1px press-down on :active.
- **Shape:** 6px corners, 38px minimum height, 16px side padding, 7px gap to a 17px stroked icon.
- **Yellow (Add):** POP yellow with a POP Edge border and ink label. Reserved for adding to the wishlist; in the header it grows to 46px tall, 22px padding, 15px label.
- **Blue (Buy, Save):** store blue with white label; hover deepens to Store Blue Deep.
- **Quiet:** white with Line Strong border and Ink 2 label; hover turns border Blue Line, text blue, fill Blue Tint.
- **Icon button:** 34px square, transparent, Ink 3 icon; hover Blue Tint and blue. The danger variant hovers Red Tint with Red Ink.
- **Disabled:** 55% opacity with a progress cursor.

### Price Card (signature)
The POP card under each product. POP yellow, 6px corners, 1px inset POP Edge, set 14px in from the card sides and pushed to the card bottom.
- **Sale band** (when discounted): full-width Price Red strip on top, white bold 12px "SALE −n%" with the struck original price at right.
- **Price:** red mincho numerals at the Price role, quantity "× n" in gothic beside it.
- **USD line:** the dollar cost in mincho 700 17px ink, with the exchange rate small at right.
- **Price-drop badge:** green, 3px corners, white 12px bold with a down arrow.
- **Domestic/Import toggle:** a two-cell strip in POP Soft divided by POP Edge lines; the active half fills Ink with white text.
- **Landed line:** a white strip under the toggle for import items, "+$x import, est." and "≈ $y landed".
- **Empty:** "Price needed" in mincho 800 18px with a small quiet "Add price" button.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Shelf white on the Floor.
- **Shadow Strategy:** Lift at rest, Lift High on hover, plus the shelf rail (see Elevation).
- **Border:** 1px Line, Line Strong on hover.
- **Internal Padding:** square image plate (14px padding, contain-fit) on top, info block 12 by 14px, footer 12 by 14px with quantity stepper, blue Buy button and icon buttons. Overlaid at the top corners: a white country flag badge (JP or CN code on red) and the include-in-total checkbox.
- **Excluded items** fade the plate and info to 45% and turn the price card grayscale at 60%.

### Register
The right column, ringing up the list like a store till.
- **Till card:** store-blue fill, Store Blue Deep border, white text; receipt rows divided by dashed white lines; the total sits on its own yellow card with red mincho figures; the monthly plan reads out in 30px white mincho with yellow highlights.
- **Plan and import cards:** white register cards with mincho titles, segmented controls and fields. The import card is a disclosure with a rotating chevron drawn in CSS.

### Chips and Tabs
- **Category tabs:** 34px pills, white with Line Strong border and Ink 2 label; hover blue; selected fills Ink with white label and a yellow count.
- **Tags:** 22px, 4px corners, Shelf 2 fill, Line border, 12px bold Ink 2. High priority uses Red Tint and Red Ink; warnings use POP Tint with POP Edge.
- **Store chips** (empty state): 32px pills on Shelf 2 with a red or crimson country-code capsule.

### Inputs / Fields
- **Style:** 38px tall, white, 1px Line Strong border, 6px corners, 10px side padding; label above in 12px bold Ink 2.
- **Affix fields:** "$", "% APY", "% APR" cells in Shelf 2 fused to the input inside one bordered box.
- **Focus:** border turns Store Blue and the 3px blue focus ring appears (on the whole affix box via :focus-within).
- **Segmented control:** Shelf 2 track with 3px padding and 8px corners; selected button fills Store Blue with white text, 5px corners.

### Navigation
- **Store header:** full-bleed Store Blue band ending in a 4px POP-yellow shelf-edge stripe. Brand at left, a pill rates indicator at right (dot: gray loading, green live, yellow stale), the white add-link bar below, and underlined white text links under it whose underline turns yellow on hover.
- **Mobile:** the header stacks the add bar vertically; the fixed bottom total bar repeats the shell (blue, 3px yellow top stripe, yellow mincho total).

### Toasts and Dialog
- **Toasts:** centered at the bottom, Ink fill, white 500 text, 10px corners, Lift High, a colored status dot (green ok, yellow warn, #ff6b75 error), rising in over .25s.
- **Editor dialog:** 12px corners, store-blue header with a 20px mincho title and white close button, white body, Shelf 2 footer holding Quiet Cancel and Blue Save.

## Do's and Don'ts

### Do:
- **Do** set every price on a POP-yellow card in red mincho 800 numerals, with its USD cost beneath in ink mincho.
- **Do** keep red-on-yellow numerals at display size (24px and up, weight 800); smaller copy on yellow is Ink or Ink 2.
- **Do** frame new surfaces in the store shell: Store Blue band, 4px (3px when compact) POP-yellow shelf-edge stripe, white shelf cards on the cool gray Floor.
- **Do** use the gothic for every control, label and body line, and the mincho for prices, totals and titles.
- **Do** use 10px corners for containers, 6px for anything inside them, 4px for badges, pills only for tabs, chips and status.
- **Do** draw icons as inline stroked SVG (2px stroke, round caps and joins, about 17px in buttons).
- **Do** carry selected states on white or yellow as solid Ink fills, and focus as the 3px blue ring.

### Don't:
- **Don't** fall back to a gray table with one blue accent; the list is a shelf of priced cards.
- **Don't** introduce a dark theme or desaturate the palette; the owner asked for a light theme with saturated color.
- **Don't** use full POP yellow for warnings or decoration; warnings get POP Tint.
- **Don't** use Price Red for errors or destructive actions; those use Red Ink.
- **Don't** set prices or totals in the gothic or in a system sans.
- **Don't** use neutral gray or hard offset shadows on cards; lift is short, soft and navy-tinted.
