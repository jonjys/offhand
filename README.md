# Offhand

A Shopify resale store that stocks itself.

The floor on the homepage is already running. A built-in supplier catalog changes price and stock on its own. Offhand lists anything in stock, reprices when the supplier price moves, and pulls the listing when the count hits zero. Optional trend mode rotates the store through the retail calendar and caps the live shelf at 100 products.

$29 points that same machine at one Shopify store for 30 days. Paste the shop domain, the Dev Dashboard Client ID, and the Client secret once. Offhand refreshes the Shopify token on its own. Leave the feed blank to follow the live catalog, or paste a public CSV (a published Google Sheet works). Columns are detected. Trend mode requires an HTTPS image plus matching event keywords, and can also use cost and delivery-day columns to reject weak products. After that, the server keeps syncing.

The custom app needs read and write access for products, inventory and publications, and read access for locations. Publications is what lets Offhand put a listing on the Online Store channel; without it the product exists in the admin but no shopper sees it.

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

Trend mode detects `sku`, `title`, `price` or `cost`, `stock`, `description`, `tags`, `delivery days`, and `image URL`. It fails closed: a product without stock, a public HTTPS image, a seasonal keyword match, enough margin when cost is known, or enough time to arrive before the event is not published. The calendar currently covers Valentine’s Day, Halloween, Día de Muertos, Christmas, and New Year. Cultural-event products must explicitly identify the event in the supplier data.
