# Offhand

A Shopify resale store that stocks itself.

The floor on the homepage is already running. A built-in supplier catalog changes price and stock on its own. Offhand lists anything in stock, reprices when the supplier price moves, and pulls the listing when the count hits zero. There is no approval queue.

$29 points that same machine at one Shopify store for 30 days. Paste the shop domain and an Admin API token once. Leave the feed blank to follow the live catalog, or paste a public CSV (a published Google Sheet works). Columns are detected. After that, the server keeps syncing.

The custom app needs read and write access for products and inventory, and read access for locations.

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
