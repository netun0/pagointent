"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBalances, getStatus } from "@/lib/actions";
import { decryptKey, forgetVault, usePayer, useVault, writeVault, type VaultFile } from "@/lib/custody";
import { explorerUrl, formatSui, formatUsd, shortAddress } from "@/lib/sui/format";
import type { BalanceSnapshot, ChainStatus } from "@/lib/sui/types";

export function WalletScreen() {
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
      setError(reason instanceof Error ? reason.message : "Could not open the key.");
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
        if (!parsed.address || !parsed.cipher) throw new Error("That file is not a PagoIntent backup.");
        writeVault(parsed);
        setSecret(null);
        toast.success("Backup imported. Unlock it with the password.");
      })
      .catch((reason: Error) => setError(reason.message));
  }

  const accountUrl = vault && status ? explorerUrl(status.mode, "account", vault.address) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Agent signer</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">The key that locks and asks</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is the payer. It signs the escrow and the release request. It does not decide the terms. The obligation does.
        </p>
        {payer ? (
          <p className="mt-4 font-mono text-sm">{shortAddress(payer.address)}</p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No signer on this device. <Link className="underline decoration-border underline-offset-4" href="/compose">Compose an obligation</Link> to create one.
          </p>
        )}
      </section>
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Merchant key</p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight">{vault ? shortAddress(vault.address) : "None on this device"}</h2>
        {!vault ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Created when a merchant accepts from the desk, then encrypted with their password.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild className="rounded-md">
                <Link href="/desk">Open the desk</Link>
              </Button>
              <Label className="inline-flex h-9 cursor-pointer items-center rounded-md border bg-card px-3 text-sm">
                Import backup
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
            <p className="text-sm text-muted-foreground">AES-GCM ciphertext in this browser. PagoIntent never sees the password.</p>
            {!secret ? (
              <form onSubmit={unlock} className="mt-4 max-w-sm space-y-3">
                <Label htmlFor="unlock">Password</Label>
                <Input id="unlock" type="password" className="h-11 bg-card px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
                <Button className="rounded-md">Unlock</Button>
              </form>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Test USDC</p>
                  <p className="mt-1 text-2xl">{balances ? formatUsd(balances.usdc) : "…"}</p>
                </div>
                <div className="rounded-md border bg-card p-4">
                  <p className="text-sm text-muted-foreground">SUI</p>
                  <p className="mt-1 text-2xl">{balances ? formatSui(balances.sui) : "…"}</p>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className="bg-card" onClick={downloadBackup}>
                Download encrypted backup
              </Button>
              {accountUrl ? (
                <Button asChild variant="outline" className="bg-card">
                  <a href={accountUrl} target="_blank" rel="noreferrer">
                    View on Sui
                  </a>
                </Button>
              ) : null}
            </div>
            <details className="mt-6 text-sm text-muted-foreground">
              <summary className="cursor-pointer text-foreground">Forget this key on this device</summary>
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => {
                  forgetVault();
                  setSecret(null);
                }}
              >
                Delete the local key
              </Button>
            </details>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-[#8d2e2e]">{error}</p> : null}
      </section>
    </div>
  );
}
