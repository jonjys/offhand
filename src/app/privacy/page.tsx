import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Offhand stores, what it sends to Stripe and Shopify, and what stays on the server.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-4 py-16">
      <Link href="/" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
        Offhand
      </Link>
      <h1 className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight">Privacy</h1>
      <div className="grid gap-4 text-sm leading-7 text-muted-foreground">
        <p>The public floor uses a catalog that lives in this app. It is not your store and it does not read your Shopify account.</p>
        <p>
          If you pay, Stripe processes the card for Nytto Labs. The browser keeps a key so this device can open the connected store. The Client ID and Client secret stay on the server. Offhand uses them only to refresh the Shopify token and to list, reprice, and pull products.
        </p>
        <p>A supplier feed URL is fetched by the server on its own. Offhand does not ask you to review a listing before it goes up.</p>
      </div>
    </main>
  );
}
