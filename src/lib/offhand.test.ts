import assert from "node:assert/strict";
import test from "node:test";
import { catalog } from "./catalog";
import { parseFeed } from "./feed";
import { accessStillGood, listingNote, mintShopifyToken, productInput, pushToShopify, shopDomain } from "./shopify";
import { planSync, runUnattended } from "./sync";
import { includeSeasonalPulls, selectSaleProducts, selectTrendProducts, trendForDate } from "./trends";

const policies = { shop: { shopPolicies: ["PRIVACY_POLICY", "REFUND_POLICY", "SHIPPING_POLICY", "TERMS_OF_SERVICE", "CONTACT_INFORMATION"].map((type) => ({ id: type, type, body: "Reviewed policy", url: `https://store.example/policies/${type}` })) } };
const verifiedCatalog = catalog.map((item) => ({ ...item, cost: 1, shippingCost: 0, feePercent: 3, deliveryDays: 4, imageUrl: "https://supplier.example/image.jpg", fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true }));

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
  const items = parseFeed("Item #,Product Name,Qty,Your Cost,Retail\nAB-1,Wool coat,2,40,80\n");
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

test("client credentials are exchanged and refreshed before they expire", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push(String(url));
    const body = String(init?.body);
    assert.match(body, /grant_type=client_credentials/);
    assert.match(body, /client_id=abc123/);
    return Response.json({ access_token: "fresh-token", expires_in: 86399, scope: "write_products" });
  };

  const minted = await mintShopifyToken("demo-shop.myshopify.com", "abc123", "secret-value", fetchImpl);
  assert.equal(minted.token, "fresh-token");
  assert.equal(accessStillGood(minted.expiresAt, Date.now()), true);
  assert.equal(accessStillGood(new Date(Date.now() + 30_000).toISOString(), Date.now()), false);
  assert.equal(accessStillGood(undefined, Date.now()), false);
  assert.match(calls[0] ?? "", /demo-shop\.myshopify\.com\/admin\/oauth\/access_token/);

  const refused: typeof fetch = async () => Response.json({ error: "shop_not_permitted" }, { status: 400 });
  await assert.rejects(
    () => mintShopifyToken("demo-shop.myshopify.com", "abc123", "secret-value", refused),
    /Install Offhand on this store/,
  );
});

test("shopify push lists a product and stores the ids", async () => {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    calls.push(body);
    if (body.query.includes("OffhandShopPolicies")) return Response.json({ data: policies });
    if (body.query.includes("OffhandLocations")) {
      return Response.json({ data: { locations: { nodes: [{ id: "gid://shopify/Location/1" }] } } });
    }
    if (body.query.includes("OffhandPublications")) {
      return Response.json({ data: { publications: { nodes: [{ id: "gid://shopify/Publication/7", name: "Online Store" }, { id: "gid://shopify/Publication/8", name: "Point of Sale" }] } } });
    }
    if (body.query.includes("OffhandPublish")) {
      return Response.json({ data: { publishablePublish: { userErrors: [] } } });
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
    supplier: verifiedCatalog,
    shelf: [],
    fetchImpl,
  });

  assert.equal(shopDomain("https://demo-shop.myshopify.com/admin"), "demo-shop.myshopify.com");
  assert.equal(result.shelf[0]?.productId, "gid://shopify/Product/9");
  assert.equal(result.shelf[0]?.status, "active");
  assert.match(result.notes[0] ?? "", /Listed Nike Dunk Low Panda/);
  assert.ok(calls.some((call) => call.query.includes("productSet")));

  // A listing nobody can see is not a listing: the product is pushed to the
  // Online Store channel, and the channel id is remembered for next time.
  const publish = calls.find((call) => call.query.includes("OffhandPublish"));
  assert.equal(publish?.variables.id, "gid://shopify/Product/9");
  assert.deepEqual(publish?.variables.input, [{ publicationId: "gid://shopify/Publication/7" }]);
  assert.equal(result.publicationId, "gid://shopify/Publication/7");
  assert.equal(result.shelf[0]?.published, true);

  const set = calls.find((call) => call.query.includes("OffhandProductSet"));
  const input = set?.variables.input as { tags: string[]; vendor: string; descriptionHtml: string };
  assert.deepEqual(input.tags, ["offhand"]);
  assert.equal(input.vendor, "Offhand");
  assert.match(input.descriptionHtml, /Listed by <a href="https:\/\/offhand\.nyttolabs\.com">Offhand<\/a>/);
});

