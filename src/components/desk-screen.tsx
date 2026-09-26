"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getObligation, listDesks, listObligations, merchantAccept, merchantProof, verifyDesk } from "@/lib/actions";
import { decryptKey, encryptKey, useVault, writeVault } from "@/lib/custody";
import { formatYen, shortAddress } from "@/lib/sui/format";
import { ACCEPTED, OFFERED, type ObligationRecord } from "@/lib/sui/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import Link from "next/link";

export function DeskScreen() {
  const vault = useVault();
  const [name, setName] = useState("Harbor counter");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [quote, setQuote] = useState("2800");
  const [proof, setProof] = useState("POD-4421 · handed to the concierge");
  const [rows, setRows] = useState<ObligationRecord[]>([]);
  const [verified, setVerified] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [obligations, desks] = await Promise.all([listObligations(), listDesks()]);
    setRows(obligations.obligations);
    setVerified(desks.verified.map((address) => address.toLowerCase()));
  }

  useEffect(() => {
    let cancel = false;
    Promise.all([listObligations(), listDesks()])
      .then(([obligations, desks]) => {
        if (cancel) return;
        setRows(obligations.obligations);
        setVerified(desks.verified.map((address) => address.toLowerCase()));
      })
      .catch((reason: Error) => {
        if (!cancel) setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const address = vault?.address ?? "";
  const isVerified = address ? verified.includes(address.toLowerCase()) : false;
  const open = rows.filter((row) => row.status === OFFERED);
  const mine = rows.filter((row) => row.status === ACCEPTED && row.merchant.toLowerCase() === address.toLowerCase());

  async function createDesk(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters. This password is the only way back to the key.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const key = new Ed25519Keypair();
      writeVault(await encryptKey(password, key.getSecretKey(), key.toSuiAddress()));
      toast.success("A merchant key now lives on this device, encrypted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the key.");
    } finally {
      setBusy(null);
    }
  }

  async function withSecret() {
    if (!vault) throw new Error("Create a merchant key first.");
    return decryptKey(password, vault);
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-900">Merchant desk</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">Accept only if you mean the terms.</h1>
        <p className="mt-2 text-muted-foreground">
          If the merchant has no wallet, one is created here. The key is encrypted with their password. Gas for acceptance is sponsored, so they do not need SUI first. Verification is separate, and the obligation will refuse an unverified desk when the user required one.
        </p>
        {!vault ? (
          <form onSubmit={createDesk} className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="desk-name">Desk name</Label>
              <Input id="desk-name" className="h-11 bg-card px-3" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" className="h-11 bg-card px-3" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" className="h-11 bg-card px-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </div>
            <Button className="h-11 rounded-md px-5" disabled={busy !== null}>
              {busy === "create" ? "Creating…" : "Create the merchant key"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 rounded-md border bg-card p-4 text-sm">
            <p className="text-muted-foreground">This device</p>
            <p className="mt-1 font-mono">{shortAddress(address)}</p>
            <p className="mt-2">{isVerified ? "On the verification registry." : "Not verified yet."}</p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="unlock">Password, for signing</Label>
              <Input id="unlock" type="password" className="h-11 bg-background px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {!isVerified ? (
              <Button
                className="mt-3"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  setBusy("verify");
                  setError(null);
                  verifyDesk(address, name)
                    .then(async () => {
                      toast.success("Registry updated.");
                      await load();
                    })
                    .catch((reason: Error) => setError(reason.message))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === "verify" ? "Verifying…" : "Ask the registry to verify this desk"}
              </Button>
            ) : null}
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-[#8d2e2e]">{error}</p> : null}
      </div>
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-medium">Open offers</h2>
          {open.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No offered obligations.</p> : null}
          <div className="mt-3 space-y-3">
            {open.map((row) => (
              <article key={row.id} className="rounded-md border bg-card p-4">
                <p className="font-medium">{row.service}</p>
                <p className="mt-1 text-sm text-muted-foreground">Cap {formatYen(row.maxQuote)} · {row.requireVerified ? "verified merchant required" : "verification not required"}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input className="h-10 bg-background px-3 sm:max-w-32" value={quote} onChange={(event) => setQuote(event.target.value)} />
                  <Button
                    disabled={busy !== null || !vault}
                    onClick={() => {
                      setBusy(row.id);
                      setError(null);
                      withSecret()
                        .then((secret) => merchantAccept(secret, row.id, quote, name))
                        .then(async () => {
                          toast.success("Accepted. The destination is now this desk.");
                          await load();
                        })
                        .catch((reason: Error) => setError(reason.message))
                        .finally(() => setBusy(null));
                    }}
                  >
                    {busy === row.id ? "Accepting…" : "Accept at this price"}
                  </Button>
                </div>
                <Link href={`/o/${row.id}`} className="mt-2 inline-block text-sm text-muted-foreground underline decoration-border underline-offset-4">
                  Read the conditions
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-medium">Waiting on your proof</h2>
          {mine.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing is bound to this desk.</p> : null}
          <div className="mt-3 space-y-3">
            {mine.map((row) => (
              <article key={row.id} className="rounded-md border bg-card p-4">
                <p className="font-medium">{row.service}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Frozen at {formatYen(row.acceptedQuote)}. {row.proof ? `Proof: ${row.proof}` : "No proof yet."}
                </p>
                {!row.proof ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Input className="h-10 bg-background px-3" value={proof} onChange={(event) => setProof(event.target.value)} />
                    <Button
                      variant="outline"
                      className="bg-background"
                      disabled={busy !== null}
                      onClick={() => {
                        setBusy(`proof-${row.id}`);
                        setError(null);
                        withSecret()
                          .then((secret) => merchantProof(secret, row.id, proof))
                          .then(async () => {
                            toast.success("Proof submitted.");
                            await load();
                            await getObligation(row.id);
                          })
                          .catch((reason: Error) => setError(reason.message))
                          .finally(() => setBusy(null));
                      }}
                    >
                      {busy === `proof-${row.id}` ? "Posting…" : "Submit proof"}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
