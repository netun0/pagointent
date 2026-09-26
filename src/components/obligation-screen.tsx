"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Conditions } from "@/components/conditions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelObligation,
  contactDesk,
  getObligation,
  getStatus,
  listDesks,
  reclaimObligation,
  redirectPayment,
  releaseObligation,
  revisePrice,
  submitDeskProof,
} from "@/lib/actions";
import { usePayer } from "@/lib/custody";
import {
  canRelease,
  explorerUrl,
  formatUsd,
  formatYen,
  isZeroAddress,
  obligationSentence,
  quoteToMicro,
  shortAddress,
  statusLabel,
} from "@/lib/sui/format";
import { ACCEPTED, OFFERED, RELEASED, RETURNED, type ChainStatus, type Desk, type ObligationRecord } from "@/lib/sui/types";

export function ObligationScreen() {
  const params = useParams<{ id: string }>();
  const payer = usePayer();
  const [obligation, setObligation] = useState<ObligationRecord | null | undefined>(undefined);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [proof, setProof] = useState("POD-4421 · handed to the concierge");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  async function load() {
    const [next, directory, chain] = await Promise.all([getObligation(params.id), listDesks(), getStatus()]);
    setObligation(next.obligation);
    setDesks(directory.desks);
    setStatus(chain);
  }

  useEffect(() => {
    let cancel = false;
    Promise.all([getObligation(params.id), listDesks(), getStatus()])
      .then(([next, directory, chain]) => {
        if (cancel) return;
        setObligation(next.obligation);
        setDesks(directory.desks);
        setStatus(chain);
      })
      .catch((reason: Error) => {
        if (cancel) return;
        setObligation(null);
        setError(reason.message);
      });
    return () => {
      cancel = true;
    };
  }, [params.id]);

  if (obligation === undefined) return <p className="text-muted-foreground">Reading the obligation…</p>;
  if (!obligation) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">This obligation is not on the ledger.</h1>
        <p className="mt-2 text-muted-foreground">{error || "Check the link and try again."}</p>
      </div>
    );
  }

  const mine = payer?.address.toLowerCase() === obligation.payer.toLowerCase();
  const ready = canRelease(obligation, now);
  const boundDesk = desks.find((desk) => desk.address && desk.address.toLowerCase() === obligation.merchant.toLowerCase());
  const sentence = obligationSentence(obligation);
  const explorer = status ? explorerUrl(status.mode, "object", obligation.id) : null;
  const expired = (obligation.status === OFFERED || obligation.status === ACCEPTED) && obligation.expiresAtMs < now;
  const trace = buildTrace(obligation);

  async function run(label: string, task: () => Promise<unknown>, success: string) {
    setBusy(label);
    setError(null);
    setRefusal(null);
    try {
      await task();
      toast.success(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The chain refused the instruction.");
    } finally {
      setBusy(null);
    }
  }

  async function refuse(label: string, task: () => Promise<unknown>, expected: string) {
    setBusy(label);
    setError(null);
    setRefusal(null);
    try {
      await task();
      setError("That instruction was not supposed to succeed.");
    } catch (reason) {
      setRefusal(reason instanceof Error ? reason.message : expected);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <p className="kicker">{statusLabel(obligation, now)}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-snug tracking-tight">{sentence}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cap {formatYen(obligation.maxQuote)}
          {obligation.acceptedQuote !== "0" ? ` · frozen at ${formatYen(obligation.acceptedQuote)}` : ""}
          {" · "}
          {obligation.status === RELEASED
            ? `paid ${formatUsd(quoteToMicro(BigInt(obligation.acceptedQuote), BigInt(obligation.rateNum), BigInt(obligation.rateDen)))} to ${shortAddress(obligation.destination)}`
            : `escrow ${formatUsd(obligation.escrow || quoteToMicro(BigInt(obligation.maxQuote), BigInt(obligation.rateNum), BigInt(obligation.rateDen)))}`}
        </p>
        <div className="mt-6">
          <Conditions obligation={obligation} now={now} />
        </div>
        {explorer ? (
          <a className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.12em] text-[#7af7e2] underline decoration-[#3dffc8]/40 underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
            View the object on Sui
          </a>
        ) : null}
      </div>
      <div className="space-y-5">
        <section className="panel p-5">
          <h2 className="text-sm font-medium">What the agent can see</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {trace.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>

        {obligation.status === OFFERED && !expired ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">Contact a desk</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The agent asks a merchant to accept at their own price. The price has to sit at or under the cap. An unverified desk is refused when verification is required.
            </p>
            <div className="mt-4 space-y-3">
              {desks.map((desk) => (
                <div key={desk.id} className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {desk.name}{" "}
                      <span className="font-normal text-muted-foreground">{desk.verified ? "verified" : "not verified"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Asks {formatYen(desk.ask)} · {desk.city}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-background"
                    disabled={busy !== null || !desk.address}
                    onClick={() =>
                      run(desk.id, () => contactDesk(obligation.id, desk.id), `${desk.name} answered.`)
                    }
                  >
                    {busy === desk.id ? "Contacting…" : "Contact"}
                  </Button>
                </div>
              ))}
            </div>
            {!desks.some((desk) => desk.address) ? (
              <p className="mt-3 text-sm text-muted-foreground">No desk keys are published on this network yet. A merchant can still accept from the desk page.</p>
            ) : null}
          </section>
        ) : null}

        {obligation.status === ACCEPTED && !obligation.proof && boundDesk ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">Proof of delivery</h2>
            <p className="mt-1 text-sm text-muted-foreground">The bound merchant posts the reference. Release stays closed until it is on the object.</p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="proof">Reference</Label>
              <Input id="proof" className="h-11 bg-background px-3" value={proof} onChange={(event) => setProof(event.target.value)} />
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("proof", () => submitDeskProof(obligation.id, boundDesk.id, proof), "Proof is on the obligation.")
                }
              >
                {busy === "proof" ? "Posting…" : `Post proof as ${boundDesk.name}`}
              </Button>
            </div>
          </section>
        ) : null}

        {obligation.status === ACCEPTED ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">Release</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready
                ? `The predicate holds. Paying ${formatYen(obligation.acceptedQuote)} to ${shortAddress(obligation.destination)} is allowed.`
                : "The agent can try. The chain releases nothing until every required condition holds."}
            </p>
            <Button
              className="mt-3"
              disabled={busy !== null || !payer}
              onClick={() => {
                if (!payer) return;
                run("release", () => releaseObligation(payer.secret, obligation.id), "Released to the bound destination.");
              }}
            >
              {busy === "release" ? "Asking the chain…" : "Ask the agent to pay"}
            </Button>
            {!payer ? <p className="mt-2 text-sm text-muted-foreground">The signer that locked this obligation is not on this device.</p> : null}
          </section>
        ) : null}

        {mine && obligation.status === OFFERED ? (
          <Button
            variant="outline"
            disabled={busy !== null || !payer}
            onClick={() => payer && run("cancel", () => cancelObligation(payer.secret, obligation.id), "Escrow returned.")}
          >
            {busy === "cancel" ? "Returning…" : "Cancel and return the funds"}
          </Button>
        ) : null}

        {expired ? (
          <Button
            variant="outline"
            disabled={busy !== null || !payer}
            onClick={() => payer && run("reclaim", () => reclaimObligation(payer.secret, obligation.id), "Expired funds returned.")}
          >
            {busy === "reclaim" ? "Returning…" : "Return the expired escrow"}
          </Button>
        ) : null}

        {obligation.status === OFFERED || obligation.status === ACCEPTED ? (
          <section className="panel panel-dashed p-5">
            <h2 className="text-sm font-medium">Instructions the agent is not allowed to run</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A merchant who changes the price, or a payment sent somewhere else, does not get a transaction that succeeds.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                disabled={busy !== null || !payer}
                onClick={() =>
                  payer &&
                  refuse("revise", () => revisePrice(payer.secret, obligation.id, "9999"), "The price cannot be revised.")
                }
              >
                Change the price to ¥9,999
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                disabled={busy !== null || !payer}
                onClick={() =>
                  payer &&
                  refuse(
                    "redirect",
                    () => redirectPayment(payer.secret, obligation.id, "0x" + "ab".repeat(32)),
                    "The destination cannot be changed.",
                  )
                }
              >
                Pay a different address
              </Button>
            </div>
            {refusal ? <p className="mt-3 text-sm text-stop">{refusal}</p> : null}
          </section>
        ) : null}

        {error ? <p className="text-sm text-stop">{error}</p> : null}
        {obligation.status === OFFERED ? (
          <p className="text-sm text-muted-foreground">
            A merchant without a published key can accept from the{" "}
            <Link className="underline decoration-border underline-offset-4" href="/desk">
              desk
            </Link>
            . If they have no wallet, one is created there and verification is checked before acceptance.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function buildTrace(obligation: ObligationRecord) {
  const lines = [
    `Escrow locked for ${obligation.service}. The cap is ${formatYen(obligation.maxQuote)}, and the yen-to-USDC rate is frozen on the object.`,
  ];
  if (obligation.status === OFFERED) {
    lines.push("No merchant has accepted. Until one does, there is no destination and nothing to release.");
  }
  if (!isZeroAddress(obligation.merchant)) {
    lines.push(
      `${obligation.merchantName || "A merchant"} accepted at ${formatYen(obligation.acceptedQuote)}. The only payable address is ${shortAddress(obligation.destination)}.`,
    );
  }
  if (obligation.requireProof && !obligation.proof && obligation.status === ACCEPTED) {
    lines.push("Proof of delivery is missing, so a release instruction aborts.");
  }
  if (obligation.proof) lines.push(`Proof is recorded: ${obligation.proof}`);
  if (obligation.outcome === "released") {
    lines.push("Every required condition held. The payment went to the bound address, and any unused cap returned to the payer.");
  }
  if (obligation.status === RETURNED) {
    lines.push(`The funds returned to the payer. Outcome: ${obligation.outcome || "returned"}.`);
  }
  return lines;
}
