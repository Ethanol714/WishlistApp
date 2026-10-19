# WishlistApp

One wishlist for every online store. Paste a product link from any shop, and the app pulls in the
picture, name, store, price and any sale discount. Foreign prices are converted to US dollars at
the day's exchange rate, and a planner works out how much to save (or pay) each month to buy
everything.

## Desktop app (Mac and Windows)

Download from the [Releases page](https://github.com/Ethanol714/WishlistApp/releases):

- **Mac:** `Wishlist.dmg`. Double-click it, then drag the Wishlist icon onto the Applications
  folder in the window that opens. Open Wishlist from Applications (or Launchpad). The first time
  only, if your Mac says it can't check Wishlist, open **System Settings → Privacy & Security**,
  scroll down and click **Open Anyway** (the app isn't notarized by Apple).
- **Windows:** `Wishlist-Windows.exe`. Double-click to run. If Windows SmartScreen warns about an
  unrecognized app, click **More info** → **Run anyway**.

To add items from any store, click **Get the Chrome extension** at the top of the app and follow
the five steps; the app opens the right folder and the right Chrome page for you.

Items you add with the extension show up in the app by themselves within a few seconds. To pull the
latest list right away, click **Reload list** at the top (or press ⌘R / Ctrl+R).

The desktop app is the same Wishlist in its own window. While the window is open it serves your list on
http://localhost:8080, so the Chrome extension and the bookmark button add items to it directly.
Your list is stored in `~/Library/Application Support/Wishlist` (Mac) or `%APPDATA%\Wishlist`
(Windows), shared with `python3 server.py`.

Build it yourself with `pip install pyinstaller pywebview` and `pyinstaller wishlist.spec`
(output in `dist/`), or run the **Build desktop apps** workflow on GitHub, which builds both.

## Run it from source

Needs only Python 3 (already on every Mac). Nothing to install.

```bash
python3 server.py --open
```

Or double-click **Start Wishlist.command** in Finder. The app runs at http://localhost:8080.
Your list is saved in your per-user app folder (see above), not in the project.

## Features

- **Add any link:** product photo, title, store, price, currency and a Buy link back to the original page.
- **Look:** a light, Persona 3 Reload-inspired design: slanted navy price bands, condensed italic numerals and a calendar block with today's moon phase and exchange rate.
- **Sales:** a cyan tag shows the % off and the regular price when a store lists one; items that got
  cheaper since you added them are flagged.
- **Domestic or Import:** for Japanese and Chinese items, choose per item whether you'll buy it
  domestically (store price only) or import it (adds your estimates for shipping, proxy/service fee
  and duty). Set the estimates under **Import cost estimates**.
- **Currencies:** every price is converted to USD using daily rates from
  [ExchangeRate-API](https://www.exchangerate-api.com) (falls back to the ECB via Frankfurter).
  Yen shows as ¥ and yuan as CN¥.
- **Categories, priorities, sorting:** filter by category tabs, sort by price, priority or store, and
  untick an item to leave it out of the total.
- **Refresh prices:** re-check one item or the whole list for price changes.
- **Savings plan:** pick a target month (or a monthly budget), how much you've saved and your
  savings APY to get the monthly amount and the month you can afford each item.
- **Financing:** enter a down payment, APR and term to get the monthly payment and total interest.

## Japanese and Chinese stores

| Store | What the app does |
|---|---|
| DLsite | Reads DLsite's own product feed: sale price, regular price and cover image |
| Toranoana, Mandarake, Hobby Search, BOOTH, Rakuten, Yahoo! Shopping and others | Reads the product page directly |
| JD.com | Reads the title and photo; JD hides prices from signed-out visitors, so use the bookmark button while signed in or type the price |
| Taobao, Tmall, 1688, Pinduoduo, Xianyu | Only show products to signed-in shoppers: use the bookmark button |
| Bic Camera, Yodobashi, Amazon Japan, Mercari, Suruga-ya, AmiAmi, Melonbooks, animate | Block automated lookups: use the bookmark button (prices, sale prices and photos are then read from the page) |

The full list lives in `wishlist/vendors.py`.

## The Chrome extension (recommended)

The `extension/` folder is a Chrome extension that adds any product page to your list, including
stores that block automatic lookups (Bic Camera, Yodobashi, Amazon Japan, Mercari) and stores that
only show prices when you're signed in (Taobao, Tmall, JD).

Install it once:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension` folder inside this project.
4. Pin the Wishlist icon (navy tile, cyan slash) from the puzzle-piece menu so it stays on your toolbar.

Then, with the Wishlist app running, open a product page and click the icon. It scans the page as
your browser shows it, and shows the photo, store, price, sale and dollar amount, all editable.
Choose Domestic or Import and click **Add to my wishlist**. If the item is already on your list,
it updates it instead.

## The bookmark button

Open **"Bookmark button for stores that block lookups"** in the app and drag the **Add to Wishlist**
button to your bookmarks bar. Clicking it on any product page sends that page, as your browser shows
it (signed in, prices loaded), to the app. You can always edit an item and type the price in by hand.

## How it works

- `server.py`: local web server and JSON API (Python standard library only)
- `desktop.py` and `wishlist.spec`: the desktop app (pywebview window around the server) and its PyInstaller build
- `.github/workflows/build.yml`: builds Wishlist.exe and Wishlist.app and publishes releases
- `wishlist/scraper.py`: reads product data from Amazon and Shopify pages, schema.org JSON-LD,
  Open Graph/product meta tags, microdata and visible price elements
- `wishlist/vendors.py` and `wishlist/asia.py`: Japanese and Chinese store registry and readers
- `wishlist/rates.py`: daily USD exchange rates, cached in `data/rates.json`
- `public/`: the web app (HTML, CSS, vanilla JavaScript)
- `public/fonts/`: Barlow, Barlow Condensed and Zen Kaku Gothic New (for Japanese and Chinese), bundled so the app looks right offline (SIL Open Font License, license files included)
- `extension/`: the Chrome extension (Manifest V3; talks to the app at http://localhost:8080)
