import { catalog } from "@/lib/catalog";
import { isPublicFeedUrl, parseFeed } from "@/lib/feed";
import { ensureShopifyAccess, pushToShopify, shopPolicyReadiness } from "@/lib/shopify";
import { readShops, writeShops, type LogLine, type ShopRecord } from "@/lib/shop-store";
import { applyPlan, describe, drift, planSync, type ShelfItem, type SupplierItem } from "@/lib/sync";
import { includeSeasonalPulls, selectTrendProducts, trendForDate } from "@/lib/trends";

export type { LogLine, ShopRecord };

export type FloorSnapshot = {
  running: true;
  supplier: SupplierItem[];
  shelf: ShelfItem[];
  log: LogLine[];
  changedSku: string;
  listed: number;
  pulled: number;
};

type Machine = {
  supplier: SupplierItem[];
  shelf: ShelfItem[];
  log: LogLine[];
  changedSku: string;
  tick: number;
  shops: ShopRecord[];
  timers: ReturnType<typeof setInterval>[];
};

const globalKey = "__offhand";
const syncGapMs = 20_000;
let loading: Promise<void> | null = null;

function now() {
  return new Date().toISOString();
}

function stamp(text: string): LogLine {
  return { at: now(), text };
}

function remembered() {
  return (globalThis as typeof globalThis & { [globalKey]?: Machine })[globalKey];
}

function remember(machine: Machine) {
  (globalThis as typeof globalThis & { [globalKey]?: Machine })[globalKey] = machine;
}

async function saveShops(shops: ShopRecord[]) {
  await writeShops(shops);
}

function snapshot(machine: Machine): FloorSnapshot {
  return {
    running: true,
    supplier: machine.supplier,
    shelf: machine.shelf,
    log: machine.log,
    changedSku: machine.changedSku,
    listed: machine.shelf.filter((item) => item.status === "active").length,
    pulled: machine.shelf.filter((item) => item.status === "draft").length,
  };
}

function advanceDemo(machine: Machine) {
  if (machine.tick > 0) {
    const before = new Map(machine.supplier.map((item) => [item.sku, `${item.price}:${item.stock}`]));
    machine.supplier = drift(machine.supplier, machine.tick);
    machine.changedSku = machine.supplier.find((item) => before.get(item.sku) !== `${item.price}:${item.stock}`)?.sku ?? "";
  }
  const actions = planSync(machine.supplier, machine.shelf);
  machine.shelf = applyPlan(machine.shelf, machine.supplier, actions);
  if (actions.length) {
    machine.log = [...actions.map((action) => stamp(describe(action, machine.supplier))), ...machine.log].slice(0, 40);
  }
  machine.tick += 1;
}

async function readFeed(url: string) {
  if (!isPublicFeedUrl(url)) throw new Error("The feed URL has to be a public https link.");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("The supplier feed did not answer.");
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error("The supplier feed is too large.");
  return parseFeed(text);
}

