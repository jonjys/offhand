import Link from "next/link";
import { FloorView, type FloorSnapshot } from "@/components/floor-view";
import { getFloor } from "@/lib/machine";
import { ORG, SITE_URL, faq } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const params = await searchParams;
  const floor = getFloor() satisfies FloorSnapshot;

  const jsonLd = [
    { "@context": "https://schema.org", ...ORG, brand: "Offhand" },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Offhand",
      url: `${SITE_URL}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Offhand lists supplier products on Shopify, updates the price, and pulls the listing at zero stock. No approval queue.",
      offers: {
        "@type": "Offer",
        price: "29",
        priceCurrency: "USD",
        description: "One Shopify store for 30 days, one-time payment",
        url: `${SITE_URL}/#store`,
      },
      publisher: ORG,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-8 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <a href="#floor" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
          Offhand
        </a>
        <nav className="flex gap-4 text-sm">
          <a href="#store" className="underline-offset-4 hover:underline">
            Your store
          </a>
          <Link href="/guides" className="underline-offset-4 hover:underline">
            Guides
          </Link>
          <a href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </a>
        </nav>
      </header>

      <section className="grid max-w-2xl gap-5">
        <p className="text-sm tracking-[0.18em] text-primary uppercase">Already running</p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-5xl leading-[0.95] tracking-tight sm:text-6xl">
          A Shopify resale store that stocks itself.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          The supplier moves. Offhand lists the product, changes the price, and pulls the listing when the count hits zero. There is no queue and nothing to approve.
        </p>
      </section>

      <section id="floor">
        <FloorView initial={floor} cancelled={params.cancelled === "1"} />
      </section>

      <section id="how" className="grid max-w-2xl gap-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl tracking-tight">How Offhand works</h2>
        <ol className="grid list-decimal gap-2 pl-6 leading-7 text-muted-foreground">
          <li>Point it at a supplier feed: a public https CSV or JSON, or a published Google Sheet. Or leave it blank to follow the built-in demo catalog.</li>
          <li>On each pass it compares every supplier row with your Shopify shelf, matched by SKU.</li>
          <li>It lists what is in stock, reprices when the supplier price moves, updates stock counts, pulls a listing to Draft at zero, and relists it when stock returns. Nothing waits for approval.</li>
        </ol>
        <p className="text-sm leading-6 text-muted-foreground">
          New to supplier syncing? Read <Link href="/guides/sync-supplier-stock-with-shopify" className="underline underline-offset-4">how to sync supplier stock with Shopify</Link>, including the other tools you can use.
        </p>
      </section>

      <section id="faq" className="grid max-w-2xl gap-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl tracking-tight">Questions</h2>
        <dl className="grid gap-5">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-1 text-sm leading-7 text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
        <p>The floor on this page is the machine, using a live resale catalog. A paid store follows the same rules against your Shopify admin.</p>
        <p className="mt-2">Nytto Labs · $29 for 30 days, tax included.</p>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
