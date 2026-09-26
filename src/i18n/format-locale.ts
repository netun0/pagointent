import type { Messages } from "./messages/types";
import { interpolate } from "./index";
import {
  ACCEPTED,
  OFFERED,
  RELEASED,
  RETURNED,
  type ObligationRecord,
} from "@/lib/sui/types";
import {
  formatWhen,
  formatYen,
  isZeroAddress,
  shortAddress,
  type Gate,
  type GateState,
} from "@/lib/sui/format";

const dateLocale: Record<string, string> = {
  en: "en-GB",
  ja: "ja-JP",
  es: "es-ES",
  pt: "pt-BR",
};

export function formatWhenLocale(ms: number, locale: string) {
  const tag = dateLocale[locale] ?? "en-GB";
  const date = new Date(ms);
  return date.toLocaleDateString(tag, { day: "2-digit", month: "short", year: "numeric" });
}

export function obligationSentenceLocale(
  messages: Messages,
  input: { service: string; maxQuote: string; requireVerified: boolean; requireProof: boolean },
) {
  const who = input.requireVerified
    ? messages.format.obligation.whoVerified
    : messages.format.obligation.whoAny;
  const when = input.requireProof
    ? messages.format.obligation.whenProof
    : messages.format.obligation.whenAccept;
  const service = input.service.trim() || messages.format.namedService;
  return interpolate(messages.format.obligation.sentence, {
    service,
    cap: formatYen(input.maxQuote || "0"),
    who,
    when,
  });
}

export function statusLabelLocale(
  messages: Messages,
  obligation: Pick<ObligationRecord, "status" | "outcome" | "expiresAtMs">,
  now = Date.now(),
) {
  const s = messages.format.status;
  if (obligation.status === OFFERED && obligation.expiresAtMs < now) return s.unclaimed;
  if (obligation.status === ACCEPTED && obligation.expiresAtMs < now) return s.undelivered;
  if (obligation.status === OFFERED) return s.offered;
  if (obligation.status === ACCEPTED) return s.accepted;
  if (obligation.status === RELEASED) return s.released;
  if (obligation.status === RETURNED) {
    if (obligation.outcome === "cancelled") return s.cancelled;
    if (obligation.outcome === "declined") return s.declined;
    if (obligation.outcome === "expired") return s.returned;
    return s.returned;
  }
  return s.unknown;
}

export function gateMarkLocale(messages: Messages, state: GateState) {
  return messages.format.gateMark[state];
}

export function gatesLocale(
  messages: Messages,
  obligation: ObligationRecord,
  locale: string,
  now = Date.now(),
): Gate[] {
  const g = messages.format.gates;
  const open = obligation.status === OFFERED || obligation.status === ACCEPTED;
  const expired = open && obligation.expiresAtMs < now;
  const bound = !isZeroAddress(obligation.merchant);
  const quote = BigInt(obligation.acceptedQuote || 0);
  const cap = BigInt(obligation.maxQuote || 0);
  const priceOk = quote > 0n && quote <= cap;
  const whenStr = formatWhenLocale(obligation.expiresAtMs, locale);

  return [
    {
      id: "cap",
      label: g.cap,
      detail: interpolate(g.capDetail, { cap: formatYen(obligation.maxQuote) }),
      state: "pass",
    },
    {
      id: "verified",
      label: g.verified,
      detail: !obligation.requireVerified
        ? g.verifiedOff
        : obligation.status === OFFERED
          ? g.verifiedOffer
          : bound
            ? interpolate(g.verifiedBound, {
                merchant: obligation.merchantName || g.theMerchant,
              })
            : g.verifiedNone,
      state:
        !obligation.requireVerified || obligation.status === ACCEPTED || obligation.status === RELEASED
          ? "pass"
          : expired
            ? "fail"
            : "wait",
    },
    {
      id: "price",
      label: g.price,
      detail:
        obligation.status === OFFERED
          ? g.priceOffer
          : priceOk
            ? interpolate(g.priceOk, { quote: formatYen(obligation.acceptedQuote) })
            : g.priceBad,
      state: obligation.status === OFFERED ? "wait" : priceOk ? "pass" : "fail",
    },
    {
      id: "destination",
      label: g.destination,
      detail: bound
        ? interpolate(g.destBound, { dest: shortAddress(obligation.destination) })
        : g.destWait,
      state:
        bound && obligation.destination.toLowerCase() === obligation.merchant.toLowerCase()
          ? "pass"
          : expired
            ? "fail"
            : "wait",
    },
    {
      id: "proof",
      label: g.proof,
      detail: !obligation.requireProof
        ? g.proofOff
        : obligation.proof
          ? obligation.proof
          : g.proofWait,
      state: !obligation.requireProof || obligation.proof ? "pass" : expired ? "fail" : "wait",
    },
    {
      id: "deadline",
      label: g.deadline,
      detail: expired
        ? interpolate(g.deadlineExpired, { date: whenStr })
        : interpolate(g.deadlineOpen, { date: whenStr }),
      state: expired ? "fail" : "pass",
    },
  ];
}
