import { money, type Action, type ShelfItem, type SupplierItem } from "@/lib/sync";

const API_VERSION = "2026-10";

const PRODUCT_SET = `mutation OffhandProductSet($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product {
      id
      status
      variants(first: 1) {
        nodes {
          id
          inventoryItem { id }
        }
      }
    }
    userErrors { field message }
  }
}`;

const LOCATIONS = `query OffhandLocations {
  locations(first: 1) {
    nodes { id }
  }
}`;

const INVENTORY_SET = `mutation OffhandInventory($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    userErrors { field message }
  }
}`;

type Graphql = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

export function shopDomain(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) {
    throw new Error("Use the shop domain, like your-store.myshopify.com.");
  }
  return host;
}

const refreshLeadMs = 60_000;

export function accessStillGood(expiresAt: string | undefined, nowMs: number) {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires - nowMs > refreshLeadMs;
}

export async function mintShopifyToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
) {
  const shop = shopDomain(domain);
  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) throw new Error("Paste the Client ID and the Client secret.");

  const response = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    if (payload?.error === "shop_not_permitted") {
      throw new Error("Install Offhand on this store in the Dev Dashboard, then paste the credentials again.");
    }
    throw new Error(payload?.error_description || "Shopify refused the Client ID and Client secret.");
  }

  const expiresIn = payload.expires_in && payload.expires_in > 0 ? payload.expires_in : 86_399;
  return {
    token: payload.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function ensureShopifyAccess<T extends { domain: string; token: string; clientId?: string; clientSecret?: string; tokenExpiresAt?: string }>(
  shop: T,
  fetchImpl: typeof fetch = fetch,
) {
  if (!shop.clientId || !shop.clientSecret) return shop.token;
  if (shop.token && accessStillGood(shop.tokenExpiresAt, Date.now())) return shop.token;
  const minted = await mintShopifyToken(shop.domain, shop.clientId, shop.clientSecret, fetchImpl);
  shop.token = minted.token;
  shop.tokenExpiresAt = minted.expiresAt;
  return shop.token;
}

export function createShopifyClient(domain: string, token: string, fetchImpl: typeof fetch = fetch): Graphql {
  const shop = shopDomain(domain);
  return async function graphql<T>(query: string, variables: Record<string, unknown>) {
    const response = await fetchImpl(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.map((error) => error.message).join(" ") || "Shopify refused the request.");
    }
    return payload.data as T;
  };
}

function shopNote(action: Action, item: SupplierItem, domain: string) {
  if (action.type === "list") return `Listed ${item.title} on ${domain} at ${money(item.price)}.`;
  if (action.type === "pull") return `Pulled ${item.title} on ${domain}.`;
  if (action.type === "reprice") return `Repriced ${item.title} on ${domain} to ${money(action.to)}.`;
  if (action.type === "relist") return `Relisted ${item.title} on ${domain}.`;
  return `Updated ${item.title} stock on ${domain} to ${action.to}.`;
}

function productInput(item: SupplierItem, locationId: string, shelf?: ShelfItem, status?: "ACTIVE" | "DRAFT") {
  const variant: Record<string, unknown> = {
    optionValues: [{ optionName: "Title", name: "Default Title" }],
    sku: item.sku,
    price: item.price,
    inventoryItem: { tracked: true, sku: item.sku },
    inventoryQuantities: [{ locationId, name: "available", quantity: Math.max(0, item.stock) }],
  };
  if (shelf?.variantId) variant.id = shelf.variantId;

  const input: Record<string, unknown> = {
    title: item.title,
    descriptionHtml: `<p>${item.description ?? "Listed by Offhand from the supplier feed."}</p>`,
    status: status ?? (item.stock > 0 ? "ACTIVE" : "DRAFT"),
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [variant],
  };
  if (shelf?.productId) input.id = shelf.productId;
  return input;
}

async function locationId(graphql: Graphql, cached?: string) {
  if (cached) return cached;
  const data = await graphql<{ locations: { nodes: { id: string }[] } }>(LOCATIONS, {});
  const id = data.locations.nodes[0]?.id;
  if (!id) throw new Error("The shop has no location to receive stock.");
  return id;
}

export async function pushToShopify(input: {
  domain: string;
  token: string;
  locationId?: string;
  actions: Action[];
  supplier: SupplierItem[];
  shelf: ShelfItem[];
  fetchImpl?: typeof fetch;
}) {
  const graphql = createShopifyClient(input.domain, input.token, input.fetchImpl);
  const notes: string[] = [];
  const shelf = input.shelf.map((item) => ({ ...item }));
  const bySku = new Map(shelf.map((item) => [item.sku, item]));
  const source = new Map(input.supplier.map((item) => [item.sku, item]));
  let resolvedLocation = input.locationId;

  for (const action of input.actions) {
    const item = source.get(action.sku);
    if (!item) continue;
    const current = bySku.get(action.sku);
    try {
      resolvedLocation = await locationId(graphql, resolvedLocation);
      const status = action.type === "pull" ? "DRAFT" : "ACTIVE";
      const stockItem = action.type === "pull" ? { ...item, stock: 0 } : item;
      const data = await graphql<{
        productSet: {
          product: { id: string; variants: { nodes: { id: string; inventoryItem: { id: string } | null }[] } } | null;
          userErrors: { message: string }[];
        };
      }>(PRODUCT_SET, { input: productInput(stockItem, resolvedLocation, current, status) });

      if (data.productSet.userErrors.length) {
        throw new Error(data.productSet.userErrors.map((error) => error.message).join(" "));
      }

      const product = data.productSet.product;
      const variant = product?.variants.nodes[0];
      const next: ShelfItem = {
        sku: item.sku,
        title: item.title,
        price: action.type === "pull" ? (current?.price ?? item.price) : item.price,
        stock: action.type === "pull" ? 0 : item.stock,
        status: action.type === "pull" ? "draft" : "active",
        productId: product?.id ?? current?.productId,
        variantId: variant?.id ?? current?.variantId,
        inventoryItemId: variant?.inventoryItem?.id ?? current?.inventoryItemId,
      };
      bySku.set(item.sku, next);

      if (next.inventoryItemId && action.type !== "list") {
        const inventory = await graphql<{ inventorySetQuantities: { userErrors: { message: string }[] } }>(INVENTORY_SET, {
          idempotencyKey: `offhand-${item.sku}-${next.stock}-${Date.now()}`,
          input: {
            name: "available",
            reason: "correction",
            ignoreCompareQuantity: true,
            referenceDocumentUri: `logistics://offhand/sku/${encodeURIComponent(item.sku)}`,
            quantities: [
              {
                inventoryItemId: next.inventoryItemId,
                locationId: resolvedLocation,
                quantity: next.stock,
              },
            ],
          },
        });
        if (inventory.inventorySetQuantities.userErrors.length) {
          throw new Error(inventory.inventorySetQuantities.userErrors.map((error) => error.message).join(" "));
        }
      }

      notes.push(shopNote(action, item, input.domain));
    } catch (error) {
      notes.push(`${item.title} stayed put. ${error instanceof Error ? error.message : "Shopify refused the update."}`);
    }
  }

  return { shelf: [...bySku.values()], notes, locationId: resolvedLocation };
}