async function advanceShop(machine: Machine, shop: ShopRecord) {
  if (Date.parse(shop.until) < Date.now()) return;
  try {
    await ensureShopifyAccess(shop);
  } catch (error) {
    const text = error instanceof Error ? error.message : "Shopify refused the Client ID and Client secret.";
    if (shop.log[0]?.text !== text) shop.log = [stamp(text), ...shop.log].slice(0, 30);
    return;
  }
  let supplier = machine.supplier;
  if (shop.feedUrl) {
    try {
      supplier = await readFeed(shop.feedUrl);
      shop.supplier = supplier;
    } catch (error) {
      const text = error instanceof Error ? error.message : "The feed could not be read.";
      if (shop.log[0]?.text !== text) shop.log = [stamp(text), ...shop.log].slice(0, 30);
      return;
    }
  }
  if (shop.trendMode) {
    const policies = await shopPolicyReadiness(shop.domain, shop.token);
    if (!policies.ready) {
      const note = `Publishing blocked: add ${policies.missing.join(", ")} in Shopify.`;
      if (shop.log[0]?.text !== note) shop.log = [stamp(note), ...shop.log].slice(0, 30);
      return;
    }
    const syncDate = new Date();
    const activeEvent = trendForDate(syncDate);
    const activeSkus = new Set(shop.shelf.filter((item) => item.status === "active").map((item) => item.sku));
    const selectionSource = activeEvent?.kind === "pricing"
      ? supplier.filter((item) => activeSkus.has(item.sku))
      : supplier;
    const selection = selectTrendProducts(selectionSource, syncDate, shop.maxProducts ?? 100);
    supplier = includeSeasonalPulls(selection.items, shop.shelf);
    shop.supplier = selection.items;
    if (selection.event) {
      const note = `Trend mode: ${selection.event.name} · ${selection.items.length} eligible products.`;
      if (shop.log[0]?.text !== note) shop.log = [stamp(note), ...shop.log].slice(0, 30);
    }
  }
  const actions = planSync(supplier, shop.shelf).slice(0, 4);
  if (!actions.length) return;
  try {
    const result = await pushToShopify({
      domain: shop.domain,
      token: shop.token,
      locationId: shop.locationId,
      publicationId: shop.publicationId,
      actions,
      supplier,
      shelf: shop.shelf,
    });
    shop.shelf = result.shelf;
    shop.locationId = result.locationId;
    shop.publicationId = result.publicationId;
    const fresh = result.notes.filter((note) => note !== shop.log[0]?.text);
    if (fresh.length) shop.log = [...fresh.map(stamp), ...shop.log].slice(0, 30);
  } catch (error) {
    const text = error instanceof Error ? error.message : "Shopify refused the update.";
    if (shop.log[0]?.text !== text) shop.log = [stamp(text), ...shop.log].slice(0, 30);
  }
}

export function startMachine() {
  const existing = remembered();
  if (existing) return existing;

  const machine: Machine = {
    supplier: catalog.map((item) => ({ ...item })),
    shelf: [],
    log: [],
    changedSku: "",
    tick: 0,
    shops: [],
    timers: [],
  };
  advanceDemo(machine);
  machine.timers.push(setInterval(() => advanceDemo(machine), 4000));
  if (!process.env.VERCEL) {
    machine.timers.push(setInterval(() => void syncShops(false), syncGapMs));
  }
  loading = readShops().then((shops) => {
    if (machine.shops.length === 0) machine.shops = shops;
  });
  remember(machine);
  return machine;
}

export function shopsReady() {
  startMachine();
  return loading ?? Promise.resolve();
}

export function getFloor() {
  return snapshot(startMachine());
}

export function publicShop(shop: ShopRecord) {
  return {
    domain: shop.domain,
    feedUrl: shop.feedUrl,
    trendMode: Boolean(shop.trendMode),
    maxProducts: shop.maxProducts ?? 100,
    until: shop.until,
    shelf: shop.shelf,
    log: shop.log,
    listed: shop.shelf.filter((item) => item.status === "active").length,
    pulled: shop.shelf.filter((item) => item.status === "draft").length,
  };
}

export async function syncShops(force: boolean) {
  await shopsReady();
  const machine = startMachine();
  machine.shops = await readShops();
  const nowMs = Date.now();
  let ran = false;
  for (const shop of machine.shops) {
    const previous = shop.lastSyncAt ? Date.parse(shop.lastSyncAt) : 0;
    if (!force && nowMs - previous < syncGapMs) continue;
    await advanceShop(machine, shop);
    shop.lastSyncAt = new Date(nowMs).toISOString();
    ran = true;
  }
  if (ran) await saveShops(machine.shops);
  return machine.shops.length;
}

export async function findShop(customerId: string) {
  await syncShops(false);
  return startMachine().shops.find((shop) => shop.customerId === customerId) ?? null;
}

export async function saveShop(record: ShopRecord) {
  await shopsReady();
  const machine = startMachine();
  machine.shops = await readShops();
  const index = machine.shops.findIndex((shop) => shop.customerId === record.customerId);
  const next = index >= 0 ? { ...machine.shops[index], ...record, shelf: record.shelf, log: record.log } : record;
  if (index >= 0) machine.shops[index] = next;
  else machine.shops.push(next);
  await saveShops(machine.shops);
  await advanceShop(machine, next);
  next.lastSyncAt = new Date().toISOString();
  await saveShops(machine.shops);
  return publicShop(next);
}
