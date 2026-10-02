import { getFloor } from "@/lib/machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getFloor(), { headers: { "cache-control": "no-store" } });
}
