import type { ShelfItem, SupplierItem } from "@/lib/sync";

export type TrendEvent = {
  slug: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  peakAt: Date;
  terms: string[];
  kind?: "collection" | "pricing";
  requiresExplicitTag?: boolean;
  cultural?: boolean;
};

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function blackFriday(year: number) {
  const thanksgiving = utc(year, 11, 1);
  const firstThursdayOffset = (4 - thanksgiving.getUTCDay() + 7) % 7;
  return addDays(thanksgiving, firstThursdayOffset + 22);
}

function eventsForYear(year: number): TrendEvent[] {
  const easter = easterSunday(year);
  const blackFridayDate = blackFriday(year);
  return [
    {
      slug: "valentines",
      name: "Valentine's Day",
      startsAt: utc(year, 1, 10),
      endsAt: utc(year, 2, 14),
      peakAt: utc(year, 2, 14),
      terms: ["valentine", "heart", "romantic", "couples", "love gift"],
    },
    {
      slug: "easter",
      name: "Easter",
      startsAt: addDays(easter, -42),
      endsAt: easter,
      peakAt: easter,
      terms: ["easter", "egg hunt", "easter bunny", "spring table", "easter decor"],
    },
    {
      slug: "summer",
      name: "Summer",
      startsAt: utc(year, 5, 1),
      endsAt: utc(year, 8, 31),
      peakAt: utc(year, 6, 20),
      terms: ["summer", "outdoor party", "picnic", "beach", "garden", "midsummer"],
    },
    {
      slug: "halloween",
      name: "Halloween",
      startsAt: utc(year, 9, 1),
      endsAt: utc(year, 10, 31),
      peakAt: utc(year, 10, 31),
      terms: ["halloween", "pumpkin", "ghost", "witch", "spider", "skeleton", "costume", "maskerade", "spooky", "bat decor", "party decor", "pet costume", "halloween light"],
    },
    {
      slug: "dia-de-muertos",
      name: "Día de Muertos",
      startsAt: utc(year, 11, 1),
      endsAt: utc(year, 11, 2),
      peakAt: utc(year, 11, 2),
      terms: ["día de muertos", "dia de muertos"],
      requiresExplicitTag: true,
      cultural: true,
    },
    {
      slug: "christmas",
      name: "Christmas",
      startsAt: utc(year, 11, 3),
      endsAt: utc(year, 12, 24),
      peakAt: utc(year, 12, 24),
      terms: ["christmas", "xmas", "advent", "ornament", "stocking", "tree decor", "gift wrap", "holiday lights"],
    },
    {
      slug: "black-friday-cyber-week",
      name: "Black Friday / Cyber Week",
      startsAt: addDays(blackFridayDate, -4),
      endsAt: addDays(blackFridayDate, 4),
      peakAt: blackFridayDate,
      terms: [],
      kind: "pricing",
    },
    {
      slug: "new-year",
      name: "New Year",
      startsAt: utc(year, 12, 20),
      endsAt: utc(year + 1, 1, 1),
      peakAt: utc(year, 12, 31),
      terms: ["new year", "party decor", "party light", "confetti", "countdown"],
    },
  ];
}

export function trendForDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const active = [...eventsForYear(year - 1), ...eventsForYear(year)]
    .filter((event) => now >= event.startsAt && now <= event.endsAt)
    .sort((a, b) => Math.abs(a.peakAt.getTime() - now.getTime()) - Math.abs(b.peakAt.getTime() - now.getTime()));
  return active[0] ?? null;
}

function haystack(item: SupplierItem) {
  return [item.title, item.description, ...(item.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
}

function netMargin(item: SupplierItem) {
  if (
    !Number.isFinite(item.price) || item.price <= 0 ||
    !Number.isFinite(item.cost) || (item.cost ?? -1) < 0 ||
    !Number.isFinite(item.shippingCost) || (item.shippingCost ?? -1) < 0 ||
    !Number.isFinite(item.feePercent) || (item.feePercent ?? -1) < 0 || (item.feePercent ?? 101) > 100 ||
    item.cost === undefined ||
    item.shippingCost === undefined ||
    item.feePercent === undefined
  ) return null;
  const net = item.price - item.cost - item.shippingCost - item.price * (item.feePercent / 100);
  return { amount: net, ratio: net / item.price };
}

export function productLimit(limit = 100) {
  return Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.floor(limit))) : 0;
}

