export type SupplierItem = {
  sku: string;
  title: string;
  price: number;
  stock: number;
  description?: string;
  tags?: string[];
  cost?: number;
  deliveryDays?: number;
  imageUrl?: string;
  fulfillmentType?: "digital" | "physical";
  warehouseRegion?: string;
  rightsCleared?: boolean;
  trackedDelivery?: boolean;
  trendSlug?: string;
};

export type ShelfItem = {
  sku: string;
  title: string;
  price: number;
  stock: number;
  status: "active" | "draft";
  productId?: string;
  variantId?: string;
  inventoryItemId?: string;
  /** Set once the product is on the Online Store channel. */
  published?: boolean;
};

export type Action =
  | { type: "list"; sku: string }
  | { type: "relist"; sku: string }
  | { type: "pull"; sku: string }
  | { type: "reprice"; sku: string; from: number; to: number }
  | { type: "restock"; sku: string; from: number; to: number };

export function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function planSync(supplier: SupplierItem[], shelf: ShelfItem[]): Action[] {
  const listed = new Map(shelf.map((item) => [item.sku, item]));
  const actions: Action[] = [];

  for (const item of supplier) {
    const current = listed.get(item.sku);
    if (!current) {
      if (item.stock > 0) actions.push({ type: "list", sku: item.sku });
      continue;
    }

    if (item.stock <= 0 && current.status === "active") {
      actions.push({ type: "pull", sku: item.sku });
      continue;
    }

    if (item.stock > 0 && current.status === "draft") {
      actions.push({ type: "relist", sku: item.sku });
    }

    if (item.stock > 0 && item.price !== current.price) {
      actions.push({ type: "reprice", sku: item.sku, from: current.price, to: item.price });
    }

    if (current.status === "active" && item.stock > 0 && item.stock !== current.stock) {
      actions.push({ type: "restock", sku: item.sku, from: current.stock, to: item.stock });
    }
  }

  return actions;
}

export function applyPlan(shelf: ShelfItem[], supplier: SupplierItem[], actions: Action[]): ShelfItem[] {
  const bySku = new Map(shelf.map((item) => [item.sku, { ...item }]));
  const source = new Map(supplier.map((item) => [item.sku, item]));

  for (const action of actions) {
    const item = source.get(action.sku);
    if (!item) continue;
    const previous = bySku.get(action.sku);

    if (action.type === "list" || action.type === "relist") {
      bySku.set(action.sku, {
        sku: item.sku,
        title: item.title,
        price: item.price,
        stock: item.stock,
        status: "active",
        productId: previous?.productId,
        variantId: previous?.variantId,
        inventoryItemId: previous?.inventoryItemId,
      });
      continue;
    }

    if (!previous) continue;

    if (action.type === "pull") {
      bySku.set(action.sku, { ...previous, stock: 0, status: "draft" });
      continue;
    }

    if (action.type === "reprice") {
      bySku.set(action.sku, { ...previous, price: action.to, title: item.title });
      continue;
    }

    if (action.type === "restock") {
      bySku.set(action.sku, { ...previous, stock: action.to, title: item.title });
    }
  }

  return [...bySku.values()];
}

export function describe(action: Action, supplier: SupplierItem[]) {
  const item = supplier.find((entry) => entry.sku === action.sku);
  const title = item?.title ?? action.sku;

  if (action.type === "list") return `Listed ${title} at ${money(item?.price ?? 0)}.`;
  if (action.type === "relist") return `Relisted ${title}. The supplier has ${item?.stock ?? 0} again.`;
  if (action.type === "pull") return `Pulled ${title}. The supplier is at zero.`;
  if (action.type === "reprice") return `Repriced ${title} from ${money(action.from)} to ${money(action.to)}.`;
  return `Updated ${title} stock from ${action.from} to ${action.to}.`;
}

export function drift(items: SupplierItem[], tick: number): SupplierItem[] {
  const next = items.map((item) => ({ ...item }));
  const item = next[tick % next.length];
  const kind = tick % 4;

  if (kind === 0) item.stock = 0;
  else if (kind === 1) item.stock = item.stock === 0 ? 2 : item.stock + 1;
  else if (kind === 2) item.price = Math.max(12, item.price + (tick % 2 === 0 ? -8 : 6));
  else item.stock = item.stock + 1;

  return next;
}

export function runUnattended(seed: SupplierItem[], ticks: number) {
  let supplier = seed.map((item) => ({ ...item }));
  let shelf: ShelfItem[] = [];
  const log: string[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    if (tick > 0) supplier = drift(supplier, tick);
    const actions = planSync(supplier, shelf);
    shelf = applyPlan(shelf, supplier, actions);
    for (const action of actions) log.push(describe(action, supplier));
  }

  return { supplier, shelf, log };
}
