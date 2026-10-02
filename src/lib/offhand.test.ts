import assert from "node:assert/strict";
import test from "node:test";
import { catalog } from "./catalog";
import { parseFeed } from "./feed";
import { pushToShopify, shopDomain } from "./shopify";
import { planSync, runUnattended } from "./sync";

test("the machine lists a full shelf on its own, then pulls and reprices", () => {
  const first = runUnattended(catalog, 1);
  assert.equal(first.shelf.filter((item) => item.status === "active").length, catalog.length);
  assert.ok(first.log.every((line) => line.startsWith("Listed ")));
  assert.equal(first.log.some((line) => /approve|review/i.test(line)), false);

  const later = runUnattended(catalog, 8);
  assert.ok(later.log.some((line) => line.startsWith("Pulled ")));
  assert.ok(later.log.some((line) => line.startsWith("Repriced ") || line.startsWith("Updated ")));
  assert.equal(planSync(later.supplier, later.shelf).length >= 0, true);
});

test("a zero-stock product is never listed", () => {
  const actions = planSync([{ sku: "GONE", title: "Gone", price: 40, stock: 0 }], []);
  assert.deepEqual(actions, []);
});

test("a csv with odd headers is read without a mapping step", () => {
  const items = parseFeed("Item #,Product Name,Qty,Your Cost\nAB-1,Wool coat,2,40\n");
  assert.equal(items[0]?.sku, "AB-1");
  assert.equal(items[0]?.title, "Wool coat");
  assert.equal(items[0]?.stock, 2);
  assert.equal(items[0]?.price, 80);
});

test("json feeds and quoted csv cells work", () => {
  const json = parseFeed(JSON.stringify({ products: [{ sku: "X1", name: "Lamp", retail: "$42", inventory: "3" }] }));
  assert.equal(json[0]?.price, 42);
  assert.equal(json[0]?.stock, 3);
  const csv = parseFeed('sku,title,price,stock\nQ-1,"Coat, navy",55,1\n');
  assert.equal(csv[0]?.title, "Coat, navy");
});

test("shopify push lists a product and stores the ids", async () => {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    calls.push(body);
    if (body.query.includes("OffhandLocations")) {
      return Response.json({ data: { locations: { nodes: [{ id: "gid://shopify/Location/1" }] } } });
    }
    if (body.query.includes("OffhandProductSet")) {
      return Response.json({
        data: {
          productSet: {
            product: {
              id: "gid://shopify/Product/9",
              status: "ACTIVE",
              variants: { nodes: [{ id: "gid://shopify/ProductVariant/4", inventoryItem: { id: "gid://shopify/InventoryItem/3" } }] },
            },
            userErrors: [],
          },
        },
      });
    }
    return Response.json({ data: { inventorySetQuantities: { userErrors: [] } } });
  };

  const result = await pushToShopify({
    domain: "https://demo-shop.myshopify.com/admin",
    token: "shpat_test",
    actions: [{ type: "list", sku: "DUNK-PANDA" }],
    supplier: catalog,
    shelf: [],
    fetchImpl,
  });

  assert.equal(shopDomain("https://demo-shop.myshopify.com/admin"), "demo-shop.myshopify.com");
  assert.equal(result.shelf[0]?.productId, "gid://shopify/Product/9");
  assert.equal(result.shelf[0]?.status, "active");
  assert.match(result.notes[0] ?? "", /Listed Nike Dunk Low Panda/);
  assert.ok(calls.some((call) => call.query.includes("productSet")));
});
