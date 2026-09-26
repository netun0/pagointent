"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";
import { gatesLocale, statusLabelLocale } from "@/i18n/format-locale";
import { listObligations } from "@/lib/actions";
import { shortAddress } from "@/lib/sui/format";
import type { ObligationRecord } from "@/lib/sui/types";

export function HomeScreen() {
  const { locale, messages } = useI18n();
  const h = messages.home;
  const [latest, setLatest] = useState<ObligationRecord | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancel = false;
    listObligations()
      .then((next) => {
        if (!cancel) setLatest(next.obligations[0] ?? null);
      })
      .catch((error: Error) => {
        if (!cancel) setChainError(error.message || h.panel.chainError);
      });
    return () => {
      cancel = true;
    };
  }, [h.panel.chainError]);

  const liveGates = latest ? gatesLocale(messages, latest, locale, now) : [];

  const rails = [
    [h.rails.chain, h.rails.chainValue],
    [h.rails.asset, h.rails.assetValue],
    [h.rails.quote, h.rails.quoteValue],
    [h.rails.gas, h.rails.gasValue],
  ] as const;

  const rules = [
    [h.rules.lock, h.rules.lockCopy],
    [h.rules.accept, h.rules.acceptCopy],
    [h.rules.release, h.rules.releaseCopy],
  ] as const;

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <p className="kicker">{h.kicker}</p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          {h.title}{" "}
          <span className="glow-text">{h.titleGlow}</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{h.lead}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 px-5">
            <Link href="/compose">{h.writeObligation}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href="/obligations">{h.openLedger}</Link>
          </Button>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rails.map(([label, value]) => (
            <div key={label} className="panel px-3 py-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-8 grid gap-3">
          {rules.map(([name, copy]) => (
            <div key={name} className="panel px-4 py-4">
              <dt className="kicker">{name}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-foreground/90">{copy}</dd>
            </div>
          ))}
        </dl>
      </div>
      <aside className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {latest ? shortAddress(latest.id) : h.panel.latestObject}
          </span>
          <span className={latest?.status === 2 ? "chip chip-hold" : "chip chip-wait"}>
            {latest ? statusLabelLocale(messages, latest, now) : h.panel.onSui}
          </span>
        </div>
        {chainError ? (
          <p className="px-5 py-4 text-sm text-stop">{chainError}</p>
        ) : latest ? (
          <>
            <div className="px-5 py-4">
              <p className="kicker">{h.panel.onObject}</p>
              <p className="mt-2 text-lg leading-snug">{latest.service}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {latest.merchantName || h.panel.noMerchantYet} · {shortAddress(latest.destination || latest.payer)}
              </p>
            </div>
            <ul className="divide-y divide-white/8">
              {liveGates.map((gate) => (
                <li key={gate.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{gate.label}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{gate.detail}</span>
                  </span>
                  <span className={gate.state === "pass" ? "chip chip-hold" : gate.state === "fail" ? "chip chip-stop" : "chip chip-wait"}>
                    {gate.state === "pass" ? h.panel.holds : gate.state === "fail" ? h.panel.failed : h.panel.waiting}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-white/10 px-5 py-3 text-sm">
              <Link href={`/o/${latest.id}`} className="text-[#7af7e2] underline decoration-[#3dffc8]/40 underline-offset-4">
                {h.panel.openObligation}
              </Link>
            </p>
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">{h.panel.empty}</p>
        )}
      </aside>
    </div>
  );
}