test("every listing says who listed it, and keeps the supplier's own words first", () => {
  const bare = listingNote({ sku: "A", title: "Lamp", price: 40, stock: 1 });
  assert.match(bare, /^<p>Listed by/);
  const own = listingNote({ sku: "A", title: "Lamp", price: 40, stock: 1, description: "Brass, 1970s." });
  assert.match(own, /^<p>Brass, 1970s\.<\/p><p>Listed by/);
  const input = productInput({ sku: "A", title: "Lamp", price: 40, stock: 1 }, "gid://shopify/Location/1") as { tags: string[]; vendor: string };
  assert.deepEqual(input.tags, ["offhand"]);
  assert.equal(input.vendor, "Offhand");
});

test("listings made before the channel was known are put on it on the next pass", async () => {
  const published: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    if (body.query.includes("OffhandShopPolicies")) return Response.json({ data: policies });
    if (body.query.includes("OffhandPublications")) return Response.json({ data: { publications: { nodes: [{ id: "gid://shopify/Publication/7", name: "Online Store" }] } } });
    if (body.query.includes("OffhandPublish")) {
      published.push(String(body.variables.id));
      return Response.json({ data: { publishablePublish: { userErrors: [] } } });
    }
    throw new Error(`unexpected call ${body.query.slice(0, 30)}`);
  };
  const result = await pushToShopify({
    domain: "demo-shop.myshopify.com",
    token: "t",
    actions: [],
    supplier: verifiedCatalog,
    shelf: [
      { sku: "BOSTON", title: "Birkenstock Boston", price: 58, stock: 5, status: "active", productId: "gid://shopify/Product/1" },
      { sku: "WM-22", title: "Sony Walkman WM-22", price: 95, stock: 0, status: "draft", productId: "gid://shopify/Product/2" },
      { sku: "DETROIT", title: "Carhartt Detroit jacket", price: 74, stock: 3, status: "active", productId: "gid://shopify/Product/3", published: true },
    ],
    fetchImpl,
  });
  assert.deepEqual(published, ["gid://shopify/Product/1"]);
  assert.equal(result.shelf.find((item) => item.sku === "BOSTON")?.published, true);
  assert.equal(result.shelf.find((item) => item.sku === "WM-22")?.published, undefined);
  assert.match(result.notes[0] ?? "", /Put Birkenstock Boston on the online store/);
});

test("a store without an online store channel is still listed in the admin", async () => {
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string };
    if (body.query.includes("OffhandShopPolicies")) return Response.json({ data: policies });
    if (body.query.includes("OffhandLocations")) return Response.json({ data: { locations: { nodes: [{ id: "gid://shopify/Location/1" }] } } });
    if (body.query.includes("OffhandShopPolicies")) return Response.json({ data: policies });
    if (body.query.includes("OffhandPublications")) return Response.json({ data: { publications: { nodes: [] } } });
    if (body.query.includes("OffhandPublish")) throw new Error("must not publish without a channel");
    return Response.json({ data: { productSet: { product: { id: "gid://shopify/Product/1", status: "ACTIVE", variants: { nodes: [] } }, userErrors: [] } } });
  };
  const result = await pushToShopify({ domain: "demo-shop.myshopify.com", token: "t", actions: [{ type: "list", sku: "BOSTON" }], supplier: verifiedCatalog, shelf: [], fetchImpl });
  assert.equal(result.publicationId, null);
  assert.match(result.notes[0] ?? "", /Listed Birkenstock Boston/);
});


test("trend mode chooses Halloween products and fails closed on incomplete rows", () => {
  const source = [
    { sku: "PUMPKIN", title: "Ceramic pumpkin lantern", price: 40, cost: 18, shippingCost: 4, feePercent: 3, stock: 8, deliveryDays: 5, imageUrl: "https://supplier.example/pumpkin.jpg", tags: ["Halloween"], fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true },
    { sku: "NO-IMAGE", title: "Ghost garland", price: 30, cost: 10, shippingCost: 3, feePercent: 3, stock: 9, deliveryDays: 4, tags: ["Halloween"], fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true },
    { sku: "LOW-MARGIN", title: "Halloween candle", price: 20, cost: 16, shippingCost: 4, feePercent: 5, stock: 5, deliveryDays: 4, imageUrl: "https://supplier.example/candle.jpg", fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true },
    { sku: "PLAIN", title: "Desk lamp", price: 60, cost: 20, shippingCost: 4, feePercent: 3, stock: 5, deliveryDays: 4, imageUrl: "https://supplier.example/lamp.jpg", fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true },
  ];
  const result = selectTrendProducts(source, new Date("2026-10-05T12:00:00Z"));
  assert.equal(result.event?.slug, "halloween");
  assert.deepEqual(result.items.map((item) => item.sku), ["PUMPKIN"]);
  assert.equal(result.items[0]?.trendSlug, "halloween");
});

