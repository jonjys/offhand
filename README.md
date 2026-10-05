# Offhand

A Shopify resale store that stocks itself.

The floor on the homepage is already running. A built-in supplier catalog changes price and stock on its own. Offhand lists anything in stock, reprices when the supplier price moves, and pulls the listing when the count hits zero. Optional trend mode rotates the store through the retail calendar and caps the live shelf at 100 products.

$29 points that same machine at one Shopify store for 30 days. Paste the shop domain, the Dev Dashboard Client ID, and the Client secret once. Offhand refreshes the Shopify token on its own. A real supplier CSV or JSON feed is mandatory for every connected store (a published Google Sheet works). The animated catalog is a homepage demo only and is never used as live supplier evidence. Columns are matched explicitly, missing stock is zero, and selling prices are never inferred from cost. Every live mode requires complete supplier data, positive margin after shipping and fees, explicit rights clearance, and delivery before the event. After that, the server keeps syncing.

The custom app needs read and write access for products, inventory and publications, and read access for locations and legal policies. Publications is what lets Offhand put a listing on the Online Store channel; without it the product exists in the admin but no shopper sees it.

Every listing Offhand writes carries the vendor `Offhand`, the tag `offhand`, and a note saying it was listed from the supplier feed. The store at [pqwbeh-yy.myshopify.com](https://pqwbeh-yy.myshopify.com/collections/stocked-by-offhand) is that machine running against a real Shopify admin, linked from the homepage as proof.

A connected store is saved in private storage, so the shop token survives a new server. On the free host the store syncs once a day, and again while the paid page is open.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app listens on `http://127.0.0.1:43123`.

`.env.local` needs `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STORE`, and `OFFHAND_TOKEN_SECRET`. Without them the floor still runs. Checkout does not.

```bash
npm test
npm run lint
```

## Trend feed fields

All live modes detect `sku`, `title`, `price`, `cost`, `shipping cost`, `fee percent`, `stock`, `description`, `tags`, `delivery days`, `image URL`, `fulfillment type`, `warehouse region`, `tracked delivery`, and `rights cleared`. It fails closed: the shop must first have privacy, returns, shipping, terms of service, and contact policies with nonempty bodies and public HTTPS URLs. A product then needs stock, a public HTTPS image, explicit image/motif rights, positive margin after product cost, shipping, and platform fee, and either instant digital delivery or verified EU stock with a stated 3–5 day delivery window that ends before the event. Protected character and entertainment-franchise terms are rejected. The calendar covers Halloween, Día de Muertos, Black Friday/Cyber Week, Christmas, New Year, Valentine’s Day, Easter, and summer. Black Friday/Cyber Week reprices only products already on the shelf; it never invents a collection. Cultural-event products must explicitly identify the event in the supplier data. Seasonal mode additionally requires event relevance and arrival by the exact event deadline. All managed products that lose eligibility, disappear from the feed, or lose policy readiness are drafted before new activations. Feed errors and missing feeds select no products. Failed withdrawals block activation and channel repair. No more than 100 products can qualify in any mode. The policy check establishes configured policy availability, not legal completeness. Feed prices and costs must use the same currency and tax basis; independently verify supplier rights, fees and delivery evidence before enabling sales. Shopify Collective imports are separate from the Offhand shelf and must stay manual, draft and unpublished until that evidence is available.

