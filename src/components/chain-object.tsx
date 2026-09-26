"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { getChainObject } from "@/lib/actions";
import { explorerUrl } from "@/lib/sui/format";
import type { ChainObjectView, NetworkName } from "@/lib/sui/types";

export function ChainObject({ id, network }: { id: string; network: NetworkName | null }) {
  const { messages } = useI18n();
  const o = messages.obligation;
  const [record, setRecord] = useState<ChainObjectView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const suiscan = network ? explorerUrl(network, "object", id) : null;

  useEffect(() => {
    let cancel = false;
    getChainObject(id)
      .then((next) => {
        if (!cancel) setRecord(next.object);
      })
      .catch((reason: Error) => {
        if (cancel) return;
        setRecord(null);
        setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const rows = record
    ? [
        [o.chainType, record.type],
        [o.chainVersion, record.version],
        [o.chainDigest, record.digest],
        [o.chainOwner, record.owner],
        [o.chainPrevious, record.previousTransaction],
      ].filter((row): row is [string, string] => Boolean(row[1]))
    : [];

  return (
    <section id="sui-object" className="panel mt-6 scroll-mt-24 p-5">
      <p className="kicker">{o.chainKicker}</p>
      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{id}</p>
      {record === undefined ? <p className="mt-4 text-sm text-muted-foreground">{o.chainReading}</p> : null}
      {record === null ? <p className="mt-4 text-sm text-muted-foreground">{error || o.chainMissing}</p> : null}
      {record ? (
        <dl className="mt-4 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-all font-mono text-xs">{value}</dd>
            </div>
          ))}
          {record.fields.length > 0 ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{o.chainFields}</dt>
              <dd className="mt-2 space-y-2">
                {record.fields.map((field) => (
                  <div key={field.key} className="grid gap-1 border-t border-white/10 pt-2 sm:grid-cols-[9rem_1fr]">
                    <span className="font-mono text-xs text-muted-foreground">{field.key}</span>
                    <span className="break-all font-mono text-xs">{field.value}</span>
                  </div>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {suiscan ? (
        <a className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.12em] text-[#7af7e2] underline decoration-[#3dffc8]/40 underline-offset-4" href={suiscan} target="_blank" rel="noreferrer">
          {o.openSuiscan}
        </a>
      ) : null}
    </section>
  );
}
