"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/context";
import { obligationSentenceLocale } from "@/i18n/format-locale";
import { createObligation, fundAddress, getBalances } from "@/lib/actions";
import { usePayer, writePayerSecret } from "@/lib/custody";
import { expiryFromDateInput, formatSui, formatUsd, formatYen, parseYen, quoteToMicro, shortAddress, todayInputValue, weekAheadInputValue } from "@/lib/sui/format";
import type { BalanceSnapshot } from "@/lib/sui/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export function ComposeScreen() {
  const router = useRouter();
  const { messages, t } = useI18n();
  const c = messages.compose;
  const payer = usePayer();
  const address = payer?.address ?? null;
  const secret = payer?.secret ?? null;
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
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
  const sentence = obligationSentenceLocale(messages, {
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
      toast.success(c.toastSigner);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : c.errFund);
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!secret || !quote) {
      setError(c.errAmount);
      return;
    }
    const expiresAtMs = expiryFromDateInput(date);
    if (!expiresAtMs) {
      setError(c.errDate);
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
      if (!receipt.obligationId) throw new Error(c.errNoId);
      toast.success(c.toastLocked);
      router.push(`/o/${receipt.obligationId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : c.errLock);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.8fr]">
      <div>
        <p className="kicker">{c.kicker}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{c.lead}</p>
        {!address ? (
          <div className="panel mt-6 p-5">
            <p className="font-medium">{c.needSignerTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.needSignerBody}</p>
            <Button className="mt-4 h-11 px-5" onClick={createSigner} disabled={busy !== null}>
              {busy === "wallet" ? c.funding : c.createSigner}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="text-muted-foreground">{c.signer}</p>
                <p className="font-mono">{shortAddress(address)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{c.testUsdc}</p>
                <p>{balances ? formatUsd(balances.usdc) : "…"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{c.gas}</p>
                <p>{balances ? formatSui(balances.sui) : "…"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">{c.service}</Label>
              <Input id="service" className="h-11 px-3 font-mono" value={service} onChange={(event) => setService(event.target.value)} placeholder={c.servicePlaceholder} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">{c.amount}</Label>
                <Input id="amount" className="h-11 px-3 font-mono" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="3000" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">{c.date}</Label>
                <Input id="date" type="date" className="h-11 px-3 font-mono" value={date} min={todayInputValue()} onChange={(event) => setDate(event.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
                {c.verifiedOnly}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={proof} onChange={(event) => setProof(event.target.checked)} />
                {c.proofOnly}
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              {quote
                ? t(c.locksPreview, { yen: formatYen(quote), usd: formatUsd(quoteToMicro(quote)) })
                : c.enterYen}
            </p>
            <Button className="h-11 px-5" disabled={busy !== null}>
              {busy === "lock" ? c.locking : c.lockEscrow}
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 text-sm text-stop">{error}</p> : null}
      </div>
      <aside className="panel p-5">
        <p className="kicker">{c.agentTold}</p>
        <p className="mt-3 text-lg leading-snug">{sentence}</p>
      </aside>
    </div>
  );
}
