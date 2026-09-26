"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listObligations } from "@/lib/actions";
import { formatYen, shortAddress, statusLabel } from "@/lib/sui/format";
import type { ObligationRecord } from "@/lib/sui/types";

export function ObligationsScreen() {
  const [rows, setRows] = useState<ObligationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancel = false;
    listObligations()
      .then((next) => {
        if (!cancel) setRows(next.obligations);
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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Ledger</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">Obligations</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Each row is a shared object. The funds inside it move only when the conditions on the object are true.</p>
      {error ? <p className="mt-6 text-sm text-[#8d2e2e]">{error}</p> : null}
      {rows === null && !error ? <p className="mt-6 text-muted-foreground">Reading shared objects…</p> : null}
      {rows && rows.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed bg-card/70 p-5">
          <p className="font-medium">Nothing is locked.</p>
          <p className="mt-1 text-sm text-muted-foreground">Write an obligation and the escrow shows up here.</p>
          <Link href="/compose" className="mt-3 inline-block text-sm underline decoration-border underline-offset-4">
            Compose one
          </Link>
        </div>
      ) : null}
      <div className="mt-6 divide-y rounded-md border bg-card">
        {rows?.map((obligation) => (
          <Link key={obligation.id} href={`/o/${obligation.id}`} className="grid gap-2 px-4 py-4 hover:bg-background sm:grid-cols-[1fr_auto] sm:items-baseline">
            <div>
              <p className="font-medium">{obligation.service}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusLabel(obligation, now)}
                {obligation.merchantName ? ` · ${obligation.merchantName}` : " · no merchant yet"}
                {shortAddress(obligation.payer) ? ` · payer ${shortAddress(obligation.payer)}` : ""}
              </p>
            </div>
            <p className="font-mono text-sm">{formatYen(obligation.acceptedQuote !== "0" ? obligation.acceptedQuote : obligation.maxQuote)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
