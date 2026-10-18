# WishlistApp

One wishlist for every online store. Paste a product link from any shop, and the app pulls in the
picture, name, store, price and any sale discount. Foreign prices are converted to US dollars at
the day's exchange rate, and a planner works out how much to save (or pay) each month to buy
everything.

## Run it

Needs only Python 3 (already on every Mac). Nothing to install.

```bash
python3 server.py --open
```

Or double-click **Start Wishlist.command** in Finder. The app runs at http://localhost:8080.
Your list is saved in `data/wishlist.json` (kept out of git).

## Features

- **Add any link:** product image, title, store, price, currency and a Buy link back to the original page.
- **Discounts:** shows the original price struck through with the % off when a store lists one,
  and flags price drops since you added an item.
- **Currencies:** every price is converted to USD using daily rates from
  [ExchangeRate-API](https://www.exchangerate-api.com) (falls back to the ECB via Frankfurter).
- **Categories and priorities:** group items like PCPartPicker's parts list, and untick an item to leave it out of the total.
- **Refresh prices:** re-check one item or the whole list for price changes.
- **Savings plan:** pick a target month (or a monthly budget), how much you've saved and your
  savings APY to get the monthly amount and when you can afford each item.
- **Financing:** enter a down payment, APR and term to get the monthly payment, total interest and payoff schedule.

## Stores that block lookups

Some big retailers (Best Buy, Amazon outside the US, Newegg, Argos…) block automated requests, and
some load prices with JavaScript. For those, open **"Store blocking lookups?"** in the app and drag
the **＋ Add to Wishlist** button to your bookmarks bar. Clicking it on any product page sends that
page, as your browser shows it, to the app. You can always edit an item and type the price in by hand.

## How it works

- `server.py`: local web server and JSON API (Python standard library only)
- `wishlist/scraper.py`: reads product data from Amazon and Shopify pages, schema.org JSON-LD,
  Open Graph/product meta tags, microdata and visible price elements
- `wishlist/rates.py`: daily USD exchange rates, cached in `data/rates.json`
- `public/`: the web app (HTML, CSS, vanilla JavaScript)
