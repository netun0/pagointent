"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBalances, getStatus, listActivity } from "@/lib/actions";
import { decryptKey, forgetVault, useLessons, useVault, writeVault, type VaultFile } from "@/lib/custody";
import { lessons } from "@/lib/lessons";
import { explorerUrl, formatSui, formatUsd, shortAddress } from "@/lib/sui/format";
import type { ActivityRecord, BalanceSnapshot, ChainStatus } from "@/lib/sui/types";

export function WalletScreen() {
  const vault = useVault();
  const completedLessons = useLessons();
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceSnapshot | null>(null);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmExport, setConfirmExport] = useState("");

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (!vault) return;
    setError(null);
    try {
      const opened = await decryptKey(password, vault);
      setSecret(opened);
      const [nextBalances, nextActivity, nextStatus] = await Promise.all([
        getBalances(vault.address),
        listActivity(vault.address),
        getStatus(),
      ]);
      setBalances(nextBalances);
      setActivity(nextActivity.activity);
      setStatus(nextStatus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the wallet.");
    }
  }

  function downloadBackup() {
    if (!vault) return;
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "intenses-wallet.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    file.text().then((text) => {
      const parsed = JSON.parse(text) as VaultFile;
      if (!parsed.address || !parsed.cipher) throw new Error("That file is not an Intenses backup.");
      writeVault(parsed);
      setSecret(null);
      toast.success("Backup imported. Unlock it with the password.");
    }).catch((reason: Error) => setError(reason.message));
  }

  const lessonsDone = completedLessons.length >= lessons.length;
  const accountUrl = vault && status ? explorerUrl(status.mode, "account", vault.address) : null;

  if (!vault) {
    return (
      <div className="max-w-xl">
        <h1 className="font-serif text-4xl tracking-tight">No wallet on this device</h1>
        <p className="mt-2 text-muted-foreground">
          Accept a payment and one is created for you. If you already downloaded an encrypted backup, import it here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="h-11 rounded-full px-5">
            <Link href="/scan">Scan an intent</Link>
          </Button>
          <Label className="inline-flex h-11 cursor-pointer items-center rounded-full border bg-card px-5 text-sm">
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
        {error ? <p className="mt-4 text-sm text-[#9a3b28]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Payee wallet</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{shortAddress(vault.address)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          The private key never leaves this browser in the clear. What we store is an AES-GCM ciphertext derived from
          your password. Intenses cannot reset it.
        </p>
        {!secret ? (
          <form onSubmit={unlock} className="mt-6 max-w-sm space-y-3">
            <Label htmlFor="unlock">Password</Label>
            <Input id="unlock" type="password" className="h-11 bg-card px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button className="h-11 rounded-full px-5">Unlock</Button>
          </form>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Test USDC</p>
              <p className="mt-1 font-serif text-3xl">{balances ? formatUsd(balances.usdc) : "…"}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">SUI for gas</p>
              <p className="mt-1 font-serif text-3xl">{balances ? formatSui(balances.sui) : "…"}</p>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
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
          <Button asChild variant="secondary">
            <Link href="/market">Spend or list</Link>
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-[#9a3b28]">{error}</p> : null}
        <details className="mt-8 text-sm text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Forget this wallet on this device</summary>
          <p className="mt-2">
            This deletes the ciphertext. If you have no backup and no export, the coins stay on chain and you cannot sign for them.
          </p>
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
      <div className="space-y-6">
        <section>
          <h2 className="font-serif text-2xl">Activity</h2>
          <div className="mt-3 space-y-2">
            {activity.length === 0 ? (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                {secret ? "No events for this address yet." : "Unlock to load activity."}
              </p>
            ) : (
              activity.map((item) => {
                const href = item.digest && status ? explorerUrl(status.mode, "tx", item.digest) : null;
                return (
                  <div key={item.id} className="rounded-2xl border bg-card px-4 py-3 text-sm">
                    <p>{item.summary}</p>
                    {href ? (
                      <a className="text-muted-foreground underline decoration-border underline-offset-4" href={href} target="_blank" rel="noreferrer">
                        {item.digest?.slice(0, 10)}…
                      </a>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-serif text-2xl">Take the key out</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish the five lessons first. Then you can reveal the key and import it into Slush. Production would use
            zkLogin instead of a raw key, tying this address to a Google or Facebook account.
          </p>
          {!lessonsDone ? (
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/learn">Lessons left: {lessons.length - completedLessons.length}</Link>
            </Button>
          ) : secret ? (
            <div className="mt-4 space-y-3">
              {!exporting ? (
                <Button variant="outline" onClick={() => setExporting(true)}>
                  Show the key
                </Button>
              ) : (
                <>
                  <Label htmlFor="export">Type EXPORT</Label>
                  <Input id="export" className="h-11 bg-background px-3" value={confirmExport} onChange={(event) => setConfirmExport(event.target.value)} />
                  {confirmExport === "EXPORT" ? (
                    <p className="break-all rounded-xl bg-background p-3 text-xs">{secret}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm">Unlock the wallet to export.</p>
          )}
        </section>
      </div>
    </div>
  );
}
