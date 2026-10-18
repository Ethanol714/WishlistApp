# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person (the owner), using it on their own Mac. They collect things they want to buy, mostly Chinese and Japanese products (electronics, games, digital works, collectibles), and work out what the whole list will cost and how to pay for it.

## Product Purpose

A single wishlist across every online store. Pasting a product link pulls in the product's picture, name, store, price, currency and any sale discount, and links back to the original page. Prices in foreign currencies are converted to US dollars at the day's exchange rate. A planner turns the list's total into a monthly savings amount or a financing payment. Success: the owner can see, at a glance, what everything costs in dollars and when they can afford it.

## Positioning

Built around Japanese and Chinese stores (Bic Camera, DLsite, Taobao, Tmall, JD and similar) as first-class vendors rather than an afterthought to US retailers. Each item can be costed as a domestic purchase (in Japan or China, at the store's own price) or as an import (store price plus shipping, proxy or forwarding fees and duty).

## Operating Context

- Runs locally (`python3 server.py`, http://localhost:8080); data stays on the owner's machine in `data/wishlist.json`.
- Items are added by pasting links, by a browser bookmarklet for stores that block automated lookups, or by hand.
- Exchange rates refresh daily from ExchangeRate-API (ECB/Frankfurter fallback).
- Many big stores block automated requests; manual entry is a normal path, not an error state.

## Capabilities and Constraints

- Python standard library backend, plain HTML/CSS/vanilla JS frontend, no build step, no Node.js on the machine.
- Per item: image, title, store, price, original price (discount), currency, quantity, category, priority, notes, include-in-total toggle, price history, domestic/import choice.
- Planner: save by target month or by monthly budget, with savings APY; or finance with down payment, APR and term.
- Open decision: default import cost assumptions (shipping, proxy fee, duty) are estimates the owner edits; the app must not present them as quotes.

## Brand Commitments

Name: Wishlist. Look, in the owner's words: "more neutral" with "a persona 3 theme", specifically Persona 3 Reload, light theme, Persona-style sans type (replacing an earlier store-flyer look they found too Best Buy-like). Evoke the game's UI language only: no logos, character art or game assets.

## Evidence on Hand

No real wishlist data is committed. Product names, prices and images come from the stores at runtime; nothing may be invented as a real price.

## Product Principles

- Every number traces back to a store page, an exchange rate or the owner's own input.
- Japanese and Chinese stores get first-class support, including their own currencies and languages in titles.
- Missing data is fixable in one step (edit the price), never a dead end.
- The total and the monthly plan are always visible and always current.
