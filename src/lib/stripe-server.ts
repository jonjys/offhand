import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { plans } from "@/lib/plans";

let stripe: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Payments are not configured.");
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export function prices() {
  return {
    store: process.env.STRIPE_PRICE_STORE ?? "price_1ULoFnBEo0YzuylwHwD28n3g",
  };
}

function tokenSecret() {
  const secret = process.env.OFFHAND_TOKEN_SECRET || process.env.RETURNBY_TOKEN_SECRET || process.env.BLUFFKOLL_TOKEN_SECRET;
  if (!secret) throw new Error("OFFHAND_TOKEN_SECRET is missing.");
  return secret;
}

export function signCustomer(customerId: string) {
  const mac = createHmac("sha256", tokenSecret()).update(customerId).digest("base64url");
  return `${customerId}.${mac}`;
}

export function verifyToken(token: string) {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) throw new Error("That key is not valid.");
  const customerId = token.slice(0, separator);
  const mac = token.slice(separator + 1);
  const expected = createHmac("sha256", tokenSecret()).update(customerId).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("That key is not valid.");
  if (!customerId.startsWith("cus_")) throw new Error("That key is not valid.");
  return customerId;
}

async function readCustomer(customerId: string) {
  const customer = await getStripe().customers.retrieve(customerId);
  if (customer.deleted) throw new Error("That customer no longer exists.");
  return customer;
}

export async function entitlement(customerId: string) {
  const customer = await readCustomer(customerId);
  const until = customer.metadata.offhand_until || "";
  return { until, active: Date.parse(until) > Date.now() };
}

export async function grantFromSession(sessionId: string) {
  if (!sessionId.startsWith("cs_")) throw new Error("That payment is not valid.");
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") return { paid: false as const };

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) throw new Error("The payment has no customer.");

  const customer = await readCustomer(customerId);
  const granted = (customer.metadata.granted || "").split(",").filter(Boolean);
  const hash = createHash("sha256").update(session.id).digest("hex").slice(0, 12);
  let until = customer.metadata.offhand_until || "";

  if (!granted.includes(hash)) {
    const current = Date.parse(until);
    const base = Number.isFinite(current) && current > Date.now() ? current : Date.now();
    until = new Date(base + plans.store.days * 86_400_000).toISOString();
    granted.push(hash);
    await getStripe().customers.update(customerId, {
      metadata: {
        app: "offhand",
        offhand_until: until,
        granted: granted.slice(-15).join(","),
      },
    });
  }

  return {
    paid: true as const,
    token: signCustomer(customerId),
    until,
    plan: "store" as const,
  };
}
