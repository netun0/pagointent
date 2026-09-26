import { gates, type GateState } from "@/lib/sui/format";
import type { ObligationRecord } from "@/lib/sui/types";
import { cn } from "cn";

const mark: Record<GateState, string> = {
  pass: "Hold",
  wait: "Wait",
  fail: "Stop",
};

export function Conditions({ obligation, now }: { obligation: ObligationRecord; now: number }) {
  const rows = gates(obligation, now);
  return (
    <ol className="divide-y rounded-md border bg-card">
      {rows.map((row, index) => (
        <li key={row.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3">
          <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
          <div>
            <p className="text-sm font-medium">{row.label}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{row.detail}</p>
          </div>
          <span
            className={cn(
              "font-mono text-[11px] uppercase tracking-wide",
              row.state === "pass" && "text-emerald-800",
              row.state === "wait" && "text-[#8a5a12]",
              row.state === "fail" && "text-[#8d2e2e]",
            )}
          >
            {mark[row.state]}
          </span>
        </li>
      ))}
    </ol>
  );
}
