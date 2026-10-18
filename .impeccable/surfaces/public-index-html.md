---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/styles.css","public/app.js","extension/popup.css"]
---

# Wishlist main screen

Scope: the single-page Wishlist app (public/index.html, styles.css, app.js) and the Chrome extension popup. Mode: Operate.
Audience and job: one owner on their Mac, in daytime light, collecting mostly Japanese and Chinese products and checking what the list costs in dollars, domestically or imported, and how to pay for it.
Constraints (owner's words): more neutral than the previous store look; a Persona 3 theme, specifically P3 Reload; light theme; Persona-style sans type. Evoke the game's UI language only: no logos, character art, or game assets. Plain HTML/CSS/JS, no build step, fonts self-hosted.

## Direction contract

THESIS: The wishlist read like Persona 3 Reload's menus by moonlight: slanted panels, a calendar block that marks the day, and prices set in heavy italic numerals. Refuses the store-flyer yellow and red, and the generic gray dashboard.

OWN-WORLD: Pale moonlit ground (#eef3fa) with white panels, deep navy ink (#0b1a3a), Reload blue (#1f5fff) for action and selection, and moonlight cyan (#2fd3ff) for highlights and sales. Neutral everywhere else. Barlow Condensed heavy italic for numerals, headings and tabs; Barlow for text; Zen Kaku Gothic New for Japanese and Chinese. A fixed -12° slant on tabs, headers, selection bars and the price band; panels stay square to the grid.

STORY: The owner opens the app, sees today's date block with the moon phase and rate, scans cards whose prices sit on slanted navy bands, flips items between domestic and import, and reads the total and monthly plan from the status panel.

FIRST VIEWPORT: Top: a white header with the wordmark, the add-link bar, and on the right a slanted calendar block (month/day in big italic numerals, weekday, today's moon phase, $1 = ¥ / CN¥). Below, left: slanted category tabs plus sort, then a grid of item cards (photo plate, store label on a slanted navy tag, title, price on a slanted navy band with cyan sale marker, USD below, Domestic/Import slanted switch). Right: a sticky status panel with a navy slanted header, receipt rows, the total in big italic numerals, the monthly plan.

FORM: Persona 3 Reload menu language, pinned by the owner (no roll; a pinned direction beats the roll).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
