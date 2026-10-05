"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readPass, savePass } from "@/lib/browser-store";
import { plans } from "@/lib/plans";
import { money } from "@/lib/sync";

type Row = { sku: string; title: string; price: number; stock: number; status?: "active" | "draft" };
type Line = { at: string; text: string };

export type FloorSnapshot = {
  supplier: Row[];
  shelf: Row[];
  log: Line[];
  changedSku: string;
  listed: number;
  pulled: number;
};

type ShopState = {
  domain: string;
  feedUrl: string;
  trendMode?: boolean;
  maxProducts?: number;
  until: string;
  shelf: Row[];
  log: Line[];
  listed: number;
  pulled: number;
};

function clock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function Rows({ rows, changedSku, shelf }: { rows: Row[]; changedSku?: string; shelf?: boolean }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{shelf ? "The shelf is empty. The next pass fills it." : "Waiting on the supplier."}</p>;
  }
  return (
    <ul className="grid gap-2">
      {rows.map((row) => {
        const pulled = row.status === "draft";
        const hot = row.sku === changedSku;
        return (
          <li
            key={row.sku}
            className={`grid grid-cols-[1fr_auto] gap-3 rounded-xl border px-3 py-2 ${
              hot ? "border-primary" : "border-border"
            } ${pulled ? "opacity-60" : ""}`}
          >
            <div>
              <p className="text-sm">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {row.sku}
                {pulled ? " · pulled" : ""}
              </p>
            </div>
            <p className="text-right text-sm">
              {money(row.price)}
              <span className="block text-xs text-muted-foreground">{row.stock} in stock</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Tape({ log }: { log: Line[] }) {
  if (!log.length) return <p className="text-sm text-muted-foreground">The tape starts on the first change.</p>;
  return (
    <ol className="grid gap-2 font-mono text-xs leading-5">
      {log.map((line, index) => (
        <li key={`${line.at}-${index}`}>
          <span className="text-muted-foreground">{clock(line.at)} </span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

export function FloorView({ initial, cancelled }: { initial: FloorSnapshot; cancelled: boolean }) {
  const [floor, setFloor] = useState(initial);
  const [until, setUntil] = useState("");
  const [token, setToken] = useState("");
  const [paid, setPaid] = useState(false);
  const [shop, setShop] = useState<ShopState | null>(null);
  const [domain, setDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [trendMode, setTrendMode] = useState(true);
  const [maxProducts, setMaxProducts] = useState(100);
  const [busy, setBusy] = useState<"pay" | "connect" | null>(null);
  const [error, setError] = useState(cancelled ? "Checkout was cancelled. The floor kept running." : "");

  useEffect(() => {
    const pass = readPass();
    const frame = window.setTimeout(() => {
      setToken(pass.token);
      setUntil(pass.until);
      setPaid(Boolean(pass.token && pass.until && Date.parse(pass.until) > Date.now()));
    }, 0);
    const timer = window.setInterval(() => {
      void fetch("/api/floor")
        .then((response) => response.json())
        .then((data: FloorSnapshot) => setFloor(data))
        .catch(() => undefined);
    }, 2000);
    return () => {
      window.clearTimeout(frame);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const pull = () => {
      void fetch("/api/shop", { headers: { authorization: `Bearer ${token}` } })
        .then((response) => response.json())
        .then((data: { shop?: ShopState | null; until?: string; active?: boolean; error?: string }) => {
          if (data.until) {
            setUntil(data.until);
            savePass(token, data.until);
          }
          if (typeof data.active === "boolean") setPaid(data.active);
          setShop(data.shop ?? null);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 5000);
    return () => window.clearInterval(timer);
  }, [token]);

  async function pay() {
    setBusy("pay");
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Checkout could not be opened.");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout could not be opened.");
      setBusy(null);
    }
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy("connect");
    setError("");
    try {
      const response = await fetch("/api/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, domain, clientId, clientSecret, feedUrl, trendMode, maxProducts }),
      });
      const data = (await response.json()) as { shop?: ShopState; error?: string };
      if (!response.ok || !data.shop) {
        setError(data.error || "The shop could not be connected.");
        setBusy(null);
        return;
      }
      setShop(data.shop);
      setClientId("");
      setClientSecret("");
      setBusy(null);
    } catch {
      setError("The shop could not be connected.");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-10">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <article className="grid content-start gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Supplier</h2>
            <p className="text-xs text-muted-foreground">moves on its own</p>
          </header>
          <Rows rows={floor.supplier} changedSku={floor.changedSku} />
        </article>
        <article className="grid content-start gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Shopify shelf</h2>
            <p className="text-xs text-muted-foreground">
              {floor.listed} listed · {floor.pulled} pulled
            </p>
          </header>
          <Rows rows={floor.shelf} shelf />
        </article>
        <article className="grid content-start gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Tape</h2>
            <p className="flex items-center gap-2 text-xs text-primary">
              <span className="inline-block size-1.5 rounded-full bg-primary" />
              Running
            </p>
          </header>
          <Tape log={floor.log} />
        </article>
      </section>

      <section id="store" className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="font-[family-name:var(--font-fraunces)] text-3xl tracking-tight">{plans.store.price}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{plans.store.detail}</p>
          </div>
          {paid ? (
            <p className="text-sm text-muted-foreground">Paid through {new Date(until).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.</p>
          ) : (
            <Button type="button" className="h-11 px-4" onClick={() => void pay()} disabled={busy !== null}>
              {busy === "pay" ? <Loader2 className="animate-spin" /> : null}
              Point it at my store
            </Button>
          )}
        </div>

        {paid && !shop ? (
          <form className="grid gap-3" onSubmit={(event) => void connect(event)}>
            <p className="text-sm leading-6 text-muted-foreground">
              Paste the shop once. Leave the feed empty and this live catalog is the supplier. Or paste a public CSV, including a published Google Sheet. Columns are detected. After this, you do not approve listings.
            </p>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm" htmlFor="shop-domain">
                Shop domain
                <input
                  id="shop-domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="your-store.myshopify.com"
                  className="h-11 rounded-lg border border-border bg-background px-3"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm" htmlFor="client-id">
                Client ID
                <input
                  id="client-id"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="From Dev Dashboard, Settings"
                  className="h-11 rounded-lg border border-border bg-background px-3"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm" htmlFor="client-secret">
                Client secret
                <input
                  id="client-secret"
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder="Tap the eye, then copy"
                  className="h-11 rounded-lg border border-border bg-background px-3"
                  type="password"
                  autoComplete="off"
                  required
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm" htmlFor="feed-url">
              Supplier feed URL, optional
              <input
                id="feed-url"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://supplier.example/catalog.csv"
                className="h-11 rounded-lg border border-border bg-background px-3"
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Offhand keeps the Client ID and Client secret on the server and asks Shopify for a fresh token before the old one expires.
            </p>
            <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_12rem] sm:items-end">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={trendMode}
                  onChange={(event) => setTrendMode(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong className="block">Follow the retail calendar</strong>
                  <span className="text-muted-foreground">Only products matching the active seasonal event can reach Shopify.</span>
                </span>
              </label>
              <label className="grid gap-2 text-sm" htmlFor="max-products">
                Maximum active products
                <input
                  id="max-products"
                  type="number"
                  min={1}
                  max={100}
                  value={maxProducts}
                  onChange={(event) => setMaxProducts(Number(event.target.value))}
                  className="h-11 rounded-lg border border-border bg-background px-3"
                />
              </label>
            </div>
            <Button type="submit" className="h-11 w-fit px-4" disabled={busy !== null}>
              {busy === "connect" ? <Loader2 className="animate-spin" /> : null}
              Leave it running
            </Button>
          </form>
        ) : null}

        {shop ? (
          <div className="grid gap-3 border-t border-border pt-4">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">{shop.domain}</h2>
              <p className="text-xs text-muted-foreground">
                {shop.listed} listed · {shop.pulled} pulled · {shop.trendMode ? `trend mode, max ${shop.maxProducts ?? 100}` : shop.feedUrl ? "your feed" : "this catalog"}
              </p>
            </header>
            <Tape log={shop.log} />
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
