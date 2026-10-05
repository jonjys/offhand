import type { SupplierItem } from "@/lib/sync";

const aliases: Record<string, string[]> = {
  sku: ["sku", "item", "item #", "item number", "item_number", "code", "variant sku", "style"],
  title: ["title", "name", "product", "product name", "item name"],
  price: ["price", "retail", "sell price", "msrp", "asking"],
  cost: ["cost", "wholesale", "unit cost", "your cost"],
  shippingCost: ["shipping cost", "freight cost", "delivery cost", "postage cost"],
  feePercent: ["fee percent", "platform fee percent", "transaction fee percent", "fee %"],
  stock: ["stock", "qty", "quantity", "inventory", "on hand", "available", "count"],
  description: ["description", "body", "details"],
  tags: ["tags", "keywords", "category", "categories"],
  deliveryDays: ["delivery days", "shipping days", "lead time", "lead time days"],
  imageUrl: ["image url", "image", "photo url", "main image"],
  fulfillmentType: ["fulfillment type", "fulfillment", "product type", "delivery type"],
  warehouseRegion: ["warehouse region", "warehouse", "ships from", "ship from", "stock region"],
  rightsCleared: ["rights cleared", "image rights", "licensed", "rights approved"],
  trackedDelivery: ["tracked delivery", "tracked shipping", "tracking included", "trackable"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function columnIndex(headers: string[], names: string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const name of names) {
    const index = normalized.indexOf(name);
    if (index >= 0) return index;
  }
  for (const name of names) {
    const index = normalized.findIndex((header) => header.includes(name));
    if (index >= 0) return index;
  }
  return -1;
}

function moneyValue(value: string | undefined) {
  if (!value) return null;
  const number = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number);
}

function booleanValue(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "y", "approved", "cleared"].includes(value.trim().toLowerCase());
}

function fulfillmentValue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "digital" || normalized === "download" || normalized === "printable") return "digital" as const;
  if (normalized === "physical") return "physical" as const;
  return undefined;
}

function nonNegativeNumber(value: string | undefined) {
  if (value === undefined || value.trim() === "") return undefined;
  const number = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function stockValue(value: string | undefined) {
  if (!value) return 0;
  const number = Number(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim()));
}

function rowsToItems(headers: string[], rows: string[][]) {
  const skuIndex = columnIndex(headers, aliases.sku);
  const titleIndex = columnIndex(headers, aliases.title);
  const priceIndex = columnIndex(headers, aliases.price);
  const costIndex = columnIndex(headers, aliases.cost);
  const shippingCostIndex = columnIndex(headers, aliases.shippingCost);
  const feePercentIndex = columnIndex(headers, aliases.feePercent);
  const stockIndex = columnIndex(headers, aliases.stock);
  const descriptionIndex = columnIndex(headers, aliases.description);
  const tagsIndex = columnIndex(headers, aliases.tags);
  const deliveryDaysIndex = columnIndex(headers, aliases.deliveryDays);
  const imageUrlIndex = columnIndex(headers, aliases.imageUrl);
  const fulfillmentTypeIndex = columnIndex(headers, aliases.fulfillmentType);
  const warehouseRegionIndex = columnIndex(headers, aliases.warehouseRegion);
  const rightsClearedIndex = columnIndex(headers, aliases.rightsCleared);
  const trackedDeliveryIndex = columnIndex(headers, aliases.trackedDelivery);

  if (skuIndex < 0 || titleIndex < 0 || (priceIndex < 0 && costIndex < 0)) {
    throw new Error("The feed needs a sku, a title, and a price or a cost. Column names are detected automatically.");
  }

  const items: SupplierItem[] = [];
  for (const row of rows) {
    const sku = (row[skuIndex] ?? "").trim();
    const title = (row[titleIndex] ?? "").trim();
    if (!sku || !title) continue;
    const cost = moneyValue(row[costIndex]);
    const price = moneyValue(row[priceIndex]) ?? (cost ?? 0) * 2;
    if (!price) continue;
    const deliveryDays = deliveryDaysIndex >= 0 ? stockValue(row[deliveryDaysIndex]) : undefined;
    const imageUrl = imageUrlIndex >= 0 ? row[imageUrlIndex]?.trim() : undefined;
    items.push({
      sku,
      title,
      price,
      stock: stockIndex >= 0 ? stockValue(row[stockIndex]) : 1,
      description: descriptionIndex >= 0 ? row[descriptionIndex]?.trim() : undefined,
      tags: tagsIndex >= 0 ? (row[tagsIndex] ?? "").split(/[|;,]/).map((tag) => tag.trim()).filter(Boolean) : undefined,
      cost: cost ?? undefined,
      shippingCost: shippingCostIndex >= 0 ? nonNegativeNumber(row[shippingCostIndex]) : undefined,
      feePercent: feePercentIndex >= 0 ? nonNegativeNumber(row[feePercentIndex]) : undefined,
      deliveryDays,
      imageUrl: imageUrl?.startsWith("https://") ? imageUrl : undefined,
      fulfillmentType: fulfillmentTypeIndex >= 0 ? fulfillmentValue(row[fulfillmentTypeIndex]) : undefined,
      warehouseRegion: warehouseRegionIndex >= 0 ? row[warehouseRegionIndex]?.trim() : undefined,
      rightsCleared: rightsClearedIndex >= 0 ? booleanValue(row[rightsClearedIndex]) : false,
      trackedDelivery: trackedDeliveryIndex >= 0 ? booleanValue(row[trackedDeliveryIndex]) : false,
    });
  }

  if (items.length === 0) throw new Error("The feed had no products with a sku, a title, and a price.");
  return items;
}

function objectsToItems(rows: Record<string, unknown>[]) {
  if (rows.length === 0) throw new Error("The feed was empty.");
  const headers = Object.keys(rows[0]);
  const matrix = rows.map((row) => headers.map((header) => String(row[header] ?? "")));
  return rowsToItems(headers, matrix);
}

export function parseFeed(text: string): SupplierItem[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The feed was empty.");

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? ((parsed as { products?: unknown; items?: unknown; data?: unknown }).products ??
          (parsed as { items?: unknown }).items ??
          (parsed as { data?: unknown }).data)
        : null;
    if (!Array.isArray(rows)) throw new Error("The JSON feed needs an array of products.");
    return objectsToItems(rows.filter((row) => row && typeof row === "object") as Record<string, unknown>[]);
  }

  const table = parseCsv(trimmed);
  if (table.length < 2) throw new Error("The CSV feed needs a header and at least one product.");
  return rowsToItems(table[0], table.slice(1));
}

export function isPublicFeedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  return true;
}
