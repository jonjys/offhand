import { findShop, publicShop, saveShop, type ShopRecord } from "@/lib/machine";
import { isPublicFeedUrl } from "@/lib/feed";
import { createShopifyClient, mintShopifyToken, shopDomain } from "@/lib/shopify";
import { entitlement, verifyToken } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFrom(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return "";
}

export async function GET(request: Request) {
  try {
    const customerId = verifyToken(tokenFrom(request));
    const access = await entitlement(customerId);
    const shop = await findShop(customerId);
    return Response.json({
      active: access.active,
      until: access.until,
      shop: shop ? publicShop(shop) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The store could not be read.";
    return Response.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    domain?: string;
    clientId?: string;
    clientSecret?: string;
    adminToken?: string;
    feedUrl?: string;
  } | null;
  const clientId = body?.clientId?.trim() ?? "";
  const clientSecret = body?.clientSecret?.trim() ?? "";
  const adminToken = body?.adminToken?.trim() ?? "";
  if (!body?.token || !body.domain || (!adminToken && (!clientId || !clientSecret))) {
    return Response.json({ error: "Paste the shop domain, the Client ID, and the Client secret." }, { status: 400 });
  }

  try {
    const customerId = verifyToken(body.token);
    const access = await entitlement(customerId);
    if (!access.active) return Response.json({ error: "This browser has no active 30 days." }, { status: 402 });

    const domain = shopDomain(body.domain);
    const feedUrl = body.feedUrl?.trim() ?? "";
    if (feedUrl && !isPublicFeedUrl(feedUrl)) {
      return Response.json({ error: "The feed URL has to be a public https link." }, { status: 400 });
    }

    const minted = clientId && clientSecret ? await mintShopifyToken(domain, clientId, clientSecret) : null;
    const accessToken = minted?.token ?? adminToken;
    const graphql = createShopifyClient(domain, accessToken);
    await graphql<{ locations: { nodes: { id: string }[] } }>(
      `query OffhandLocations { locations(first: 1) { nodes: { id } } }`,
      {},
    );

    const existing = await findShop(customerId);
    const record: ShopRecord = {
      customerId,
      domain,
      token: accessToken,
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
      tokenExpiresAt: minted?.expiresAt,
      feedUrl,
      until: access.until,
      locationId: existing?.locationId,
      shelf: existing?.domain === domain ? existing.shelf : [],
      log: existing?.log ?? [],
    };
    const shop = await saveShop(record);
    return Response.json({ active: true, until: access.until, shop });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The shop could not be connected.";
    return Response.json({ error: message }, { status: 400 });
  }
}
