"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/context";
import { getBalances, getStatus } from "@/lib/actions";
import { decryptKey, forgetPayer, forgetVault, usePayer, useVault, writeVault, type VaultFile } from "@/lib/custody";
import { explorerUrl, formatSui, formatUsd, shortAddress } from "@/lib/sui/format";
import type { BalanceSnapshot, ChainStatus } from "@/lib/sui/types";

export function WalletScreen() {
  const { messages } = useI18n();
  const w = messages.wallet;
  const c = messages.compose;
  const payer = usePayer();
  const vault = useVault();
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (!vault) return;
    setError(null);
    try {
      const opened = await decryptKey(password, vault);
      setSecret(opened);
      const [nextBalances, nextStatus] = await Promise.all([getBalances(vault.address), getStatus()]);
      setBalances(nextBalances);
      setStatus(nextStatus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : w.errOpen);
    }
  }

  function downloadBackup() {
    if (!vault) return;
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pagointent-merchant.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as VaultFile;
        if (!parsed.address || !parsed.cipher) throw new Error(w.errBackup);
        writeVault(parsed);
        setSecret(null);
        toast.success(w.toastImport);
      })
      .catch((reason: Error) => setError(reason.message));
  }

  const accountUrl = vault && status ? explorerUrl(status.mode, "account", vault.address) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <p className="kicker">{w.agentKicker}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{w.agentTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.agentLead}</p>
        {payer ? (
          <div className="mt-4">
            <p className="font-mono text-sm">{shortAddress(payer.address)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {payer.kind === "zklogin" ? `${c.payerZkLogin} · Google` : c.payerDevice}
            </p>
            {payer.kind === "zklogin" ? (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => forgetPayer()}
              >
                Sign out of zkLogin
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {w.noSigner}{" "}
            <Link className="underline decoration-border underline-offset-4" href="/compose">
              {w.composeLink}
            </Link>{" "}
            {w.composeToCreate}
          </p>
        )}
      </section>
      <section>
        <p className="kicker">{w.merchantKicker}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{vault ? shortAddress(vault.address) : w.noneOnDevice}</h2>
        {!vault ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{w.merchantCreated}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/desk">{w.openDesk}</Link>
              </Button>
              <Label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-white/15 bg-white/5 px-3 text-sm">
                {w.importBackup}
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importBackup(file);
                  }}
                />
              </Label>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">{w.cipherNote}</p>
            {!secret ? (
              <form onSubmit={unlock} className="mt-4 max-w-sm space-y-3">
                <Label htmlFor="unlock">{w.password}</Label>
                <Input id="unlock" type="password" className="h-11 px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
                <Button>{w.unlock}</Button>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="panel p-4">
                  <p className="text-sm text-muted-foreground">{w.testUsdc}</p>
                  <p className="mt-1 font-mono text-2xl text-[#7af7e2]">{balances ? formatUsd(balances.usdc) : "…"}</p>
                </div>
                <div className="panel p-4">
                  <p className="text-sm text-muted-foreground">{w.sui}</p>
                  <p className="mt-1 font-mono text-2xl">{balances ? formatSui(balances.sui) : "…"}</p>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadBackup}>
                {w.downloadBackup}
              </Button>
              {accountUrl ? (
                <Button asChild variant="outline">
                  <a href={accountUrl} target="_blank" rel="noreferrer">
                    {w.viewSui}
                  </a>
                </Button>
              ) : null}
            </div>
            <details className="mt-6 text-sm text-muted-foreground">
              <summary className="cursor-pointer text-foreground">{w.forgetSummary}</summary>
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => {
                  forgetVault();
                  setSecret(null);
                }}
              >
                {w.deleteLocal}
              </Button>
            </details>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-stop">{error}</p> : null}
      </section>
    </div>
  );
}
