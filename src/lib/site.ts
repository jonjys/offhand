export const SITE_URL = "https://offhand.nyttolabs.com";
export const SITE_NAME = "Offhand";
export const ORG = { "@type": "Organization", name: "Nytto Labs", url: "https://www.nyttolabs.com" } as const;

export const faq = [
  {
    q: "What is Offhand?",
    a: "Offhand keeps a Shopify resale store in step with a supplier feed. It lists items the supplier has in stock, reprices them when the supplier price changes, updates the stock count, and pulls the listing when the supplier reaches zero.",
  },
  {
    q: "What does pulling a listing mean?",
    a: "The product is set to Draft with a stock of 0. It is not deleted. When the supplier has stock again, Offhand relists it.",
  },
  {
    q: "Does anything wait for my approval?",
    a: "No. There is no approval queue. Offhand applies the supplier feed to your store on its own, and only acts on SKUs that appear in the feed.",
  },
  {
    q: "What does Offhand need from my Shopify store?",
    a: "The shop domain, plus the Client ID and Client secret of a custom app from the Shopify Dev Dashboard. The app needs read and write access for products and inventory, and read access for locations.",
  },
  {
    q: "What supplier feed formats work?",
    a: "A public https URL that returns CSV or JSON. Each row needs a SKU, a title, and a price or a cost; column names are detected automatically. A published Google Sheet works. If a row has only a cost, the product is listed at twice the cost. Leave the feed blank to follow the built-in demo catalog.",
  },
  {
    q: "How often does it sync?",
    a: "On the hosted plan the store syncs once a day, and again while your Offhand page is open.",
  },
  {
    q: "What does it cost?",
    a: "$29 for 30 days for one Shopify store, tax included. It is a one-time payment through Stripe, not a subscription.",
  },
  {
    q: "What does Offhand not do?",
    a: "It does not forward orders to your supplier and does not upload product images. Each SKU becomes a single-variant product, and stock is written to the shop's first location.",
  },
];
