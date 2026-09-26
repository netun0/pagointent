import Link from "next/link";
import { Button } from "@/components/ui/button";
import { gates, shortAddress, statusLabel } from "@/lib/sui/format";
import { listObligations } from "@/lib/sui/service";
import type { ObligationRecord } from "@/lib/sui/types";

export const dynamic = "force-dynamic";

const rules = [
  ["Lock", "The yen cap sits in escrow. Nothing moves until the predicate on the object is true."],
  ["Accept", "A merchant freezes their own price, at or under the cap, and the destination is bound to that address."],
  ["Release", "The agent may pay only when verification, price, destination, proof, and deadline all hold."],
];

const rails = [
  ["Chain", "Sui"],
  ["Asset", "test USDC"],
  ["Quote", "¥150 = $1"],
  ["Gas", "Sponsored"],
];

export default async function HomePage() {
  let latest: ObligationRecord | null = null;
  let chainError: string | null = null;
  try {
    const rows = await listObligations();
    latest = rows[0] ?? null;
  } catch (error) {
    chainError = error instanceof Error ? error.message : "Could not read Sui.";
  }
  const liveGates = latest ? gates(latest) : [];

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <p className="kicker">Programmable obligations · on-chain</p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Autonomous payments,{" "}
          <span className="glow-text">only when the terms are true.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          A user can tell an agent: buy this service for up to ¥3,000, only from a verified merchant, and only release the money when proof of delivery arrives. PagoIntent locks the funds. The agent may pay when that predicate holds, and not before.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 px-5">
            <Link href="/compose">Write an obligation</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href="/obligations">Open the ledger</Link>
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
            {latest ? shortAddress(latest.id) : "Latest object"}
          </span>
          <span className={latest?.status === 2 ? "chip chip-hold" : "chip chip-wait"}>
            {latest ? statusLabel(latest) : "On Sui"}
          </span>
        </div>
        {chainError ? (
          <p className="px-5 py-4 text-sm text-stop">{chainError}</p>
        ) : latest ? (
          <>
            <div className="px-5 py-4">
              <p className="kicker">On the object</p>
              <p className="mt-2 text-lg leading-snug">{latest.service}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {latest.merchantName || "No merchant yet"} · {shortAddress(latest.destination || latest.payer)}
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
                    {gate.state === "pass" ? "Holds" : gate.state === "fail" ? "Failed" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-white/10 px-5 py-3 text-sm">
              <Link href={`/o/${latest.id}`} className="text-[#7af7e2] underline decoration-[#3dffc8]/40 underline-offset-4">
                Open this obligation
              </Link>
            </p>
          </>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">No obligation objects on this package yet.</p>
        )}
      </aside>
    </div>
  );
}
