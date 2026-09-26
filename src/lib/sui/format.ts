import { STATUS_ACCEPTED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_PENDING, type IntentRecord, type NetworkName } from "@/lib/sui/types";

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

export function usdToMicro(input: string) {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(2, "0")) * 10_000n;
}

export function shortAddress(address: string) {
  if (!address) return "";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatWhen(ms: number) {
  const date = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const stamp = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) return `today, ${stamp}`;
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow, ${stamp}`;
  return stamp;
}

export function statusText(intent: Pick<IntentRecord, "status" | "expiresAtMs">) {
  if (intent.status === STATUS_PENDING && intent.expiresAtMs < Date.now()) return "Past due";
  if (intent.status === STATUS_PENDING) return "Waiting";
  if (intent.status === STATUS_ACCEPTED) return "Accepted";
  if (intent.status === STATUS_CANCELLED) return "Cancelled";
  if (intent.status === STATUS_EXPIRED) return "Expired";
  return "Unknown";
}

export function explorerUrl(network: NetworkName, kind: "tx" | "object" | "account" | "package", id: string) {
  if (!id || network === "local" || id.startsWith("preview-")) return null;
  return `https://suiscan.xyz/${network}/${kind}/${id}`;
}

export function todayInputValue() {
  const date = new Date();
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

export function voucherFromDigest(digest: string) {
  return digest.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}
