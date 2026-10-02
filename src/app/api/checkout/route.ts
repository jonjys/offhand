import { plans } from "@/lib/plans";
import { getStripe, prices } from "@/lib/stripe-server";

export const runtime = "nodejs";

function originFrom(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return host ? `${proto}://${host}` : url.origin;
}

export async function POST(request: Request) {
  const price = prices().store;
  if (!price) return Response.json({ error: "The store price is not configured." }, { status: 500 });

  try {
    const origin = originFrom(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      locale: "en",
      customer_creation: "always",
      allow_promotion_codes: true,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/receipt?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=1`,
      metadata: {
        app: "offhand",
        plan: plans.store.id,
        days: String(plans.store.days),
      },
    });

    if (!session.url) return Response.json({ error: "Checkout could not be opened." }, { status: 502 });
    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be opened.";
    return Response.json({ error: message }, { status: 500 });
  }
}
