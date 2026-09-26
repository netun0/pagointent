"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { listDesks } from "@/lib/actions";
import { shortAddress } from "@/lib/sui/format";
import type { Desk } from "@/lib/sui/types";

export function MerchantsScreen() {
  const { messages } = useI18n();
  const m = messages.merchants;
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
      <p className="kicker">{m.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{m.title}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{m.lead}</p>
      {error ? <p className="mt-6 text-sm text-stop">{error}</p> : null}
      {desks === null && !error ? <p className="mt-6 text-muted-foreground">{m.reading}</p> : null}
      {desks && desks.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">{m.empty}</p> : null}
      <div className="mt-6 grid gap-3">
        {desks?.map((desk) => (
          <article key={desk.id} className="panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">{desk.name}</h2>
              <span className="chip chip-hold">{m.verified}</span>
            </div>
            <p className="mt-3 font-mono text-sm text-muted-foreground">{shortAddress(desk.address)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{desk.reachable ? m.reachable : m.remote}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
