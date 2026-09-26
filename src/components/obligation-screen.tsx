"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Conditions } from "@/components/conditions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/context";
import { interpolate } from "@/i18n/index";
import type { Messages } from "@/i18n/messages/types";
import { obligationSentenceLocale, statusLabelLocale } from "@/i18n/format-locale";
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
  quoteToMicro,
  shortAddress,
} from "@/lib/sui/format";
import { ACCEPTED, OFFERED, RELEASED, RETURNED, type ChainStatus, type Desk, type ObligationRecord } from "@/lib/sui/types";

export function ObligationScreen() {
  const params = useParams<{ id: string }>();
  const { messages, t } = useI18n();
  const o = messages.obligation;
  const payer = usePayer();
  const [obligation, setObligation] = useState<ObligationRecord | null | undefined>(undefined);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [proof, setProof] = useState("");
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

  if (obligation === undefined) return <p className="text-muted-foreground">{o.reading}</p>;
  if (!obligation) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{o.notFound}</h1>
        <p className="mt-2 text-muted-foreground">{error || o.checkLink}</p>
      </div>
    );
  }

  const mine = payer?.address.toLowerCase() === obligation.payer.toLowerCase();
  const ready = canRelease(obligation, now);
  const boundDesk = desks.find((desk) => desk.address && desk.address.toLowerCase() === obligation.merchant.toLowerCase());
  const sentence = obligationSentenceLocale(messages, obligation);
  const explorer = status ? explorerUrl(status.mode, "object", obligation.id) : null;
  const expired = (obligation.status === OFFERED || obligation.status === ACCEPTED) && obligation.expiresAtMs < now;
  const trace = buildTrace(messages, obligation);

  async function run(label: string, task: () => Promise<unknown>, success: string) {
    setBusy(label);
    setError(null);
    setRefusal(null);
    try {
      await task();
      toast.success(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : o.errChain);
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
      setError(o.errUnexpected);
    } catch (reason) {
      setRefusal(reason instanceof Error ? reason.message : expected);
    } finally {
      setBusy(null);
    }
  }

  const paidUsd = formatUsd(
    quoteToMicro(BigInt(obligation.acceptedQuote), BigInt(obligation.rateNum), BigInt(obligation.rateDen)),
  );
  const escrowUsd = formatUsd(
    obligation.escrow || quoteToMicro(BigInt(obligation.maxQuote), BigInt(obligation.rateNum), BigInt(obligation.rateDen)),
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <p className="kicker">{statusLabelLocale(messages, obligation, now)}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-snug tracking-tight">{sentence}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {o.cap} {formatYen(obligation.maxQuote)}
          {obligation.acceptedQuote !== "0" ? ` · ${o.frozenAt} ${formatYen(obligation.acceptedQuote)}` : ""}
          {" · "}
          {obligation.status === RELEASED
            ? t(o.paid, { usd: paidUsd, dest: shortAddress(obligation.destination) })
            : t(o.escrow, { usd: escrowUsd })}
        </p>
        <div className="mt-6">
          <Conditions obligation={obligation} now={now} />
        </div>
        {explorer ? (
          <a className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.12em] text-[#7af7e2] underline decoration-[#3dffc8]/40 underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
            {o.viewObject}
          </a>
        ) : null}
      </div>
      <div className="space-y-5">
        <section className="panel p-5">
          <h2 className="text-sm font-medium">{o.agentSees}</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {trace.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>

        {obligation.status === OFFERED && !expired ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">{o.merchantsRegistry}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(o.merchantsLead, { cap: formatYen(obligation.maxQuote) })}
            </p>
            <div className="mt-4 space-y-3">
              {desks.map((desk) => (
                <div key={desk.id} className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {desk.name} <span className="chip chip-hold">{o.verified}</span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{shortAddress(desk.address)}</p>
                  </div>
                  {desk.reachable ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          desk.id,
                          () => contactDesk(obligation.id, desk.address, desk.name, obligation.maxQuote),
                          t(o.toastAccepted, { name: desk.name }),
                        )
                      }
                    >
                      {busy === desk.id ? o.asking : t(o.askAt, { cap: formatYen(obligation.maxQuote) })}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">{o.signsOwnDesk}</p>
                  )}
                </div>
              ))}
            </div>
            {desks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{o.noVerified}</p> : null}
          </section>
        ) : null}

        {obligation.status === ACCEPTED && !obligation.proof ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">{o.proofTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{o.proofLead}</p>
            {boundDesk?.reachable ? (
              <div className="mt-3 space-y-2">
                <Label htmlFor="proof">{o.reference}</Label>
                <Input id="proof" className="h-11 bg-background px-3" value={proof} onChange={(event) => setProof(event.target.value)} placeholder={o.proofPlaceholder} required />
                <Button
                  type="button"
                  disabled={busy !== null || proof.trim().length === 0}
                  onClick={() => run("proof", () => submitDeskProof(obligation.id, boundDesk.address, proof), o.toastProof)}
                >
                  {busy === "proof" ? o.posting : t(o.postProofAs, { name: boundDesk.name })}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t(o.merchantPosts, { name: obligation.merchantName || o.theMerchant })}
              </p>
            )}
          </section>
        ) : null}

        {obligation.status === ACCEPTED ? (
          <section className="panel p-5">
            <h2 className="text-sm font-medium">{o.releaseTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready
                ? t(o.releaseReady, {
                    quote: formatYen(obligation.acceptedQuote),
                    dest: shortAddress(obligation.destination),
                  })
                : o.releaseWait}
            </p>
            <Button
              className="mt-3"
              disabled={busy !== null || !payer}
              onClick={() => {
                if (!payer) return;
                run("release", () => releaseObligation(payer, obligation.id), o.toastReleased);
              }}
            >
              {busy === "release" ? o.askingChain : o.askPay}
            </Button>
            {!payer ? <p className="mt-2 text-sm text-muted-foreground">{o.noPayerDevice}</p> : null}
          </section>
        ) : null}

        {mine && obligation.status === OFFERED ? (
          <Button
            variant="outline"
            disabled={busy !== null || !payer}
            onClick={() => payer && run("cancel", () => cancelObligation(payer, obligation.id), o.toastCancel)}
          >
            {busy === "cancel" ? o.returning : o.cancelReturn}
          </Button>
        ) : null}

        {expired ? (
          <Button
            variant="outline"
            disabled={busy !== null || !payer}
            onClick={() => payer && run("reclaim", () => reclaimObligation(payer, obligation.id), o.toastReclaim)}
          >
            {busy === "reclaim" ? o.returning : o.returnExpired}
          </Button>
        ) : null}

        {obligation.status === OFFERED || obligation.status === ACCEPTED ? (
          <section className="panel panel-dashed p-5">
            <h2 className="text-sm font-medium">{o.forbiddenTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{o.forbiddenLead}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                disabled={busy !== null || !payer}
                onClick={() => payer && refuse("revise", () => revisePrice(payer, obligation.id, "9999"), o.refusePrice)}
              >
                {o.changePrice}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-background"
                disabled={busy !== null || !payer}
                onClick={() =>
                  payer &&
                  refuse("redirect", () => redirectPayment(payer, obligation.id, "0x" + "ab".repeat(32)), o.refuseDest)
                }
              >
                {o.payOther}
              </Button>
            </div>
            {refusal ? <p className="mt-3 text-sm text-stop">{refusal}</p> : null}
          </section>
        ) : null}

        {error ? <p className="text-sm text-stop">{error}</p> : null}
        {obligation.status === OFFERED ? (
          <p className="text-sm text-muted-foreground">
            {o.deskHint}{" "}
            <Link className="underline decoration-border underline-offset-4" href="/desk">
              {o.desk}
            </Link>
            {o.deskHintEnd}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function buildTrace(messages: Messages, obligation: ObligationRecord) {
  const tr = messages.obligation.trace;
  const lines = [
    interpolate(tr.locked, {
      service: obligation.service,
      cap: formatYen(obligation.maxQuote),
    }),
  ];
  if (obligation.status === OFFERED) {
    lines.push(tr.noAccept);
  }
  if (!isZeroAddress(obligation.merchant)) {
    lines.push(
      interpolate(tr.accepted, {
        merchant: obligation.merchantName || tr.aMerchant,
        quote: formatYen(obligation.acceptedQuote),
        dest: shortAddress(obligation.destination),
      }),
    );
  }
  if (obligation.requireProof && !obligation.proof && obligation.status === ACCEPTED) {
    lines.push(tr.proofMissing);
  }
  if (obligation.proof) lines.push(interpolate(tr.proofRecorded, { proof: obligation.proof }));
  if (obligation.outcome === "released") {
    lines.push(tr.released);
  }
  if (obligation.status === RETURNED) {
    lines.push(interpolate(tr.returned, { outcome: obligation.outcome || "returned" }));
  }
  return lines;
}
