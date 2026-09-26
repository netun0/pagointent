"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Ticket } from "@/components/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptPayment, cancelIntent, getIntent, getStatus, reclaimIntent } from "@/lib/actions";
import {
  decryptKey,
  encryptKey,
  payerFromStorage,
  useClaim,
  useOrigin,
  useVault,
  writeVault,
} from "@/lib/custody";
import { explorerUrl, shortAddress } from "@/lib/sui/format";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { STATUS_PENDING, type ChainStatus, type IntentRecord } from "@/lib/sui/types";

export function IntentScreen() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const view = search.get("view");
  const secretFromUrl = search.get("k");
  const [intent, setIntent] = useState<IntentRecord | null | undefined>(undefined);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const vault = useVault();
  const origin = useOrigin();
  const storedClaim = useClaim(params.id);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAddress, setCreatedAddress] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const claim = secretFromUrl || storedClaim;

  async function load() {
    const [nextIntent, nextStatus] = await Promise.all([getIntent(params.id), getStatus()]);
    setIntent(nextIntent.intent);
    setStatus(nextStatus);
  }

  useEffect(() => {
    let cancel = false;
    Promise.all([getIntent(params.id), getStatus()])
      .then(([nextIntent, nextStatus]) => {
        if (cancel) return;
        setIntent(nextIntent.intent);
        setStatus(nextStatus);
      })
      .catch((reason: Error) => {
        if (cancel) return;
        setIntent(null);
        setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, [params.id]);

  if (intent === undefined) return <p className="text-muted-foreground">Reading the escrow…</p>;
  if (!intent) {
    return (
      <div>
        <h1 className="font-serif text-4xl">This intent is not on the ledger.</h1>
        <p className="mt-2 text-muted-foreground">{error || "Check the link and try again."}</p>
      </div>
    );
  }

  const payer = payerFromStorage();
  const isPayer = payer?.address.toLowerCase() === intent.payer.toLowerCase();
  const showPayer = view === "payer" || (isPayer && !secretFromUrl);
  const acceptUrl = claim && origin ? `${origin}/i/${intent.id}?k=${claim}` : null;
  const explorer = status ? explorerUrl(status.mode, "object", intent.id) : null;
  const pastDue = intent.status === STATUS_PENDING && intent.expiresAtMs < openedAt;

  async function accept(event: React.FormEvent) {
    event.preventDefault();
    if (!claim) return;
    if (!vault && password !== confirm) {
      setError("The two passwords don’t match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters. This password is the only way back to the key.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let payeeSecret: string;
      let address: string;
      if (vault) {
        payeeSecret = await decryptKey(password, vault);
        address = vault.address;
      } else {
        const key = new Ed25519Keypair();
        payeeSecret = key.getSecretKey();
        address = key.toSuiAddress();
        writeVault(await encryptKey(password, payeeSecret, address));
      }
      await acceptPayment({ intentId: intent!.id, secretHex: claim, payee: address });
      setCreatedAddress(address);
      toast.success("Wallet created. The USDC is in it.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not accept.");
    } finally {
      setBusy(false);
    }
  }

  async function close(kind: "cancel" | "reclaim") {
    if (!payer) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "cancel") await cancelIntent(payer.secret, intent!.id);
      else await reclaimIntent(payer.secret, intent!.id);
      toast.success(kind === "cancel" ? "Intent cancelled." : "Escrow returned.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not close the intent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <Ticket intent={intent} />
      <div className="space-y-5">
        {showPayer ? (
          <section className="rounded-2xl border bg-card p-5">
            <h1 className="font-serif text-3xl">Hand this to {intent.payeeName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Anyone with the code can accept the USDC into a new wallet. The payer address is {shortAddress(intent.payer)}.
            </p>
            {acceptUrl && intent.status === STATUS_PENDING && !pastDue ? (
              <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <QrCode value={acceptUrl} />
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-background"
                    onClick={() => {
                      navigator.clipboard.writeText(acceptUrl);
                      toast.success("Link copied.");
                    }}
                  >
                    Copy link
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/i/${intent.id}?k=${claim}`}>Open what they see</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {claim ? "This intent can no longer be accepted." : "The claim secret is not on this device, so the QR can’t be rebuilt."}
              </p>
            )}
            {isPayer && intent.status === STATUS_PENDING ? (
              <div className="mt-4 flex gap-2">
                {!pastDue ? (
                  <Button variant="outline" disabled={busy} onClick={() => close("cancel")}>
                    Cancel and take it back
                  </Button>
                ) : (
                  <Button variant="outline" disabled={busy} onClick={() => close("reclaim")}>
                    Reclaim expired funds
                  </Button>
                )}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border bg-card p-5">
            {createdAddress ? (
              <div>
                <h1 className="font-serif text-3xl">The wallet is yours.</h1>
                <p className="mt-2 text-muted-foreground">
                  {formatLine(intent)} The key is encrypted on this device. The address is {shortAddress(createdAddress)}.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="h-11 rounded-full px-5">
                    <Link href="/wallet">Open the wallet</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full bg-background px-5">
                    <Link href="/learn">Start the lessons</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full bg-background px-5">
                    <Link href="/market">Spend it with a partner</Link>
                  </Button>
                </div>
              </div>
            ) : intent.status !== STATUS_PENDING || pastDue ? (
              <div>
                <h1 className="font-serif text-3xl">
                  {pastDue ? "The date has passed." : intent.status === 1 ? "Someone already accepted this." : "This intent is closed."}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {intent.payee && intent.payee !== "0x0" ? `It settled to ${shortAddress(intent.payee)}.` : "The escrow is no longer open."}
                </p>
              </div>
            ) : claim ? (
              <form onSubmit={accept} className="space-y-4">
                <h1 className="font-serif text-3xl">{vault ? "Accept into your wallet" : "Accept, and we’ll make the wallet"}</h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {vault
                    ? "This browser already holds an encrypted Sui key. The password opens it, and the USDC lands there. Gas is paid by Intenses."
                    : "You don’t need an extension. Choose a password. Intenses generates a Sui key, encrypts it on this device, and the sponsor pays gas so the coins can arrive."}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" className="h-11 bg-background px-3" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
                {!vault ? (
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input id="confirm" type="password" className="h-11 bg-background px-3" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
                  </div>
                ) : null}
                <Button className="h-12 rounded-full px-6 text-base" disabled={busy}>
                  {busy ? "Creating the wallet…" : `Accept ${intent.payeeName}'s payment`}
                </Button>
              </form>
            ) : (
              <div>
                <h1 className="font-serif text-3xl">This link has no claim secret.</h1>
                <p className="mt-2 text-muted-foreground">Ask for the QR again. The secret is what opens the escrow.</p>
              </div>
            )}
          </section>
        )}
        {explorer ? (
          <a className="text-sm underline decoration-border underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
            View the escrow on Sui
          </a>
        ) : null}
        {error ? <p className="text-sm text-[#9a3b28]">{error}</p> : null}
      </div>
    </div>
  );
}

function formatLine(intent: IntentRecord) {
  return `${intent.payeeName} can spend it, keep it, or move the key into another wallet.`;
}
