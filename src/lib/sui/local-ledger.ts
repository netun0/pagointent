import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { quoteToMicro } from "@/lib/sui/format";
import type { Desk } from "@/lib/sui/types";
import {
  ACCEPTED,
  OFFERED,
  RATE_DEN,
  RATE_NUM,
  RELEASED,
  RETURNED,
  type BalanceSnapshot,
  type ObligationRecord,
  type TxReceipt,
} from "@/lib/sui/types";

type VerifiedMerchant = { address: string; name: string };

type Ledger = {
  balances: Record<string, BalanceSnapshot>;
  obligations: ObligationRecord[];
  verified: VerifiedMerchant[];
};

const preferredPath = process.env.LEDGER_DIR
  ? path.join(process.env.LEDGER_DIR, "ledger.json")
  : path.join(process.cwd(), "data", "ledger.json");
const fallbackPath = path.join("/tmp", "pagointent", "ledger.json");
let activePath = preferredPath;
let queue: Promise<unknown> = Promise.resolve();

function id() {
  return `preview-${randomBytes(8).toString("hex")}`;
}

function emptyLedger(): Ledger {
  return { balances: {}, obligations: [], verified: [] };
}

function asVerified(raw: unknown): VerifiedMerchant[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const merchants: VerifiedMerchant[] = [];
  for (const item of raw) {
    const address = (typeof item === "string" ? item : item && typeof item === "object" && "address" in item ? String(item.address) : "").toLowerCase();
    const name = typeof item === "object" && item && "name" in item && item.name ? String(item.name) : "Verified merchant";
    if (!address || seen.has(address)) continue;
    seen.add(address);
    merchants.push({ address, name });
  }
  return merchants;
}

async function readLedger(): Promise<Ledger> {
  for (const candidate of [activePath, preferredPath, fallbackPath]) {
    try {
      const ledger = JSON.parse(await readFile(candidate, "utf8")) as Ledger;
      activePath = candidate;
      ledger.verified = asVerified(ledger.verified);
      return ledger;
    } catch {
      // A missing file starts a fresh preview ledger.
    }
  }
  return emptyLedger();
}

async function writeLedger(ledger: Ledger) {
  const body = JSON.stringify(ledger, null, 2);
  try {
    await mkdir(path.dirname(activePath), { recursive: true });
    await writeFile(activePath, body);
  } catch {
    activePath = fallbackPath;
    await mkdir(path.dirname(activePath), { recursive: true });
    await writeFile(activePath, body);
  }
}

