import { FloorView, type FloorSnapshot } from "@/components/floor-view";
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

      <footer className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
        <p>The floor on this page is the machine, using a live resale catalog. A paid store follows the same rules against your Shopify admin.</p>
        <p className="mt-2">Nytto Labs · $29 for 30 days, tax included.</p>
      </footer>
    </main>
  );
}
