import type { Metadata } from "next";
import { ReceiptView } from "@/components/receipt-view";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  return <ReceiptView sessionId={params.session_id ?? ""} />;
}
