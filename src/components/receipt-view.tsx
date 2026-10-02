"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { savePass } from "@/lib/browser-store";
import { plans } from "@/lib/plans";

type Grant = { token: string; until: string };

const grants = new Map<string, Promise<{ ok: boolean; data: Grant & { error?: string } }>>();

function grantOnce(sessionId: string) {
  let pending = grants.get(sessionId);
  if (!pending) {
    pending = fetch("/api/receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then(async (response) => ({ ok: response.ok, data: (await response.json()) as Grant & { error?: string } }));
    grants.set(sessionId, pending);
  }
  return pending;
}

export function ReceiptView({ sessionId }: { sessionId: string }) {
  const [until, setUntil] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    grantOnce(sessionId).then(({ ok, data }) => {
      if (cancelled) return;
      if (!ok) {
        setError(data.error || "The receipt could not be read.");
        setWorking(false);
        return;
      }
      savePass(data.token, data.until);
      setUntil(data.until);
      setWorking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-4 py-16">
      <Link href="/" className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight">
        Offhand
      </Link>
      {working ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" /> Reading the payment…
        </p>
      ) : null}
      {!sessionId ? <p>This page opens after checkout.</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {until ? (
        <div className="grid gap-3">
          <h1 className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight">Paid.</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {plans.store.name} runs until {new Date(until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Paste the shop once. After that, Offhand lists, reprices, and pulls on its own.
          </p>
          <Link href="/#store" className="text-sm underline underline-offset-4">
            Paste the shop
          </Link>
        </div>
      ) : null}
    </main>
  );
}