test("trend mode caps the shelf and pulls products from the previous event", () => {
  const source = Array.from({ length: 120 }, (_, index) => ({
    sku: `H-${index}`,
    title: `Halloween pumpkin ${index}`,
    price: 50,
    cost: 20,
    shippingCost: 0,
    feePercent: 3,
    stock: 10,
    deliveryDays: 0,
    imageUrl: `https://supplier.example/${index}.jpg`,
    fulfillmentType: "digital" as const,
    rightsCleared: true,
  }));
  const selected = selectTrendProducts(source, new Date("2026-10-05T12:00:00Z"), 100);
  assert.equal(selected.items.length, 100);
  const managed = includeSeasonalPulls(selected.items, [
    { sku: "OLD-XMAS", title: "Old Christmas item", price: 20, stock: 3, status: "active" },
  ]);
  assert.equal(managed.find((item) => item.sku === "OLD-XMAS")?.stock, 0);
  assert.equal(trendForDate(new Date("2026-11-10T12:00:00Z"))?.slug, "christmas");
});


test("trend mode accepts instant downloads and rejects unsafe physical or protected-character products", () => {
  const source = [
    { sku: "DIGITAL", title: "Printable Halloween door sign", price: 12, cost: 2, shippingCost: 0, feePercent: 3, deliveryDays: 0, stock: 999, imageUrl: "https://supplier.example/sign.jpg", tags: ["Halloween"], fulfillmentType: "digital" as const, rightsCleared: true },
    { sku: "SLOW", title: "Halloween pumpkin bowl", price: 40, cost: 10, shippingCost: 3, feePercent: 3, stock: 8, deliveryDays: 8, imageUrl: "https://supplier.example/bowl.jpg", fulfillmentType: "physical" as const, warehouseRegion: "EU", rightsCleared: true, trackedDelivery: true },
    { sku: "US", title: "Halloween ghost banner", price: 40, cost: 10, shippingCost: 3, feePercent: 3, stock: 8, deliveryDays: 4, imageUrl: "https://supplier.example/ghost.jpg", fulfillmentType: "physical" as const, warehouseRegion: "US", rightsCleared: true, trackedDelivery: true },
    { sku: "IP", title: "Disney Halloween printable", price: 12, cost: 2, shippingCost: 0, feePercent: 3, deliveryDays: 0, stock: 99, imageUrl: "https://supplier.example/ip.jpg", fulfillmentType: "digital" as const, rightsCleared: true },
    { sku: "NO-RIGHTS", title: "Printable Halloween place cards", price: 12, cost: 2, shippingCost: 0, feePercent: 3, deliveryDays: 0, stock: 99, imageUrl: "https://supplier.example/cards.jpg", fulfillmentType: "digital" as const },
  ];
  const result = selectTrendProducts(source, new Date("2026-10-05T12:00:00Z"));
  assert.deepEqual(result.items.map((item) => item.sku), ["DIGITAL"]);
});

test("feed reads fulfillment and rights evidence explicitly", () => {
  const [item] = parseFeed("sku,title,price,cost,shipping cost,fee percent,stock,image url,fulfillment type,warehouse region,delivery days,tracked delivery,rights cleared,tags\nH1,Halloween banner,20,8,3,3,4,https://supplier.example/h1.jpg,physical,EU,4,yes,yes,Halloween\n");
  assert.equal(item.fulfillmentType, "physical");
  assert.equal(item.warehouseRegion, "EU");
  assert.equal(item.deliveryDays, 4);
  assert.equal(item.rightsCleared, true);
  assert.equal(item.trackedDelivery, true);
  assert.equal(item.shippingCost, 3);
  assert.equal(item.feePercent, 3);
});


test("Día de Muertos requires the supplier's explicit event tag", () => {
  const common = { price: 30, cost: 8, shippingCost: 0, feePercent: 3, stock: 99, deliveryDays: 0, imageUrl: "https://supplier.example/dia.jpg", fulfillmentType: "digital" as const, rightsCleared: true };
  const result = selectTrendProducts([
    { ...common, sku: "EXPLICIT", title: "Printable ofrenda cards", tags: ["Día de Muertos"] },
    { ...common, sku: "INFERRED", title: "Printable calavera cards", tags: ["calavera"] },
  ], new Date("2026-11-01T12:00:00Z"));
  assert.equal(result.event?.slug, "dia-de-muertos");
  assert.deepEqual(result.items.map((item) => item.sku), ["EXPLICIT"]);
});

