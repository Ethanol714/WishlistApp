---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/styles.css","public/app.js"]
---

# Wishlist main screen

Scope: the single-page Wishlist app (public/index.html, styles.css, app.js). Mode: Operate.
Audience and job: one owner on their Mac, in daytime light, collecting mostly Japanese and Chinese products and checking what the list costs in dollars, domestically or imported, and how to pay for it.
Constraints: light theme, saturated colors, classic typeface (owner's request). Plain HTML/CSS/JS, no build step.

## Direction contract

THESIS: Every item is costed the way a Tokyo electronics store prices a shelf: a bright yellow price card with the price in big red numerals, and its dollar cost beneath. Refuses the gray table with one blue accent.

OWN-WORLD: White shelf cards on a cool light-gray floor. Store blue #0A4EA2 header and register, POP yellow #FFE100 price cards, price red #E60012 numerals and sale bands, ink #111. A heavy Japanese mincho serif for prices and titles, a clean Japanese gothic for controls and labels. Flat color, crisp 1px edges, short soft shadows only on lifted cards.

STORY: The owner sees the dollar total at once, scans each item's price card, flips items between domestic and import, and reads off a monthly savings or payment amount.

FIRST VIEWPORT: Blue store header with the name, rate status and the add-link bar. Below, left: category tabs plus sort, then a grid of product cards, each with a photo plate, title, store, and a yellow price card (local price in red mincho numerals, USD below, sale band when discounted, Domestic/Import switch). Right: a sticky blue "register" column with the total, import extras, and the monthly plan.

FORM: Electronics-store price card (Bic Camera / Yodobashi POP), candidate 1 of my ordered list, chosen as Impeccable's pick. Seed key cbaae5be.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
