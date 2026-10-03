---
site: offhand
slug: sync-supplier-stock-with-shopify
title: How to sync supplier stock with Shopify: 5 ways compared
description: Five honest ways to keep Shopify stock and prices in sync with a supplier feed: manual CSV, Shopify Flow, feed-sync apps, your own script, and Offhand. What each one does and where it breaks.
keyword: how to sync supplier stock with Shopify
intent: informational / comparison
date: 2026-10-04
---

If you resell products you do not hold yourself, the count that matters is the supplier's, not yours. When the supplier sells the last unit and your Shopify store still shows "In stock", you take an order you cannot fill. This guide covers the five realistic ways to keep a Shopify store in sync with a supplier's stock and price feed, what each one actually does, and where each one tends to break.

## What "syncing" really means

A supplier sync is four small jobs, and tools differ in how many of them they do:

1. **Match** each supplier row to a Shopify variant, almost always by SKU.
2. **Update stock** (the `available` quantity at a location).
3. **Update price** when the supplier's price moves.
4. **Change visibility**: hide or draft a product at zero stock, and bring it back when stock returns. Optionally also **create** products that do not exist yet.

If a tool only does job 2, you still have to deal with 3 and 4 yourself.

## 1. Manual CSV import

Download the supplier's file, fix the columns, upload it to Shopify. It costs nothing and is fine for a handful of SKUs that change rarely. It stops working the day you forget a week, or the supplier renames a column and the import silently skips rows. Nothing is automatic, so stock drifts the moment you stop doing it.

## 2. Shopify Flow for hiding out-of-stock products

Shopify's own automation tool, [Shopify Flow](https://help.shopify.com/en/manual/products/inventory/getting-started-with-inventory/hide-out-of-stock), can unpublish a product when its inventory reaches zero and republish it when stock comes back. This is the right tool for the visibility job. It does not read your supplier's feed. Flow reacts to inventory changes that already happened inside Shopify, so something else still has to write the supplier's numbers into Shopify first.

## 3. A feed-sync app from the Shopify App Store

This is the mainstream answer. Apps such as [Simple CSV](https://simplecsv.com/guides/how-to-sync-supplier-product-feed-shopify), [EZ Inventory](https://apps.shopify.com/ez-inventory), [Simple Inventory Sync](https://apps.shopify.com/simple-inventory), [Synkro](https://synkro-app.com/documentation/external-inventory-feeds) and [syncX: Stock Sync](https://www.syncx.com/blog/sync-shopify-supplier-automation) read a supplier file from a URL, FTP/SFTP or cloud storage, let you map columns once (SKU and quantity at minimum), and run on a schedule. Several also handle prices, multiple suppliers, markup rules and more file formats than a plain CSV.

Pick one of these if you have many suppliers, need FTP/SFTP, need XML, need multi-location rules, or want hourly schedules. Check each app's current plan limits (SKU count, number of feeds, schedule frequency) on its own page, because they differ and change.

One rule worth copying from every good guide: **do not let a sync zero out products just because a SKU is missing from the feed.** A truncated or failed download should never wipe your catalog. Whatever you use, test what happens when the feed is empty or missing rows.

## 4. Your own script against the Admin API

If you are a developer, the Shopify Admin GraphQL API has `inventorySetQuantities` for stock and `productSet` for creating and updating products. A scheduled job that fetches a CSV, compares it with Shopify and writes only the differences is a few hundred lines. You get complete control. You also own retries, idempotency, token refresh, error handling and the day the API version changes. Reasonable if syncing is core to your business, expensive if it is a side task.

## 5. Offhand: a narrow, fixed-rule version of the same loop

[Offhand](https://offhand.nyttolabs.com) is our small tool for exactly one pattern: a resale store whose shelf should follow a supplier feed with no approval step. It is deliberately narrow, so read the limits before you consider it.

What it does, from the code that runs it:

- Reads a **public HTTPS feed** (CSV or JSON; a published Google Sheet works) or, if you leave the feed blank, follows the built-in demo catalog. Columns are detected: it needs a SKU, a title, and a price or a cost.
- **Lists** a product when the supplier has stock and the SKU is not on your shelf.
- **Reprices** when the supplier price changes. (If the feed has only a cost column, it lists at twice the cost.)
- **Updates stock** when the supplier count changes.
- **Pulls** the listing (sets it to Draft with stock 0) when the supplier hits zero, and **relists** it when stock returns.
- Never asks you to approve a listing. It only touches SKUs that appear in the feed.

What it does not do: it does not forward orders to your supplier, it does not upload product images, every product is a single variant, it writes stock to your store's first location, and on the hosted plan it syncs once a day (and again while your Offhand page is open). It costs $29 for 30 days for one store, as a one-time payment, not a subscription. If you need hourly sync, FTP, XML, many suppliers or order routing, use one of the apps in option 3.

You can watch the same engine run on the demo catalog on the [Offhand homepage](https://offhand.nyttolabs.com) before connecting anything.

## Which one should you choose?

| Situation | Reasonable choice |
|---|---|
| A few SKUs, rarely changing | Manual CSV |
| Stock already accurate in Shopify, you only need hiding/showing | Shopify Flow |
| Many suppliers, FTP/XML, hourly sync | A feed-sync app |
| Syncing is your core product and you have developers | Your own script |
| One public CSV/JSON feed, want list + reprice + pull with no queue, short-term | Offhand |

## Checklist before you automate anything

- Use a stable, unique **SKU** on both sides; SKU is the join key.
- Sync into a **dedicated location** if you also hold your own stock, so the sync never overwrites what you counted by hand.
- Decide what a **missing SKU** means (we recommend: leave it alone).
- Decide what **zero** means (hide/draft, not delete, so the listing can return).
- Run the first sync on a **test store** or a handful of SKUs.
- Re-check after the supplier changes its feed layout.

## FAQ

**Can Shopify sync with a supplier by itself?** Not from a supplier's file. Shopify can import a CSV you upload and Flow can react to inventory changes, but reading a supplier feed on a schedule needs an app or your own code.

**How often should I sync?** As often as the supplier updates and as often as the cost of an oversell justifies. Daily is fine for slow-moving goods; fast-moving or one-of-a-kind goods want hourly or better.

**Should I delete products when the supplier is out of stock?** No. Hide them or set them to Draft. Deleting loses reviews, URLs and SEO history, and you have to recreate the product when stock returns.
