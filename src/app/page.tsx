import Link from "next/link";
import { Button } from "@/components/ui/button";

const contrasts = [
  ["Orbital", "Moves money through global payment infrastructure, once a business is already sending it."],
  ["Yodl", "Pays a merchant who already has a local payment rail."],
  ["PagoIntent", "Decides what must be true before an autonomous agent is allowed to pay."],
];

const gates = [
  ["Cap", "¥3,000", "Hold"],
  ["Verified merchant", "Required", "Wait"],
  ["Price", "Not frozen yet", "Wait"],
  ["Destination", "Unbound", "Wait"],
  ["Proof of delivery", "Missing", "Wait"],
  ["Deadline", "Still open", "Hold"],
];

export default function HomePage() {
  return (
    <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Programmable obligations</p>
        <h1 className="mt-3 max-w-xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          Autonomous payments, only when the terms are true.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          A user can tell an agent: buy this service for up to ¥3,000, only from a verified merchant, and only release the money when proof of delivery arrives. PagoIntent locks the funds. The agent may pay when that predicate holds, and not before.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-md px-5">
            <Link href="/compose">Write an obligation</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-md bg-card px-5">
            <Link href="/obligations">Open the ledger</Link>
          </Button>
        </div>
        <dl className="mt-10 divide-y border-y">
          {contrasts.map(([name, copy]) => (
            <div key={name} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="text-sm font-medium">{name}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{copy}</dd>
            </div>
          ))}
        </dl>
      </div>
      <aside className="rounded-md border bg-card">
        <div className="border-b px-5 py-4">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Instruction</p>
          <p className="mt-2 text-lg leading-snug">
            Buy this service for up to ¥3,000, only from a verified merchant, and only release the money when I receive proof of delivery.
          </p>
        </div>
        <ul className="divide-y">
          {gates.map(([label, detail, state]) => (
            <li key={label} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
              <span>
                <span className="font-medium">{label}</span>
                <span className="mt-0.5 block text-muted-foreground">{detail}</span>
              </span>
              <span className={state === "Hold" ? "font-mono text-[11px] uppercase text-emerald-800" : "font-mono text-[11px] uppercase text-[#8a5a12]"}>
                {state}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          If the price changes, the destination changes, delivery never arrives, or nobody accepts, the funds stay locked or return.
        </p>
      </aside>
    </div>
  );
}
