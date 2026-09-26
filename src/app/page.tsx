import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const rules = [
  ["Lock", "The yen cap sits in escrow. Nothing moves until the predicate on the object is true."],
  ["Accept", "A merchant freezes their own price, at or under the cap, and the destination is bound to that address."],
  ["Release", "The agent may pay only when verification, price, destination, proof, and deadline all hold."],
];

const gates = [
  ["Cap", "¥3,000", "Hold"],
  ["Verified merchant", "Required", "Wait"],
  ["Price", "Not frozen yet", "Wait"],
  ["Destination", "Unbound", "Wait"],
  ["Proof of delivery", "Missing", "Wait"],
  ["Deadline", "Still open", "Hold"],
];

const rails = [
  ["Chain", "Sui"],
  ["Asset", "test USDC"],
  ["Quote", "¥150 = $1"],
  ["Gas", "Sponsored"],
];

export default function HomePage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <Logo size={128} alt="PagoIntent" />
        <p className="kicker mt-6">Programmable obligations · on-chain</p>
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
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#ff5d73]" />
            <span className="size-2 rounded-full bg-[#ffd27a]" />
            <span className="size-2 rounded-full bg-[#3dffc8]" />
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">obligation.move</span>
          </div>
          <span className="chip chip-hold">escrow armed</span>
        </div>
        <div className="px-5 py-4">
          <p className="kicker">Instruction</p>
          <p className="mt-2 text-lg leading-snug">
            Buy this service for up to ¥3,000, only from a verified merchant, and only release the money when I receive proof of delivery.
          </p>
        </div>
        <ul className="divide-y divide-white/8">
          {gates.map(([label, detail, state]) => (
            <li key={label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span>
                <span className="font-medium">{label}</span>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{detail}</span>
              </span>
              <span className={state === "Hold" ? "chip chip-hold" : "chip chip-wait"}>{state}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/10 px-5 py-3 text-sm text-muted-foreground">
          If the price changes, the destination changes, delivery never arrives, or nobody accepts, the funds stay locked or return.
        </p>
      </aside>
    </div>
  );
}
