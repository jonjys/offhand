import { grantFromSession } from "@/lib/stripe-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId?.trim() ?? "";
  if (!sessionId) return Response.json({ error: "This receipt has no payment." }, { status: 400 });

  try {
    const result = await grantFromSession(sessionId);
    if (!result.paid) return Response.json({ error: "The payment is not finished yet." }, { status: 402 });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The receipt could not be read.";
    return Response.json({ error: message }, { status: 400 });
  }
}