function withLedger<T>(fn: (ledger: Ledger) => T): Promise<T> {
  const run = queue.then(async () => {
    const ledger = await readLedger();
    const result = fn(ledger);
    await writeLedger(ledger);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function balance(ledger: Ledger, owner: string): BalanceSnapshot {
  return ledger.balances[owner.toLowerCase()] ?? { sui: "0", usdc: "0" };
}

function credit(ledger: Ledger, owner: string, usdc: bigint, sui = 0n) {
  const current = balance(ledger, owner);
  ledger.balances[owner.toLowerCase()] = {
    sui: (BigInt(current.sui) + sui).toString(),
    usdc: (BigInt(current.usdc) + usdc).toString(),
  };
}

function debitUsdc(ledger: Ledger, owner: string, amount: bigint) {
  const current = balance(ledger, owner);
  if (BigInt(current.usdc) < amount) throw new Error("The wallet does not have the right amount of test USDC.");
  ledger.balances[owner.toLowerCase()] = {
    sui: current.sui,
    usdc: (BigInt(current.usdc) - amount).toString(),
  };
}

function find(ledger: Ledger, obligationId: string) {
  const obligation = ledger.obligations.find((item) => item.id === obligationId);
  if (!obligation) throw new Error("No obligation with that id.");
  return obligation;
}

function receipt(obligationId?: string): TxReceipt {
  return { digest: `preview-${randomBytes(6).toString("hex")}`, obligationId };
}

export function localVerified() {
  return withLedger((ledger) => ledger.verified);
}

export function localBalances(owner: string) {
  return withLedger((ledger) => balance(ledger, owner));
}

export function localObligations() {
  return withLedger((ledger) => ledger.obligations);
}

export function localObligation(id: string) {
  return withLedger((ledger) => ledger.obligations.find((item) => item.id === id) ?? null);
}

export function localBootstrap(address: string) {
  return withLedger((ledger) => {
    const current = balance(ledger, address);
    const sui = BigInt(current.sui) < 200_000_000n ? 200_000_000n : 0n;
    const usdc = BigInt(current.usdc) < 60_000_000n ? 60_000_000n : 0n;
    credit(ledger, address, usdc, sui);
    return balance(ledger, address);
  });
}

export function localVerify(address: string, name = "Verified merchant") {
  return withLedger((ledger) => {
    const key = address.toLowerCase();
    const existing = ledger.verified.find((merchant) => merchant.address === key);
    if (existing) existing.name = name;
    else ledger.verified.push({ address: key, name });
    return { digest: receipt().digest };
  });
}

export function localDesks() {
  return withLedger((ledger) =>
    ledger.verified.map(
      (merchant): Desk => ({
        id: merchant.address,
        name: merchant.name,
        address: merchant.address,
        verified: true,
        reachable: true,
      }),
    ),
  );
}

export function localCreate(input: {
  sender: string;
  service: string;
  maxQuote: string;
  requireVerified: boolean;
  requireProof: boolean;
  expiresAtMs: number;
}) {
  return withLedger((ledger) => {
    const quote = BigInt(input.maxQuote);
    const escrow = quoteToMicro(quote);
    if (escrow <= 0n) throw new Error("Amount must be a whole number of yen, up to ¥1,000,000.");
    if (input.expiresAtMs <= Date.now()) throw new Error("Pick a later date.");
    debitUsdc(ledger, input.sender, escrow);
    const obligation: ObligationRecord = {
      id: id(),
      payer: input.sender,
      service: input.service.trim(),
      currency: "JPY",
      maxQuote: quote.toString(),
      acceptedQuote: "0",
      rateNum: RATE_NUM.toString(),
      rateDen: RATE_DEN.toString(),
      requireVerified: input.requireVerified,
      requireProof: input.requireProof,
      merchant: "0x0",
      merchantName: "",
      destination: "0x0",
      proof: "",
      expiresAtMs: input.expiresAtMs,
      status: OFFERED,
      outcome: "",
      escrow: escrow.toString(),
    };
    ledger.obligations.unshift(obligation);
    return receipt(obligation.id);
  });
}

export function localAccept(input: { sender: string; obligationId: string; quote: string; merchantName: string }) {
  return withLedger((ledger) => {
    const obligation = find(ledger, input.obligationId);
    if (obligation.status !== OFFERED) throw new Error("This obligation is no longer open.");
    if (Date.now() > obligation.expiresAtMs) throw new Error("This obligation has passed its date.");
    const quote = BigInt(input.quote);
    if (quote <= 0n || quote > BigInt(obligation.maxQuote)) throw new Error("That price is above the cap.");
    if (input.sender.toLowerCase() === obligation.payer.toLowerCase()) throw new Error("The payer cannot accept their own obligation.");
    if (obligation.requireVerified && !ledger.verified.some((merchant) => merchant.address === input.sender.toLowerCase())) {
      throw new Error("That merchant is not on the verification registry.");
    }
    obligation.acceptedQuote = quote.toString();
    obligation.merchant = input.sender;
    obligation.destination = input.sender;
    obligation.merchantName = input.merchantName;
    obligation.status = ACCEPTED;
    return receipt(obligation.id);
  });
}

export function localContact(input: { obligationId: string; merchant: string; merchantName: string; quote: string }) {
  return localAccept({
    sender: input.merchant,
    obligationId: input.obligationId,
    quote: input.quote,
    merchantName: input.merchantName,
  });
}

export function localProof(input: { sender: string; obligationId: string; proof: string }) {
  return withLedger((ledger) => {
    const obligation = find(ledger, input.obligationId);
    if (obligation.status !== ACCEPTED) throw new Error("This obligation is not accepted.");
    if (input.sender.toLowerCase() !== obligation.merchant.toLowerCase()) throw new Error("Only the bound merchant can submit proof.");
    if (!input.proof.trim()) throw new Error("Proof of delivery is still missing.");
    obligation.proof = input.proof.trim();
    return receipt(obligation.id);
  });
}

export function localProve(input: { obligationId: string; merchant: string; proof: string }) {
  return localProof({ sender: input.merchant, obligationId: input.obligationId, proof: input.proof });
}

export function localRelease(input: { obligationId: string }) {
  return withLedger((ledger) => {
    const obligation = find(ledger, input.obligationId);
    if (obligation.status !== ACCEPTED) throw new Error("This obligation is not ready to release.");
    if (Date.now() > obligation.expiresAtMs) throw new Error("This obligation has passed its date.");
    if (obligation.destination.toLowerCase() !== obligation.merchant.toLowerCase()) {
      throw new Error("The destination does not match the merchant who accepted.");
    }
    const quote = BigInt(obligation.acceptedQuote);
    if (quote <= 0n || quote > BigInt(obligation.maxQuote)) throw new Error("The stored price is not within the cap.");
    if (obligation.requireVerified && !ledger.verified.some((merchant) => merchant.address === obligation.merchant.toLowerCase())) {
      throw new Error("That merchant is not on the verification registry.");
    }
    if (obligation.requireProof && !obligation.proof) throw new Error("Proof of delivery is still missing.");
    const pay = quoteToMicro(quote, BigInt(obligation.rateNum), BigInt(obligation.rateDen));
    const escrow = BigInt(obligation.escrow);
    if (pay <= 0n || pay > escrow) throw new Error("The escrow does not cover the frozen price.");
    credit(ledger, obligation.destination, pay);
    if (escrow > pay) credit(ledger, obligation.payer, escrow - pay);
    obligation.escrow = "0";
    obligation.status = RELEASED;
    obligation.outcome = "released";
    return receipt(obligation.id);
  });
}

export function localCancel(input: { sender: string; obligationId: string }) {
  return withLedger((ledger) => refund(ledger, input.obligationId, input.sender, "cancelled", false));
}

export function localDecline(input: { sender: string; obligationId: string }) {
  return withLedger((ledger) => {
    const obligation = find(ledger, input.obligationId);
    if (obligation.status !== ACCEPTED) throw new Error("This obligation is not accepted.");
    if (input.sender.toLowerCase() !== obligation.merchant.toLowerCase()) throw new Error("Only the bound merchant can decline.");
    if (obligation.proof) throw new Error("Proof is already on the obligation.");
    return refund(ledger, input.obligationId, obligation.payer, "declined", true);
  });
}

export function localReclaim(input: { obligationId: string }) {
  return withLedger((ledger) => {
    const obligation = find(ledger, input.obligationId);
    if (Date.now() <= obligation.expiresAtMs) throw new Error("This obligation has not expired yet.");
    return refund(ledger, input.obligationId, obligation.payer, "expired", true);
  });
}

function refund(ledger: Ledger, obligationId: string, payer: string, outcome: string, alreadyChecked: boolean) {
  const obligation = find(ledger, obligationId);
  if (!alreadyChecked) {
    if (obligation.payer.toLowerCase() !== payer.toLowerCase()) throw new Error("Only the payer can cancel this obligation.");
    if (obligation.status !== OFFERED) throw new Error("This obligation is no longer open.");
  } else if (obligation.status !== OFFERED && obligation.status !== ACCEPTED) {
    throw new Error("This obligation is already closed.");
  }
  credit(ledger, obligation.payer, BigInt(obligation.escrow));
  obligation.escrow = "0";
  obligation.status = RETURNED;
  obligation.outcome = outcome;
  return receipt(obligation.id);
}

export function localRevise(): never {
  throw new Error("The price was frozen at acceptance. There is no instruction that changes it.");
}

export function localRedirect(): never {
  throw new Error("The destination was bound at acceptance. There is no instruction that retargets it.");
}
