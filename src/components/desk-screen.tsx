"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/context";
import { getObligation, listDesks, listObligations, merchantAccept, merchantProof, verifyDesk } from "@/lib/actions";
import { decryptKey, encryptKey, useVault, writeVault } from "@/lib/custody";
import { formatYen, shortAddress } from "@/lib/sui/format";
import { ACCEPTED, OFFERED, type ObligationRecord } from "@/lib/sui/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import Link from "next/link";

export function DeskScreen() {
  const { messages } = useI18n();
  const d = messages.desk;
  const vault = useVault();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [quote, setQuote] = useState("");
  const [proof, setProof] = useState("");
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
      setError(d.errPassword);
      return;
    }
    if (password !== confirm) {
      setError(d.errMismatch);
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const key = new Ed25519Keypair();
      writeVault(await encryptKey(password, key.getSecretKey(), key.toSuiAddress()));
      toast.success(d.toastKey);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : d.errCreate);
    } finally {
      setBusy(null);
    }
  }

  async function withSecret() {
    if (!vault) throw new Error(d.errNoKey);
    return decryptKey(password, vault);
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="kicker">{d.kicker}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{d.title}</h1>
        <p className="mt-2 text-muted-foreground">{d.lead}</p>
        {!vault ? (
          <form onSubmit={createDesk} className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="desk-name">{d.deskName}</Label>
              <Input id="desk-name" className="h-11 px-3" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{d.password}</Label>
              <Input id="password" type="password" className="h-11 px-3" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{d.confirmPassword}</Label>
              <Input id="confirm" type="password" className="h-11 px-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </div>
            <Button className="h-11 px-5" disabled={busy !== null}>
              {busy === "create" ? d.creating : d.createKey}
            </Button>
          </form>
        ) : (
          <div className="panel mt-6 p-4 text-sm">
            <p className="text-muted-foreground">{d.thisDevice}</p>
            <p className="mt-1 font-mono">{shortAddress(address)}</p>
            <p className="mt-2">{isVerified ? d.onRegistry : d.notVerified}</p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="unlock">{d.unlockLabel}</Label>
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
                      toast.success(d.toastRegistry);
                      await load();
                    })
                    .catch((reason: Error) => setError(reason.message))
                    .finally(() => setBusy(null));
                }}
              >
                {busy === "verify" ? d.verifying : d.verifyDesk}
              </Button>
            ) : null}
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-stop">{error}</p> : null}
      </div>
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-medium">{d.openOffers}</h2>
          {open.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{d.noOffers}</p> : null}
          <div className="mt-3 space-y-3">
            {open.map((row) => (
              <article key={row.id} className="panel p-4">
                <p className="font-medium">{row.service}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.cap} {formatYen(row.maxQuote)} · {row.requireVerified ? d.verifiedRequired : d.verificationNotRequired}
                </p>
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
                          toast.success(d.toastAccepted);
                          await load();
                        })
                        .catch((reason: Error) => setError(reason.message))
                        .finally(() => setBusy(null));
                    }}
                  >
                    {busy === row.id ? d.accepting : d.acceptPrice}
                  </Button>
                </div>
                <Link href={`/o/${row.id}`} className="mt-2 inline-block text-sm text-muted-foreground underline decoration-border underline-offset-4">
                  {d.readConditions}
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-medium">{d.waitingProof}</h2>
          {mine.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{d.nothingBound}</p> : null}
          <div className="mt-3 space-y-3">
            {mine.map((row) => (
              <article key={row.id} className="panel p-4">
                <p className="font-medium">{row.service}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {d.frozenAt} {formatYen(row.acceptedQuote)}. {row.proof ? `${d.proofLabel} ${row.proof}` : d.noProofYet}
                </p>
                {!row.proof ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Input className="h-10 bg-background px-3" value={proof} onChange={(event) => setProof(event.target.value)} placeholder={d.deliveryRef} />
                    <Button
                      variant="outline"
                      className="bg-background"
                      disabled={busy !== null || proof.trim().length === 0}
                      onClick={() => {
                        setBusy(`proof-${row.id}`);
                        setError(null);
                        withSecret()
                          .then((secret) => merchantProof(secret, row.id, proof))
                          .then(async () => {
                            toast.success(d.toastProof);
                            await load();
                            await getObligation(row.id);
                          })
                          .catch((reason: Error) => setError(reason.message))
                          .finally(() => setBusy(null));
                      }}
                    >
                      {busy === `proof-${row.id}` ? d.posting : d.submitProof}
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
