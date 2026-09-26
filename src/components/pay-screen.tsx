"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createIntent, fundAddress, getBalances, listIntents } from "@/lib/actions";
import { rememberClaim, usePayer, writePayerSecret } from "@/lib/custody";
import { expiryFromDateInput, formatSui, formatUsd, shortAddress, statusText, todayInputValue } from "@/lib/sui/format";
import { usdToMicro } from "@/lib/sui/format";
import type { BalanceSnapshot, IntentRecord } from "@/lib/sui/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PayScreen() {
  const router = useRouter();
  const payer = usePayer();
  const address = payer?.address ?? null;
  const secret = payer?.secret ?? null;
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [intents, setIntents] = useState<IntentRecord[]>([]);
  const [name, setName] = useState("Mark");
  const [purpose, setPurpose] = useState("lunch");
  const [amount, setAmount] = useState("2");
  const [date, setDate] = useState(todayInputValue);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancel = false;
    Promise.all([getBalances(address), listIntents()])
      .then(([nextBalances, nextIntents]) => {
        if (cancel) return;
        setBalances(nextBalances);
        setIntents(nextIntents.intents.filter((intent) => intent.payer.toLowerCase() === address.toLowerCase()));
      })
      .catch((reason: Error) => {
        if (!cancel) setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, [address]);

  async function createPayer() {
    setBusy("wallet");
    setError(null);
    try {
      const key = new Ed25519Keypair();
      writePayerSecret(key.getSecretKey());
      const funded = await fundAddress(key.toSuiAddress());
      setBalances(funded);
      toast.success("Demo payer is funded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not fund the payer.");
    } finally {
      setBusy(null);
    }
  }

  async function fund() {
    if (!address) return;
    setBusy("fund");
    setError(null);
    try {
      setBalances(await fundAddress(address));
      toast.success("Wallet topped up.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Funding failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!secret) return;
    const micro = usdToMicro(amount);
    const expiresAtMs = expiryFromDateInput(date);
    if (!micro) {
      setError("Enter a dollar amount with at most two decimals.");
      return;
    }
    if (!expiresAtMs) {
      setError("Pick a date.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const receipt = await createIntent({
        secret,
        payeeName: name,
        purpose,
        amount: micro.toString(),
        expiresAtMs,
      });
      if (!receipt.intentId) throw new Error("The intent was submitted but its id did not come back.");
      rememberClaim(receipt.intentId, receipt.claimSecretHex);
      toast.success("Intent is locked on Sui.");
      router.push(`/i/${receipt.intentId}?k=${receipt.claimSecretHex}&view=payer`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the intent.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Lock a payment</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          The USDC sits in a shared escrow until they accept, you cancel, or the date passes. The QR holds the only
          secret that can release it.
        </p>
        {!address ? (
          <div className="mt-6 rounded-2xl border bg-card p-5">
            <p className="font-medium">This browser needs a payer wallet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Intenses will make a testnet-style key on this device and fund it with SUI for gas and test USDC. It is a
              demo key, stored in the browser so you can sign without an extension.
            </p>
            <Button className="mt-4 h-11 rounded-full px-5" onClick={createPayer} disabled={busy !== null}>
              {busy === "wallet" ? "Funding…" : "Create a demo payer"}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
              <div>
                <p className="text-muted-foreground">Payer</p>
                <p className="font-medium">{shortAddress(address)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Test USDC</p>
                <p className="font-medium">{balances ? formatUsd(balances.usdc) : "…"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gas</p>
                <p className="font-medium">{balances ? formatSui(balances.sui) : "…"}</p>
              </div>
              <Button type="button" variant="outline" className="h-9 bg-background" onClick={fund} disabled={busy !== null}>
                {busy === "fund" ? "Funding…" : "Top up"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setName("Mark");
                  setAmount("2");
                  setPurpose("lunch");
                }}
              >
                $2 lunch
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setName("Mark");
                  setAmount("8");
                  setPurpose("lunch and a coffee");
                }}
              >
                $8 to try the market
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Who are you paying?</Label>
                <Input id="name" className="h-11 bg-card px-3" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Up to (USD)</Label>
                <Input id="amount" className="h-11 bg-card px-3" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">What is it for?</Label>
              <Input id="purpose" className="h-11 bg-card px-3" value={purpose} onChange={(event) => setPurpose(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Accept by</Label>
              <Input id="date" type="date" className="h-11 bg-card px-3" value={date} min={todayInputValue()} onChange={(event) => setDate(event.target.value)} required />
            </div>
            <Button className="h-12 rounded-full px-6 text-base" disabled={busy !== null}>
              {busy === "create" ? "Locking on Sui…" : "Lock USDC and show the code"}
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 text-sm text-[#9a3b28]">{error}</p> : null}
      </div>
      <aside>
        <h2 className="font-serif text-2xl">Your intents</h2>
        <div className="mt-3 space-y-3">
          {intents.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
              Nothing locked from this payer yet.
            </p>
          ) : (
            intents.map((intent) => (
              <Link key={intent.id} href={`/i/${intent.id}?view=payer`} className="block rounded-2xl border bg-card p-4 hover:border-foreground/30">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">Pay {intent.payeeName}</p>
                  <p className="font-serif text-xl">{formatUsd(intent.amount)}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {intent.purpose} · {statusText(intent)}
                </p>
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
