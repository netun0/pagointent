"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createObligation, fundAddress, getBalances } from "@/lib/actions";
import { usePayer, writePayerSecret } from "@/lib/custody";
import { expiryFromDateInput, formatSui, formatUsd, formatYen, obligationSentence, parseYen, quoteToMicro, shortAddress, todayInputValue, weekAheadInputValue } from "@/lib/sui/format";
import type { BalanceSnapshot } from "@/lib/sui/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export function ComposeScreen() {
  const router = useRouter();
  const payer = usePayer();
  const address = payer?.address ?? null;
  const secret = payer?.secret ?? null;
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [service, setService] = useState("this service");
  const [amount, setAmount] = useState("3000");
  const [date, setDate] = useState(weekAheadInputValue);
  const [verified, setVerified] = useState(true);
  const [proof, setProof] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancel = false;
    getBalances(address)
      .then((next) => {
        if (!cancel) setBalances(next);
      })
      .catch((reason: Error) => {
        if (!cancel) setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, [address]);

  const quote = parseYen(amount);
  const sentence = obligationSentence({
    service,
    maxQuote: quote?.toString() ?? "0",
    requireVerified: verified,
    requireProof: proof,
  });

  async function createSigner() {
    setBusy("wallet");
    setError(null);
    try {
      const key = new Ed25519Keypair();
      writePayerSecret(key.getSecretKey());
      setBalances(await fundAddress(key.toSuiAddress()));
      toast.success("The agent has a signer, funded with test USDC.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not fund the signer.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!secret || !quote) {
      setError("Enter a whole yen amount up to ¥1,000,000.");
      return;
    }
    const expiresAtMs = expiryFromDateInput(date);
    if (!expiresAtMs) {
      setError("Pick a date.");
      return;
    }
    setBusy("lock");
    setError(null);
    try {
      const receipt = await createObligation({
        secret,
        service,
        maxQuote: quote.toString(),
        requireVerified: verified,
        requireProof: proof,
        expiresAtMs,
      });
      if (!receipt.obligationId) throw new Error("The escrow locked, but the obligation id did not come back.");
      toast.success("Funds are locked. Nothing can be released yet.");
      router.push(`/o/${receipt.obligationId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not lock the obligation.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.8fr]">
      <div>
        <p className="kicker">Compose</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Write what must be true.</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          The sentence is the policy. Locking it escrows the yen cap in test USDC at ¥150 = $1. The rate is stored on the obligation and does not move.
        </p>
        {!address ? (
          <div className="panel mt-6 p-5">
            <p className="font-medium">The agent needs a signer on this device.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              PagoIntent creates a Sui key in this browser and funds it with test USDC. That key locks the escrow and is the one allowed to ask for release. It is not a wallet for the merchant.
            </p>
            <Button className="mt-4 h-11 px-5" onClick={createSigner} disabled={busy !== null}>
              {busy === "wallet" ? "Funding…" : "Create the agent signer"}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="text-muted-foreground">Signer</p>
                <p className="font-mono">{shortAddress(address)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Test USDC</p>
                <p>{balances ? formatUsd(balances.usdc) : "…"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gas</p>
                <p>{balances ? formatSui(balances.sui) : "…"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Service</Label>
              <Input id="service" className="h-11 px-3 font-mono" value={service} onChange={(event) => setService(event.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Up to (JPY)</Label>
                <Input id="amount" className="h-11 px-3 font-mono" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Accept and deliver by</Label>
                <Input id="date" type="date" className="h-11 px-3 font-mono" value={date} min={todayInputValue()} onChange={(event) => setDate(event.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
                Only a verified merchant
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={proof} onChange={(event) => setProof(event.target.checked)} />
                Release only with proof of delivery
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote ? `${formatYen(quote)} locks ${formatUsd(quoteToMicro(quote))}.` : "Enter a whole number of yen."}
            </p>
            <Button className="h-11 px-5" disabled={busy !== null}>
              {busy === "lock" ? "Locking the escrow…" : "Lock the escrow"}
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 text-sm text-stop">{error}</p> : null}
      </div>
      <aside className="panel p-5">
        <p className="kicker">The agent will be told</p>
        <p className="mt-3 text-lg leading-snug">{sentence}</p>
      </aside>
    </div>
  );
}
