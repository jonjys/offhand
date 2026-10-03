---
site: offhand
slug: supplier-feed-csv-format-for-shopify
title: Supplier feed CSV format for Shopify automation
description: The minimum columns a supplier CSV or JSON feed needs for automatic Shopify listing, repricing and stock updates, with an example you can copy and publish as a Google Sheet.
keyword: supplier feed CSV Shopify
intent: informational / template
date: 2026-10-04
---

Almost every automated supplier sync reads the same shape of data: one row per item with a stable ID, a name, a price and a count. If you control the feed (your own spreadsheet of resale inventory, for example), getting this shape right makes any tool easier to point at it.

## The four fields that matter

| Field | Purpose | Notes |
|---|---|---|
| `sku` | Join key between the feed and Shopify | Unique, stable, never reused for another product |
| `title` | Product name | Used when a product is first listed |
| `price` | Sell price | Whole units are simplest (Offhand rounds to whole units); avoid currency symbols if you can |
| `stock` | Units available | A whole number; `0` means out of stock |

An optional `description` column is useful for the first listing.

## Example CSV

```csv
sku,title,price,stock
DUNK-PANDA,Nike Dunk Low Panda,128,3
AE1-PROG,Canon AE-1 Program,210,1
WM-22,Sony Walkman WM-22,95,0
```

## Example JSON

```json
[
  { "sku": "DUNK-PANDA", "title": "Nike Dunk Low Panda", "price": 128, "stock": 3 },
  { "sku": "WM-22", "title": "Sony Walkman WM-22", "price": 95, "stock": 0 }
]
```

## Publish it from Google Sheets

If your inventory lives in a spreadsheet, the easiest feed is a published sheet: in Google Sheets use *File → Share → Publish to web*, choose the sheet and *CSV*, and use the link it gives you. Anyone with the link can read it, so do not put anything secret in it (no private notes, no supplier cost if you do not want it public).

## What a well-behaved sync does with your feed

- A SKU **in the feed with stock above 0 and not in your store** gets listed.
- A SKU **with a changed price** is repriced.
- A SKU **with a changed count** gets its stock updated.
- A SKU **at 0** is hidden (Draft), not deleted, and comes back when stock returns.
- A SKU **not in the feed** is left alone.

[Offhand](https://offhand.nyttolabs.com) follows exactly these rules and accepts this shape. It detects common column names (for example `sku`, `item`, `code`; `title`, `name`, `product`; `price`, `retail`, `msrp`; `cost`, `wholesale`; `stock`, `qty`, `quantity`, `inventory`), so you rarely need to rename headers. If a feed has a cost but no price, Offhand lists at twice the cost. The feed URL must be a public `https://` address; private and local addresses are refused.

## Common feed mistakes

- **Duplicate SKUs.** Two rows with one SKU conflict, and only one of them can win.
- **Changing SKUs** when you rename a product. The tool sees a new product and an out-of-stock old one.
- **Formatted numbers** such as `1,299.00` or `€128` in the price column. Offhand strips symbols and separators, but other tools may not, so keep it numeric.
- **Empty stock cells.** Decide whether blank means 0 or unknown, and make it explicit. Offhand treats an empty stock cell as 0, and a feed with no stock column at all as "1 in stock" for every item.
- **Large, slow exports** that time out. Smaller, faster feeds are more reliable.

## FAQ

**CSV or JSON?** Either works for simple feeds. CSV is easier to produce from a spreadsheet; JSON is easier from code.

**Can I include variants (sizes, colours)?** Offhand creates one variant per SKU, so list each size as its own SKU. Larger sync apps handle real variant structures; check their documentation.

**Do I need images in the feed?** Offhand does not upload images, so add them in Shopify. Other tools differ.
