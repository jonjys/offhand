import type { ShelfItem, SupplierItem } from "@/lib/sync";

export type TrendEvent = {
  slug: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  peakAt: Date;
  terms: string[];
  cultural?: boolean;
};

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function eventsForYear(year: number): TrendEvent[] {
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
      slug: "halloween",
      name: "Halloween",
      startsAt: utc(year, 9, 1),
      endsAt: utc(year, 10, 31),
      peakAt: utc(year, 10, 31),
      terms: ["halloween", "pumpkin", "ghost", "witch", "spider", "skeleton", "costume", "spooky", "bat decor"],
    },
    {
      slug: "dia-de-muertos",
      name: "Día de Muertos",
      startsAt: utc(year, 10, 20),
      endsAt: utc(year, 11, 2),
      peakAt: utc(year, 11, 2),
      terms: ["día de muertos", "dia de muertos", "ofrenda", "marigold", "papel picado", "calavera"],
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

function margin(item: SupplierItem) {
  if (!item.cost || item.cost <= 0) return null;
  return (item.price - item.cost) / item.price;
}

export function selectTrendProducts(
  supplier: SupplierItem[],
  now = new Date(),
  limit = 25,
) {
  const event = trendForDate(now);
  if (!event) return { event: null, items: [] as SupplierItem[] };

  const daysToPeak = Math.max(0, Math.ceil((event.peakAt.getTime() - now.getTime()) / 86_400_000));
  const protectedTerms = [
    "disney", "pixar", "marvel", "star wars", "harry potter", "pokemon", "barbie",
    "minecraft", "fortnite", "netflix", "stranger things", "wednesday addams",
  ];
  const euRegions = ["eu", "european union", "sweden", "germany", "poland", "netherlands", "france", "spain", "italy", "denmark", "finland", "estonia", "latvia", "lithuania", "czechia", "austria", "belgium"];
  const scored = supplier.flatMap((item) => {
    if (item.stock <= 0 || !item.imageUrl || item.rightsCleared !== true) return [];
    const text = haystack(item);
    if (protectedTerms.some((term) => text.includes(term))) return [];
    const matches = event.terms.filter((term) => text.includes(term));
    if (!matches.length) return [];
    const grossMargin = margin(item);
    if (grossMargin !== null && grossMargin < 0.35) return [];

    const digital = item.fulfillmentType === "digital";
    const euWarehouse = item.fulfillmentType === "physical"
      && euRegions.some((region) => item.warehouseRegion?.trim().toLowerCase() === region);
    const deliveryDays = item.deliveryDays;
    if (!digital && (!euWarehouse || deliveryDays === undefined || deliveryDays < 1 || deliveryDays > 5)) return [];
    if (!digital && deliveryDays > daysToPeak) return [];

    const score = matches.length * 25 + Math.min(item.stock, 25) + Math.round((grossMargin ?? 0.35) * 20) - (digital ? 0 : deliveryDays ?? 5);
    return [{ item: { ...item, trendSlug: event.slug }, score }];
  });

  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return { event, items: scored.slice(0, Math.max(1, Math.min(25, limit))).map((entry) => entry.item) };
}

export function includeSeasonalPulls(selected: SupplierItem[], shelf: ShelfItem[]) {
  const selectedSkus = new Set(selected.map((item) => item.sku));
  const pulls = shelf
    .filter((item) => item.status === "active" && !selectedSkus.has(item.sku))
    .map((item) => ({ sku: item.sku, title: item.title, price: item.price, stock: 0 }));
  return [...selected, ...pulls];
}
