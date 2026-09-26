import Link from "next/link";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";

const endOfToday = new Date();
endOfToday.setHours(23, 59, 59, 0);

export default function HomePage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-[#9a3b28]">Payment intents on Sui</p>
        <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl">
          Pay anyone in crypto, even if they don’t have a wallet.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Write an intent — pay Mark up to $2 for lunch today, in USDC, if he accepts. He scans the code. The moment he
          agrees, Intenses creates a Sui wallet and the money is already sitting in it.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 rounded-full px-6 text-base">
            <Link href="/pay">Create an intent</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-full bg-card px-6 text-base">
            <Link href="/scan">I have a code</Link>
          </Button>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["Lock it", "You fund a shared escrow. The claim secret stays in the QR, not on chain."],
            ["They decide", "No extension and no seed phrase. Accept, or leave the money where it is."],
            ["A wallet appears", "Their key is encrypted with a password on their device. Gas is sponsored."],
          ].map(([title, copy], index) => (
            <li key={title} className="rounded-2xl border bg-card p-4">
              <p className="font-serif text-2xl">{index + 1}</p>
              <p className="mt-2 font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy}</p>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <Ticket
          example
          intent={{
            payeeName: "Mark",
            purpose: "lunch",
            amount: "2000000",
            expiresAtMs: endOfToday.getTime(),
            status: 0,
          }}
        />
        <p className="mt-3 text-center text-sm text-muted-foreground">An example, not a live code.</p>
      </div>
    </div>
  );
}
