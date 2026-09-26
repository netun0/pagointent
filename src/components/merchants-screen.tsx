"use client";

import { useEffect, useState } from "react";
import { listDesks } from "@/lib/actions";
import { formatYen, shortAddress } from "@/lib/sui/format";
import type { Desk } from "@/lib/sui/types";

export function MerchantsScreen() {
  const [desks, setDesks] = useState<Desk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listDesks()
      .then((next) => {
        if (!cancel) setDesks(next.desks);
      })
      .catch((reason: Error) => {
        if (!cancel) setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Directory</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Merchants the agent can contact</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Verification is an on-chain registry, not a badge in the interface. If an obligation says “only a verified merchant,” acceptance checks that table. Night Window is listed so the refusal is visible.
      </p>
      {error ? <p className="mt-6 text-sm text-[#8d2e2e]">{error}</p> : null}
      {desks === null && !error ? <p className="mt-6 text-muted-foreground">Reading the registry…</p> : null}
      <div className="mt-6 grid gap-3">
        {desks?.map((desk) => (
          <article key={desk.id} className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">{desk.name}</h2>
              <span className={desk.verified ? "font-mono text-[11px] uppercase text-emerald-800" : "font-mono text-[11px] uppercase text-[#8d2e2e]"}>
                {desk.verified ? "Verified" : "Not verified"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{desk.service}</p>
            <p className="mt-3 text-sm">
              {desk.city} · asks {formatYen(desk.ask)}
              {desk.address ? <span className="text-muted-foreground"> · {shortAddress(desk.address)}</span> : <span className="text-muted-foreground"> · address not published</span>}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
