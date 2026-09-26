"use client";

import { useI18n } from "@/i18n/context";
import { gateMarkLocale, gatesLocale } from "@/i18n/format-locale";
import type { GateState } from "@/lib/sui/format";
import type { ObligationRecord } from "@/lib/sui/types";

const chip: Record<GateState, string> = {
  pass: "chip chip-hold",
  wait: "chip chip-wait",
  fail: "chip chip-stop",
};

export function Conditions({ obligation, now }: { obligation: ObligationRecord; now: number }) {
  const { locale, messages } = useI18n();
  const rows = gatesLocale(messages, obligation, locale, now);
  return (
    <ol className="panel divide-y divide-white/8">
      {rows.map((row, index) => (
        <li key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <span className="font-mono text-xs text-[#7af7e2]/70">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="text-sm font-medium">{row.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{row.detail}</p>
          </div>
          <span className={chip[row.state]}>{gateMarkLocale(messages, row.state)}</span>
        </li>
      ))}
    </ol>
  );
}
