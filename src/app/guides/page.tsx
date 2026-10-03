import type { Metadata } from "next";
import Link from "next/link";
import { getGuides } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guides for Shopify resellers",
  description:
    "Plain guides on syncing supplier stock with Shopify, automating out-of-stock handling, and preparing a supplier feed.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const guides = getGuides();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Offhand guides",
    url: `${SITE_URL}/guides`,
    hasPart: guides.map((guide) => ({ "@type": "Article", headline: guide.title, url: `${SITE_URL}/guides/${guide.slug}` })),
  };
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-12">
      <Link href="/" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
        Offhand
      </Link>
      <h1 className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight">Guides for Shopify resellers</h1>
      <p className="text-muted-foreground">Practical notes on keeping a resale store in step with a supplier.</p>
      <ul className="grid gap-4">
        {guides.map((guide) => (
          <li key={guide.slug} className="rounded-xl border border-border p-4">
            <Link href={`/guides/${guide.slug}`} className="font-[family-name:var(--font-fraunces)] text-xl underline-offset-4 hover:underline">
              {guide.title}
            </Link>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.description}</p>
          </li>
        ))}
      </ul>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
