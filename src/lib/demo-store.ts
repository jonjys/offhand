/**
 * The public store Offhand keeps stocked as proof.
 *
 * The floor on the homepage shows the machine; this is the same machine
 * pointed at a real Shopify admin, where anyone can open a product and see
 * the note Offhand wrote on it. One place to change when the store moves.
 */
export const demoStore = {
  url: "https://pqwbeh-yy.myshopify.com",
  collectionUrl: "https://pqwbeh-yy.myshopify.com/collections/stocked-by-offhand",
  howItWorksUrl: "https://pqwbeh-yy.myshopify.com/pages/how-this-store-works",
} as const;