/** Supplier evidence is required even when seasonal selection is disabled. */
export function saleEligible(item: SupplierItem) {
  const protectedTerms = [
    "disney", "pixar", "marvel", "star wars", "harry potter", "pokemon", "barbie",
    "minecraft", "fortnite", "netflix", "stranger things", "wednesday addams",
    "official", "celebrity", "famous actor", "famous singer", "movie character",
    "film character", "tv character", "religious caricature",
  ];
  const euRegions = [
    "eu", "european union", "sweden", "germany", "poland", "netherlands", "france",
    "spain", "italy", "denmark", "finland", "estonia", "latvia", "lithuania",
    "czechia", "austria", "belgium",
  ];
  if (!item.sku.trim() || !item.title.trim() || !Number.isInteger(item.stock) || item.stock <= 0) return false;
  if (item.rightsCleared !== true || !Number.isFinite(item.deliveryDays)) return false;
  try {
    const image = new URL(item.imageUrl ?? "");
    if (image.protocol !== "https:" || image.username || image.password) return false;
  } catch { return false; }
  if (protectedTerms.some((term) => haystack(item).includes(term))) return false;
  const margin = netMargin(item);
  if (!margin || !Number.isFinite(margin.amount) || margin.amount <= 0) return false;
  if (item.fulfillmentType === "digital") return item.deliveryDays === 0;
  return item.fulfillmentType === "physical"
    && euRegions.includes(item.warehouseRegion?.trim().toLowerCase() ?? "")
    && item.trackedDelivery === true
    && (item.deliveryDays as number) >= 3 && (item.deliveryDays as number) <= 5;
}

function eligibleProducts(supplier: SupplierItem[]) {
  const counts = new Map<string, number>();
  for (const item of supplier) counts.set(item.sku, (counts.get(item.sku) ?? 0) + 1);
  return supplier.filter((item) => counts.get(item.sku) === 1 && saleEligible(item));
}

export function selectSaleProducts(supplier: SupplierItem[], limit = 100) {
  return eligibleProducts(supplier).slice(0, productLimit(limit));
}

export function selectTrendProducts(
  supplier: SupplierItem[],
  now = new Date(),
  limit = 100,
) {
  const event = trendForDate(now);
  if (!event) return { event: null, items: [] as SupplierItem[] };

  const scored = eligibleProducts(supplier).flatMap((item) => {

    const text = haystack(item);
    if (event.requiresExplicitTag) {
      const tags = (item.tags ?? []).map((tag) => tag.trim().toLowerCase());
      if (!tags.some((tag) => tag === "día de muertos" || tag === "dia de muertos")) return [];
    }
    const matches = event.kind === "pricing" ? ["existing-product"] : event.terms.filter((term) => text.includes(term));
    if (!matches.length) return [];

    const margin = netMargin(item);
    if (!margin || margin.amount <= 0) return [];

    const deliveryDays = item.deliveryDays as number;
    if (now.getTime() + deliveryDays * 86_400_000 > event.peakAt.getTime()) return [];

    const score = matches.length * 25 + Math.min(item.stock, 25) + Math.round(margin.ratio * 20) - deliveryDays;
    return [{ item: { ...item, trendSlug: event.slug }, score }];
  });

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return { event, items: scored.slice(0, productLimit(limit)).map((entry) => entry.item) };
}

export function includeSeasonalPulls(selected: SupplierItem[], shelf: ShelfItem[]) {
  const selectedSkus = new Set(selected.map((item) => item.sku));
  const pulls = shelf
    .filter((item) => item.status === "active" && !selectedSkus.has(item.sku))
    .map((item) => ({ sku: item.sku, title: item.title, price: item.price, stock: 0 }));
  return [...selected, ...pulls];
}

