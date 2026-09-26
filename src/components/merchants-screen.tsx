"use client";

import { useEffect, useState } from "react";
import { listDesks } from "@/lib/actions";
import { shortAddress } from "@/lib/sui/format";
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
      <p className="kicker">Registry</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Merchants the chain has verified</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        There is no catalog in the app. This list is whoever the Sui registry has recorded. A new desk becomes visible here after verification.
      </p>
      {error ? <p className="mt-6 text-sm text-stop">{error}</p> : null}
      {desks === null && !error ? <p className="mt-6 text-muted-foreground">Reading the registry…</p> : null}
      {desks && desks.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">The registry is empty. The first merchant to verify shows up here.</p>
      ) : null}
      <div className="mt-6 grid gap-3">
        {desks?.map((desk) => (
          <article key={desk.id} className="panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">{desk.name}</h2>
              <span className="chip chip-hold">Verified</span>
            </div>
            <p className="mt-3 font-mono text-sm text-muted-foreground">{shortAddress(desk.address)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {desk.reachable ? "The agent can ask this address to accept." : "This address signs from its own desk."}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
