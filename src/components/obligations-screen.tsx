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
      <p className="kicker">Ledger</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Obligations</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Each row is a shared object. The funds inside it move only when the conditions on the object are true.</p>
      {error ? <p className="mt-6 text-sm text-stop">{error}</p> : null}
      {rows === null && !error ? <p className="mt-6 text-muted-foreground">Reading shared objects…</p> : null}
      {rows && rows.length === 0 ? (
        <div className="panel mt-6 p-5">
          <p className="font-medium">Nothing is locked.</p>
          <p className="mt-1 text-sm text-muted-foreground">Write an obligation and the escrow shows up here.</p>
          <Link href="/compose" className="mt-3 inline-block text-sm underline decoration-border underline-offset-4">
            Compose one
          </Link>
        </div>
      ) : null}
      <div className="panel mt-6 divide-y divide-white/8">
        {rows?.map((obligation) => (
          <Link key={obligation.id} href={`/o/${obligation.id}`} className="grid gap-2 px-4 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[1fr_auto] sm:items-baseline">
            <div>
              <p className="font-medium">{obligation.service}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusLabel(obligation, now)}
                {obligation.merchantName ? ` · ${obligation.merchantName}` : " · no merchant yet"}
                {shortAddress(obligation.payer) ? ` · payer ${shortAddress(obligation.payer)}` : ""}
              </p>
            </div>
            <p className="font-mono text-sm text-[#7af7e2]">{formatYen(obligation.acceptedQuote !== "0" ? obligation.acceptedQuote : obligation.maxQuote)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
