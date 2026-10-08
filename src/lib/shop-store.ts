import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { ShelfItem, SupplierItem } from "@/lib/sync";

export type LogLine = { at: string; text: string };

export type ShopRecord = {
  customerId: string;
  domain: string;
  token: string;
  feedUrl: string;
  trendMode?: boolean;
  maxProducts?: number;
  until: string;
  clientId?: string;
  clientSecret?: string;
  tokenExpiresAt?: string;
  locationId?: string;
  /** Online Store publication id; null when the store has no such channel. */
  publicationId?: string | null;
  shelf: ShelfItem[];
  log: LogLine[];
  supplier?: SupplierItem[];
  lastSyncAt?: string;
};

const pathname = "offhand/shops.json";
const filePath = path.join(process.cwd(), "data", "shops.json");

function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readShops(): Promise<ShopRecord[]> {
  if (blobReady()) {
    const blob = await get(pathname, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) return [];
    const text = await new Response(blob.stream).text();
    const parsed = JSON.parse(text) as { shops?: ShopRecord[] };
    return parsed.shops ?? [];
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { shops?: ShopRecord[] };
    return parsed.shops ?? [];
  } catch {
    return [];
  }
}

export async function writeShops(shops: ShopRecord[]) {
  const body = JSON.stringify({ shops });
  if (blobReady()) {
    await put(pathname, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}
