import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalog } from "@/lib/catalog";
import { isPublicFeedUrl, parseFeed } from "@/lib/feed";
import { pushToShopify } from "@/lib/shopify";
import { applyPlan, describe, drift, planSync, type ShelfItem, type SupplierItem } from "@/lib/sync";

export type LogLine = { at: string; text: string };

export type ShopRecord = {
  customerId: string;
  domain: string;
  token: string;
  feedUrl: string;
  until: string;
  locationId?: string;
  shelf: ShelfItem[];
  log: LogLine[];
  supplier?: SupplierItem[];
};

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

const filePath = path.join(process.cwd(), "data", "shops.json");
const globalKey = "__offhand";
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

async function loadShops() {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { shops?: ShopRecord[] };
    return parsed.shops ?? [];
  } catch {
    return [];
  }
}

async function saveShops(shops: ShopRecord[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ shops }, null, 2));
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
  const actions = planSync(supplier, shop.shelf).slice(0, 4);
  if (!actions.length) return;
  try {
    const result = await pushToShopify({
      domain: shop.domain,
      token: shop.token,
      locationId: shop.locationId,
      actions,
      supplier,
      shelf: shop.shelf,
    });
    shop.shelf = result.shelf;
    shop.locationId = result.locationId;
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
  machine.timers.push(
    setInterval(() => {
      void (async () => {
        for (const shop of machine.shops) await advanceShop(machine, shop);
        if (machine.shops.length) await saveShops(machine.shops);
      })();
    }, 20000),
  );
  loading = loadShops().then((shops) => {
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
    until: shop.until,
    shelf: shop.shelf,
    log: shop.log,
    listed: shop.shelf.filter((item) => item.status === "active").length,
    pulled: shop.shelf.filter((item) => item.status === "draft").length,
  };
}

export async function findShop(customerId: string) {
  await shopsReady();
  return startMachine().shops.find((shop) => shop.customerId === customerId) ?? null;
}

export async function saveShop(record: ShopRecord) {
  await shopsReady();
  const machine = startMachine();
  const index = machine.shops.findIndex((shop) => shop.customerId === record.customerId);
  if (index >= 0) machine.shops[index] = record;
  else machine.shops.push(record);
  await saveShops(machine.shops);
  void advanceShop(machine, record).then(() => saveShops(machine.shops));
  return publicShop(record);
}
