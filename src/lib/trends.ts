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
    item.price <= 0 ||
    item.cost === undefined ||
    item.shippingCost === undefined ||
    item.feePercent === undefined
  ) return null;
  const net = item.price - item.cost - item.shippingCost - item.price * (item.feePercent / 100);
  return { amount: net, ratio: net / item.price };
}

export function selectTrendProducts(
  supplier: SupplierItem[],
  now = new Date(),
  limit = 100,
) {
  const event = trendForDate(now);
  if (!event) return { event: null, items: [] as SupplierItem[] };

  const daysToPeak = Math.max(0, Math.ceil((event.peakAt.getTime() - now.getTime()) / 86_400_000));
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
  const scored = supplier.flatMap((item) => {
    if (!item.sku.trim() || !item.title.trim() || item.price <= 0 || item.stock <= 0) return [];
    if (!item.imageUrl || item.rightsCleared !== true || item.deliveryDays === undefined) return [];

    const text = haystack(item);
    if (protectedTerms.some((term) => text.includes(term))) return [];
    if (event.requiresExplicitTag) {
      const tags = (item.tags ?? []).map((tag) => tag.trim().toLowerCase());
      if (!tags.some((tag) => tag === "día de muertos" || tag === "dia de muertos")) return [];
    }
    const matches = event.kind === "pricing" ? ["existing-product"] : event.terms.filter((term) => text.includes(term));
    if (!matches.length) return [];

    const margin = netMargin(item);
    if (!margin || margin.amount <= 0) return [];

    const digital = item.fulfillmentType === "digital";
    const euWarehouse = item.fulfillmentType === "physical"
      && euRegions.some((region) => item.warehouseRegion?.trim().toLowerCase() === region);
    const deliveryDays = item.deliveryDays;
    if (digital && deliveryDays !== 0) return [];
    if (!digital && (!euWarehouse || item.trackedDelivery !== true || deliveryDays < 3 || deliveryDays > 5)) return [];
    if (deliveryDays > daysToPeak) return [];

    const score = matches.length * 25 + Math.min(item.stock, 25) + Math.round(margin.ratio * 20) - deliveryDays;
    return [{ item: { ...item, trendSlug: event.slug }, score }];
  });

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return { event, items: scored.slice(0, Math.max(1, Math.min(100, limit))).map((entry) => entry.item) };
}

export function includeSeasonalPulls(selected: SupplierItem[], shelf: ShelfItem[]) {
  const selectedSkus = new Set(selected.map((item) => item.sku));
  const pulls = shelf
    .filter((item) => item.status === "active" && !selectedSkus.has(item.sku))
    .map((item) => ({ sku: item.sku, title: item.title, price: item.price, stock: 0 }));
  return [...selected, ...pulls];
}
