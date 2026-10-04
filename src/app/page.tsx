import { FloorView, type FloorSnapshot } from "@/components/floor-view";
import { demoStore } from "@/lib/demo-store";
import { getFloor } from "@/lib/machine";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const params = await searchParams;
  const floor = getFloor() satisfies FloorSnapshot;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-8 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <a href="#floor" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
          Offhand
        </a>
        <nav className="flex gap-4 text-sm">
          <a href={demoStore.url} className="underline-offset-4 hover:underline" rel="noopener noreferrer" target="_blank">
            Live store
          </a>
          <a href="#store" className="underline-offset-4 hover:underline">
            Your store
          </a>
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

      <section id="proof" className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="text-sm tracking-[0.18em] text-primary uppercase">On a real store</p>
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl tracking-tight">
          The same machine, pointed at a Shopify store you can open.
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Every product in the collection below was listed by Offhand from the catalog above. Nobody typed a title or set a price. Open any product and the note on it says so. When the catalog pulls an item, the listing goes with it.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            href={demoStore.collectionUrl}
            className="rounded-lg bg-primary px-4 py-2.5 text-primary-foreground underline-offset-4 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open the live collection
          </a>
          <a
            href={demoStore.howItWorksUrl}
            className="rounded-lg border border-border px-4 py-2.5 underline-offset-4 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            How that store works
          </a>
        </div>
      </section>

      <footer className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
        <p>The floor on this page is the machine, using a live resale catalog. The store linked above is that machine against a real Shopify admin. A paid store follows the same rules against yours.</p>
        <p className="mt-2">Nytto Labs · $29 for 30 days, tax included.</p>
      </footer>
    </main>
  );
}
