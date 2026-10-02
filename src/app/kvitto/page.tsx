import { redirect } from "next/navigation";

export default async function OldReceipt({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const session = params.session_id;
  redirect(session ? `/receipt?session_id=${encodeURIComponent(session)}` : "/receipt");
}
