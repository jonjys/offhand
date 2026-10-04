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

const ONLINE_STORE = `query OffhandPublications {
  publications(first: 10) {
    nodes { id name }
  }
}`;

const PUBLISH = `mutation OffhandPublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
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

/** The note every listing carries, so a shopper can see nobody typed it. */
export function listingNote(item: SupplierItem) {
  const own = item.description?.trim();
  const lead = own ? `<p>${own}</p>` : "";
  return `${lead}<p>Listed by <a href="https://offhand.nyttolabs.com">Offhand</a> from the supplier feed. The price follows the supplier, and the listing is pulled when the supplier runs out.</p>`;
}

export function productInput(item: SupplierItem, locationId: string, shelf?: ShelfItem, status?: "ACTIVE" | "DRAFT") {
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
    descriptionHtml: listingNote(item),
    vendor: "Offhand",
    tags: ["offhand"],
    status: status ?? (item.stock > 0 ? "ACTIVE" : "DRAFT"),
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [variant],
  };
  if (shelf?.productId) input.id = shelf.productId;
  return input;
}

/**
 * A product Shopify holds but the online store does not show is not listed
 * in any sense a shopper cares about. productSet alone leaves it unpublished,
 * so every list and relist is followed by a publish to the Online Store
 * channel. Missing channel (a store without one) is not an error: the
 * listing still exists in the admin.
 */
async function onlineStoreId(graphql: Graphql, cached?: string | null) {
  if (cached !== undefined) return cached;
  const data = await graphql<{ publications: { nodes: { id: string; name: string }[] } }>(ONLINE_STORE, {});
  return data.publications.nodes.find((node) => node.name === "Online Store")?.id ?? null;
}

async function publish(graphql: Graphql, productId: string, publicationId: string) {
  const data = await graphql<{ publishablePublish: { userErrors: { message: string }[] } }>(PUBLISH, {
    id: productId,
    input: [{ publicationId }],
  });
  if (data.publishablePublish.userErrors.length) {
    throw new Error(data.publishablePublish.userErrors.map((error) => error.message).join(" "));
  }
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
  /** Online Store publication id; null once looked up and absent. */
  publicationId?: string | null;
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
  let resolvedPublication = input.publicationId;

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

      if (product && (action.type === "list" || action.type === "relist")) {
        resolvedPublication = await onlineStoreId(graphql, resolvedPublication);
        if (resolvedPublication) {
          await publish(graphql, product.id, resolvedPublication);
          next.published = true;
        }
      }

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

  // Listings made before Offhand published to the channel, or on a store
  // whose channel appeared later, are put on it now. A handful per run keeps
  // the daily sync cheap; the rest follow the next day.
  const unpublished = [...bySku.values()].filter((item) => item.status === "active" && item.productId && !item.published);
  for (const item of unpublished.slice(0, 10)) {
    try {
      resolvedPublication = await onlineStoreId(graphql, resolvedPublication);
      if (!resolvedPublication) break;
      await publish(graphql, item.productId as string, resolvedPublication);
      item.published = true;
      notes.push(`Put ${item.title} on the online store of ${input.domain}.`);
    } catch (error) {
      notes.push(`${item.title} is not on the online store yet. ${error instanceof Error ? error.message : "Shopify refused the update."}`);
    }
  }

  return { shelf: [...bySku.values()], notes, locationId: resolvedLocation, publicationId: resolvedPublication };
}
