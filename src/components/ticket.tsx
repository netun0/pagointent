import { formatUsd, formatWhen, statusText } from "@/lib/sui/format";
import type { IntentRecord } from "@/lib/sui/types";
import { cn } from "cn";

export function Ticket({
  intent,
  example = false,
}: {
  intent: Pick<IntentRecord, "payeeName" | "purpose" | "amount" | "expiresAtMs" | "status">;
  example?: boolean;
}) {
  const state = example ? "Example" : statusText(intent);
  return (
    <article className="ticket relative overflow-hidden px-6 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Intenses · USDC</p>
        <span
          className={cn(
            "stamp",
            state === "Accepted" && "border-emerald-700 text-emerald-800",
            (state === "Cancelled" || state === "Expired" || state === "Past due") && "border-muted-foreground text-muted-foreground",
          )}
        >
          {state}
        </span>
      </div>
      <h2 className="mt-6 font-serif text-4xl leading-none tracking-tight sm:text-5xl">Pay {intent.payeeName}</h2>
      <p className="mt-4 font-serif text-5xl tracking-tight sm:text-6xl">{formatUsd(intent.amount)}</p>
      <p className="mt-1 text-sm uppercase tracking-[0.16em] text-muted-foreground">up to, if they accept</p>
      <div className="my-6 border-t border-dashed border-border" />
      <p className="text-lg">For {intent.purpose}.</p>
      <p className="mt-1 text-muted-foreground">In USDC, if they accept by {formatWhen(intent.expiresAtMs)}.</p>
    </article>
  );
}
