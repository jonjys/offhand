import { syncShops } from "@/lib/machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: "This sync is closed." }, { status: 401 });
  }
  const shops = await syncShops(true);
  return Response.json({ ok: true, shops });
}
