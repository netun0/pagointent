import { ACCEPTED, OFFERED, RATE_DEN, RATE_NUM, RELEASED, RETURNED, type NetworkName, type ObligationRecord } from "@/lib/sui/types";

export function formatUsd(micro: string | number | bigint) {
  const value = BigInt(micro || 0);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 1_000_000n;
  const cents = ((abs % 1_000_000n) / 10_000n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${cents}`;
}

export function formatSui(mist: string | number | bigint) {
  const value = BigInt(mist || 0);
  const whole = value / 1_000_000_000n;
  const frac = (value % 1_000_000_000n).toString().padStart(9, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac} SUI` : `${whole} SUI`;
}

export function formatYen(quote: string | number | bigint) {
  const value = BigInt(quote || 0);
  const grouped = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `¥${grouped}`;
}

export function quoteToMicro(quote: bigint, rateNum = RATE_NUM, rateDen = RATE_DEN) {
  if (rateDen <= 0n) return 0n;
  return (quote * rateNum) / rateDen;
}

export function parseYen(input: string) {
  const trimmed = input.trim().replace(/[¥,\s]/g, "");
  if (!/^\d+$/.test(trimmed)) return null;
  const value = BigInt(trimmed);
  if (value <= 0n || value > 1_000_000n) return null;
  return value;
}

export function shortAddress(address: string) {
  if (!address || isZeroAddress(address)) return "";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isZeroAddress(address: string) {
  if (!address) return true;
  const hex = address.toLowerCase().replace(/^0x/, "");
  return /^0+$/.test(hex);
}

export function formatWhen(ms: number) {
  const date = new Date(ms);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const visionHost: Record<Exclude<NetworkName, "local">, string> = {
  devnet: "https://devnet.suivision.xyz",
  testnet: "https://testnet.suivision.xyz",
};

const visionKind = {
  tx: "txblock",
  object: "object",
  account: "account",
  package: "package",
} as const;

export function explorerUrl(network: NetworkName, kind: "tx" | "object" | "account" | "package", id: string) {
  if (!id || network === "local" || id.startsWith("preview-")) return null;
  return `${visionHost[network]}/${visionKind[kind]}/${id}`;
}

export function todayInputValue() {
  return dateInputValue(new Date());
}

export function weekAheadInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return dateInputValue(date);
}

function dateInputValue(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function expiryFromDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const end = new Date(year, month - 1, day, 23, 59, 59, 0).getTime();
  return Math.max(end, Date.now() + 15 * 60 * 1000);
}

export function obligationSentence(input: { service: string; maxQuote: string; requireVerified: boolean; requireProof: boolean }) {
  const who = input.requireVerified ? "only from a verified merchant" : "from the merchant who accepts";
  const when = input.requireProof
    ? "only release the money when I receive proof of delivery"
    : "release the money when they accept";
  return `Buy ${input.service.trim() || "this service"} for up to ${formatYen(input.maxQuote || "0")}, ${who}, and ${when}.`;
}

export function statusLabel(obligation: Pick<ObligationRecord, "status" | "outcome" | "expiresAtMs">, now = Date.now()) {
  if (obligation.status === OFFERED && obligation.expiresAtMs < now) return "Unclaimed";
  if (obligation.status === ACCEPTED && obligation.expiresAtMs < now) return "Undelivered";
  if (obligation.status === OFFERED) return "Offered";
  if (obligation.status === ACCEPTED) return "Accepted";
  if (obligation.status === RELEASED) return "Released";
  if (obligation.status === RETURNED) {
    if (obligation.outcome === "cancelled") return "Cancelled";
    if (obligation.outcome === "declined") return "Declined";
    if (obligation.outcome === "expired") return "Returned";
    return "Returned";
  }
  return "Unknown";
}

export type GateState = "pass" | "wait" | "fail";

export type Gate = {
  id: string;
  label: string;
  detail: string;
  state: GateState;
};

export function gates(obligation: ObligationRecord, now = Date.now()): Gate[] {
  const open = obligation.status === OFFERED || obligation.status === ACCEPTED;
  const expired = open && obligation.expiresAtMs < now;
  const bound = !isZeroAddress(obligation.merchant);
  const quote = BigInt(obligation.acceptedQuote || 0);
  const cap = BigInt(obligation.maxQuote || 0);
  const priceOk = quote > 0n && quote <= cap;

  return [
    {
      id: "cap",
      label: "Cap",
      detail: `At most ${formatYen(obligation.maxQuote)}. The escrow was locked at this ceiling.`,
      state: "pass",
    },
    {
      id: "verified",
      label: "Verified merchant",
      detail: !obligation.requireVerified
        ? "This obligation does not require verification."
        : obligation.status === OFFERED
          ? "Acceptance checks the merchant registry. An unverified desk cannot take it."
          : bound
            ? `${obligation.merchantName || "The merchant"} was on the registry when they accepted.`
            : "No merchant was bound.",
      state: !obligation.requireVerified || obligation.status === ACCEPTED || obligation.status === RELEASED ? "pass" : expired ? "fail" : "wait",
    },
    {
      id: "price",
      label: "Price unchanged",
      detail:
        obligation.status === OFFERED
          ? "No quote is frozen yet. A quote above the cap is rejected."
          : priceOk
            ? `Frozen at ${formatYen(obligation.acceptedQuote)}. There is no instruction that revises it.`
            : "The stored quote is not within the cap.",
      state: obligation.status === OFFERED ? "wait" : priceOk ? "pass" : "fail",
    },
    {
      id: "destination",
      label: "Destination",
      detail: bound
        ? `Payment can only go to ${shortAddress(obligation.destination)}.`
        : "The destination is bound to the merchant who accepts. It cannot be redirected.",
      state: bound && obligation.destination.toLowerCase() === obligation.merchant.toLowerCase() ? "pass" : expired ? "fail" : "wait",
    },
    {
      id: "proof",
      label: "Proof of delivery",
      detail: !obligation.requireProof
        ? "This obligation does not require proof."
        : obligation.proof
          ? obligation.proof
          : "The money stays put until a delivery reference is on the obligation.",
      state: !obligation.requireProof || obligation.proof ? "pass" : expired ? "fail" : "wait",
    },
    {
      id: "deadline",
      label: "Deadline",
      detail: expired
        ? `Passed on ${formatWhen(obligation.expiresAtMs)}. The escrow can return to the payer.`
        : `Open through ${formatWhen(obligation.expiresAtMs)}.`,
      state: expired ? "fail" : "pass",
    },
  ];
}

export function canRelease(obligation: ObligationRecord, now = Date.now()) {
  if (obligation.status !== ACCEPTED) return false;
  if (obligation.expiresAtMs < now) return false;
  if (isZeroAddress(obligation.destination) || obligation.destination.toLowerCase() !== obligation.merchant.toLowerCase()) return false;
  const quote = BigInt(obligation.acceptedQuote || 0);
  if (quote <= 0n || quote > BigInt(obligation.maxQuote || 0)) return false;
  if (obligation.requireProof && !obligation.proof) return false;
  return true;
}
