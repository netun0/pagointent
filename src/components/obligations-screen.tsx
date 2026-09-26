"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { statusLabelLocale } from "@/i18n/format-locale";
import { listObligations } from "@/lib/actions";
import { formatYen, shortAddress } from "@/lib/sui/format";
import type { ObligationRecord } from "@/lib/sui/types";

export function ObligationsScreen() {
  const { messages } = useI18n();
  const o = messages.obligations;
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
      <p className="kicker">{o.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{o.title}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">{o.lead}</p>
      {error ? <p className="mt-6 text-sm text-stop">{error}</p> : null}
      {rows === null && !error ? <p className="mt-6 text-muted-foreground">{o.reading}</p> : null}
      {rows && rows.length === 0 ? (
        <div className="panel mt-6 p-5">
          <p className="font-medium">{o.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{o.emptyBody}</p>
          <Link href="/compose" className="mt-3 inline-block text-sm underline decoration-border underline-offset-4">
            {o.composeOne}
          </Link>
        </div>
      ) : null}
      <div className="panel mt-6 divide-y divide-white/8">
        {rows?.map((obligation) => (
          <Link key={obligation.id} href={`/o/${obligation.id}`} className="grid gap-2 px-4 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[1fr_auto] sm:items-baseline">
            <div>
              <p className="font-medium">{obligation.service}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {statusLabelLocale(messages, obligation, now)}
                {obligation.merchantName ? ` · ${obligation.merchantName}` : ` · ${o.noMerchantYet}`}
                {shortAddress(obligation.payer) ? ` · ${o.payer} ${shortAddress(obligation.payer)}` : ""}
              </p>
            </div>
            <p className="font-mono text-sm text-[#7af7e2]">{formatYen(obligation.acceptedQuote !== "0" ? obligation.acceptedQuote : obligation.maxQuote)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