test("Black Friday is a pricing period", () => {
  const event = trendForDate(new Date("2026-11-27T12:00:00Z"));
  assert.equal(event?.slug, "black-friday-cyber-week");
  assert.equal(event?.kind, "pricing");
});



test("feeds never invent inventory or a selling price", () => {
  assert.equal(parseFeed("sku,title,price\nA,Lamp,40")[0].stock, 0);
  assert.throws(() => parseFeed("sku,title,cost\nA,Lamp,20"), /selling price/);
  assert.throws(() => parseFeed("sku,title,fee percent,cost\nA,Lamp,3,20"), /selling price/);
  assert.equal(parseFeed('sku,title,price,stock,delivery days\nA,Lamp,"40,50",1,')[0].price, 40.5);
  assert.equal(parseFeed('sku,title,price,stock,delivery days\nA,Lamp,40,1,')[0].deliveryDays, undefined);
  assert.throws(() => parseFeed("sku,title,price,stock\nA,Lamp,-40,1"), /no products/);
});

test("universal gates reject invalid numbers, image URLs, duplicates and unknown caps", () => {
  const safe = verifiedCatalog[0];
  assert.equal(selectSaleProducts([safe]).length, 1);
  for (const change of [{ stock: NaN }, { cost: -1 }, { feePercent: Infinity }, { price: Infinity }, { imageUrl: "http://supplier.example/image.jpg" }, { rightsCleared: false }, { trackedDelivery: false }]) {
    assert.equal(selectSaleProducts([{ ...safe, ...change }]).length, 0);
  }
  assert.equal(selectSaleProducts([safe, safe]).length, 0);
  assert.equal(selectSaleProducts([safe], NaN).length, 0);
});

test("policy failure drafts all old managed products without inventory access or publishing", async () => {
  const writes: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.query.includes("OffhandShopPolicies")) throw new Error("policy unavailable");
    assert.ok(body.query.includes("OffhandDraftProduct"));
    const input = body.variables.product;
    assert.deepEqual(Object.keys(input).sort(), ["id", "status"]);
    assert.equal(input.status, "DRAFT");
    writes.push(input);
    return Response.json({ data: { productUpdate: { product: { id: input.id, status: "DRAFT" }, userErrors: [] } } });
  };
  const shelf = Array.from({ length: 6 }, (_, i) => ({ sku: `OLD-${i}`, title: `Old ${i}`, price: 10, stock: 1, status: "active" as const, productId: `gid://shopify/Product/${i}`, published: true }));
  const result = await pushToShopify({ domain: "demo-shop.myshopify.com", token: "t", actions: [{ type: "list", sku: verifiedCatalog[0].sku }], supplier: verifiedCatalog, shelf, fetchImpl });
  assert.equal(writes.length, 6);
  assert.ok(result.shelf.every((item) => item.status === "draft" && item.published === false));
});

test("failed withdrawal blocks new activation and channel repair", async () => {
  const mutations: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.query.includes("OffhandShopPolicies")) return Response.json({ data: policies });
    mutations.push(body.query);
    assert.equal(body.variables.product.status, "DRAFT");
    return Response.json({ data: { productUpdate: { product: null, userErrors: [{ message: "denied" }] } } });
  };
  const result = await pushToShopify({ domain: "demo-shop.myshopify.com", token: "t", actions: [{ type: "list", sku: verifiedCatalog[0].sku }], supplier: verifiedCatalog, shelf: [{ sku: "OLD", title: "Old", price: 1, stock: 1, status: "active", productId: "gid://shopify/Product/1" }], fetchImpl });
  assert.equal(mutations.length, 1);
  assert.equal(result.shelf[0].status, "active");
  assert.match(result.notes.join(" "), /stayed put/);
});

test("arrival deadline is exact, rather than rounded up to the next day", () => {
  const safe = { ...verifiedCatalog[0], title: "Halloween pumpkin", deliveryDays: 3 };
  assert.equal(selectTrendProducts([safe], new Date("2026-10-28T13:00:00Z")).items.length, 0);
});


test("existing product updates use the API identifier instead of the removed input id", () => {
  const input = productInput(verifiedCatalog[0], "gid://shopify/Location/1", { ...verifiedCatalog[0], status: "draft", productId: "gid://shopify/Product/1" });
  assert.equal("id" in input, false);
  assert.equal((input.variants as {inventoryPolicy: string}[])[0].inventoryPolicy, "DENY");
});
