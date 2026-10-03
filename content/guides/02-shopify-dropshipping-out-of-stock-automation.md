---
site: offhand
slug: shopify-dropshipping-out-of-stock-automation
title: Shopify dropshipping out-of-stock automation
description: How to stop selling what the supplier no longer has. Pull listings at zero stock, bring them back on restock, and avoid the mistakes that cause oversells.
keyword: Shopify dropshipping out of stock automation
intent: informational / how-to
date: 2026-10-04
---

The worst dropshipping failure is not a slow store, it is a sale you cannot fulfil. A customer pays, your supplier has none left, and you spend the afternoon on refunds and apologies. Out-of-stock automation exists to make sure the product disappears from your shop at the same moment it disappears from the supplier.

## The core rule

> When the supplier's count reaches zero, the listing leaves the storefront. When the count is above zero again, it comes back.

Everything else is implementation detail. There are three places the rule can live.

## Option A: Shopify's own tools

Shopify lets you control what happens when inventory runs out (continue selling or not), and [Shopify Flow](https://help.shopify.com/en/manual/products/inventory/getting-started-with-inventory/hide-out-of-stock) can unpublish a product at zero inventory and republish it when inventory returns. If your inventory numbers in Shopify are already correct, this is all you need.

The catch for resellers: Shopify only knows the number you gave it. If you never update inventory when the supplier's stock changes, Flow has nothing to react to.

## Option B: A dropshipping or sync app

Dropshipping and feed-sync apps update Shopify inventory from the supplier and usually include a rule such as "set to draft/hide when out of stock". Check three things in any app before trusting it:

1. **What triggers the hide?** Quantity 0 in the feed, or also a missing row?
2. **Does it bring the product back** on restock, or do you have to republish by hand?
3. **How often does it run?** A daily sync leaves up to a day of exposure.

## Option C: Offhand

[Offhand](https://offhand.nyttolabs.com) is a small tool that applies this one rule, plus listing and repricing, to a single supplier feed. For each SKU in the feed it compares the supplier's row with your Shopify shelf and decides one of: list, reprice, update stock, pull, or relist.

- **Pull:** supplier stock is zero and the product is active. Offhand sets the product to Draft and the stock to 0. The product is not deleted.
- **Relist:** supplier stock is above zero and the product is Draft. Offhand sets it back to Active.
- **No approval step.** Nothing waits in a queue for you to click.
- **SKUs not in the feed are left alone**, so a broken or truncated feed does not empty your store by accident.

You can see the rule run live on the demo catalog on the homepage: the supplier changes, and the shelf follows.

Limits you should know: one public HTTPS CSV/JSON feed per store, a single variant per product, stock written to the shop's first location, no order forwarding to the supplier, and a daily sync on the hosted plan (plus a sync while the Offhand page is open). Price: $29 for 30 days for one store, a one-time payment.

## Mistakes that cause oversells

- **Trusting a daily sync for items with one unit.** If a product exists once, a day is a long time. Use a faster tool, or do not list one-offs.
- **Treating "missing from feed" as "zero".** A failed export can look like a mass stock-out. Decide this deliberately.
- **Syncing into the wrong location.** If you also hold stock, keep supplier stock in its own location.
- **Deleting instead of hiding.** You lose the URL, the history and the reviews.
- **No test run.** Try the automation on a few SKUs first.

## A simple setup that works

1. Make sure every supplier item has a unique SKU that you also use in Shopify.
2. Pick a sync tool (Shopify Flow plus an inventory sync app, or Offhand for a single simple feed).
3. Test with five SKUs: one in stock, one at zero, one with a price change, one missing from the feed, one that returns from zero.
4. Check the Shopify admin after the first run, then after the next supplier update.

## FAQ

**Is hiding better than "continue selling when out of stock"?** For dropshipping, yes. Continue-selling only makes sense when you can backorder honestly and say so on the page.

**Will Google drop my product page when I set it to Draft?** A Draft product returns a not-found page on the storefront. If you expect it back soon, that is usually acceptable. If a product is gone for good, set up a redirect to a category page.

**Does this replace order forwarding?** No. This only controls what is for sale. Forwarding paid orders to a supplier is a separate job.
