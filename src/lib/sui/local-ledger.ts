import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { bytesToHex, hashSecret, hexToBytes } from "@/lib/sui/hash";
import {
  STATUS_ACCEPTED,
  STATUS_CANCELLED,
  STATUS_EXPIRED,
  STATUS_PENDING,
  type ActivityRecord,
  type BalanceSnapshot,
  type IntentRecord,
  type ListingRecord,
  type TxReceipt,
} from "@/lib/sui/types";

type StoredIntent = IntentRecord & { claimHash: string };
type Ledger = {
  balances: Record<string, BalanceSnapshot>;
  intents: StoredIntent[];
  listings: ListingRecord[];
  badges: string[];
  activity: ActivityRecord[];
};

const preferredPath = process.env.LEDGER_DIR
  ? path.join(process.env.LEDGER_DIR, "ledger.json")
  : path.join(process.cwd(), "data", "ledger.json");
const fallbackPath = path.join("/tmp", "intenses", "ledger.json");
let activePath = preferredPath;
let queue: Promise<unknown> = Promise.resolve();

function id() {
  return `0x${randomBytes(32).toString("hex")}`;
}

function flagship(): ListingRecord[] {
  const seller = `0x${"c0".repeat(32)}`;
  return [
    ["Oat latte", "Corner Cup. A counter that gets paid in USDC without opening an exchange account.", "1500000", "11"],
    ["Talk time", "Airtime Desk. A $2 top-up. The demo prints a voucher once the payment settles.", "2000000", "22"],
    ["Chili crisp", "Night Market. A jar, fulfilled by a flagship partner once the payment settles.", "3000000", "33"],
    ["Day pass", "Paper Route. One transit day. The kind of purchase that used to need a bank card.", "1250000", "44"],
  ].map(([title, detail, price, tag]) => ({
    id: `0x${tag.repeat(32)}`,
    seller,
    title,
    detail,
    price,
    kind: 0,
    active: true,
  }));
}

function emptyLedger(): Ledger {
  return { balances: {}, intents: [], listings: flagship(), badges: [], activity: [] };
}

async function readLedger(): Promise<Ledger> {
  for (const candidate of [activePath, preferredPath, fallbackPath]) {
    try {
      const ledger = JSON.parse(await readFile(candidate, "utf8")) as Ledger;
      activePath = candidate;
      return ledger;
    } catch {
      // Try the next location. A missing file means a fresh preview ledger.
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

function bucket(ledger: Ledger, address: string) {
  if (!ledger.balances[address]) ledger.balances[address] = { sui: "0", usdc: "0" };
  return ledger.balances[address];
}

function credit(balance: BalanceSnapshot, key: keyof BalanceSnapshot, amount: bigint) {
  balance[key] = (BigInt(balance[key]) + amount).toString();
}

function debit(balance: BalanceSnapshot, key: keyof BalanceSnapshot, amount: bigint, label: string) {
  const current = BigInt(balance[key]);
  if (current < amount) throw new Error(`Not enough ${label} in this preview wallet.`);
  balance[key] = (current - amount).toString();
}

function note(ledger: Ledger, summary: string): TxReceipt {
  const digest = `preview-${randomBytes(6).toString("hex")}`;
  ledger.activity.unshift({ id: digest, at: Date.now(), summary, digest });
  ledger.activity = ledger.activity.slice(0, 40);
  return { digest };
}

function publicIntent(intent: StoredIntent): IntentRecord {
  return {
    id: intent.id,
    payer: intent.payer,
    payeeName: intent.payeeName,
    purpose: intent.purpose,
    amount: intent.amount,
    expiresAtMs: intent.expiresAtMs,
    status: intent.status,
    payee: intent.payee,
  };
}

export function localBalances(address: string) {
  return withLedger((ledger) => ({ ...bucket(ledger, address) }));
}

export function localIntents() {
  return withLedger((ledger) => ledger.intents.map(publicIntent));
}

export function localIntent(id: string) {
  return withLedger((ledger) => {
    const intent = ledger.intents.find((item) => item.id === id);
    return intent ? publicIntent(intent) : null;
  });
}

export function localListings() {
  return withLedger((ledger) => ledger.listings);
}

export function localActivity() {
  return withLedger((ledger) => ledger.activity.slice(0, 20));
}

export function localBootstrap(address: string) {
  return withLedger((ledger) => {
    const balance = bucket(ledger, address);
    if (BigInt(balance.sui) < 200_000_000n) credit(balance, "sui", 1_000_000_000n);
    if (BigInt(balance.usdc) < 10_000_000n) credit(balance, "usdc", 20_000_000n);
    const receipt = note(ledger, `Funded preview wallet ${address.slice(0, 8)}`);
    return { ...balance, digest: receipt.digest };
  });
}

export function localCreate(input: {
  sender: string;
  payeeName: string;
  purpose: string;
  amount: string;
  expiresAtMs: number;
  claimHashHex: string;
}) {
  return withLedger((ledger) => {
    const amount = BigInt(input.amount);
    if (amount <= 0n || amount > 100_000_000n) throw new Error("Amount must be between $0.01 and $100.");
    if (input.expiresAtMs <= Date.now()) throw new Error("Pick a date that is still ahead.");
    debit(bucket(ledger, input.sender), "usdc", amount, "test USDC");
    debit(bucket(ledger, input.sender), "sui", 2_000_000n, "SUI for gas");
    const intent: StoredIntent = {
      id: id(),
      payer: input.sender,
      payeeName: input.payeeName.trim(),
      purpose: input.purpose.trim(),
      amount: amount.toString(),
      expiresAtMs: input.expiresAtMs,
      status: STATUS_PENDING,
      payee: "0x0",
      claimHash: input.claimHashHex,
    };
    ledger.intents.unshift(intent);
    const receipt = note(ledger, `Locked ${intent.payeeName}'s payment`);
    return { ...receipt, intentId: intent.id };
  });
}

export function localAccept(input: { intentId: string; secretHex: string; payee: string }) {
  return withLedger((ledger) => {
    const intent = ledger.intents.find((item) => item.id === input.intentId);
    if (!intent) throw new Error("No intent with that id.");
    if (intent.status === STATUS_ACCEPTED && intent.payee === input.payee) {
      return { digest: "preview-already", intentId: intent.id };
    }
    if (intent.status !== STATUS_PENDING) throw new Error("This intent is no longer open.");
    if (intent.expiresAtMs < Date.now()) throw new Error("This intent has passed its date.");
    const digest = bytesToHex(hashSecret(hexToBytes(input.secretHex)));
    if (digest !== intent.claimHash) throw new Error("That code does not match this intent.");
    intent.status = STATUS_ACCEPTED;
    intent.payee = input.payee;
    credit(bucket(ledger, input.payee), "usdc", BigInt(intent.amount));
    credit(bucket(ledger, input.payee), "sui", 100_000_000n);
    const receipt = note(ledger, `Accepted payment into ${input.payee.slice(0, 8)}`);
    return { ...receipt, intentId: intent.id };
  });
}

export function localCancel(sender: string, intentId: string) {
  return withLedger((ledger) => close(ledger, sender, intentId, STATUS_CANCELLED, false));
}

export function localReclaim(sender: string, intentId: string) {
  return withLedger((ledger) => close(ledger, sender, intentId, STATUS_EXPIRED, true));
}

function close(ledger: Ledger, sender: string, intentId: string, status: number, expired: boolean): TxReceipt {
  const intent = ledger.intents.find((item) => item.id === intentId);
  if (!intent) throw new Error("No intent with that id.");
  if (intent.payer !== sender) throw new Error("Only the payer can close this intent.");
  if (intent.status !== STATUS_PENDING) throw new Error("This intent is no longer open.");
  if (expired && intent.expiresAtMs >= Date.now()) throw new Error("This intent has not expired yet.");
  intent.status = status;
  credit(bucket(ledger, sender), "usdc", BigInt(intent.amount));
  const receipt = note(ledger, status === STATUS_CANCELLED ? "Cancelled an intent" : "Reclaimed an expired intent");
  return { ...receipt, intentId };
}

export function localBuy(sender: string, listingId: string, price: string) {
  return withLedger((ledger) => {
    const listing = ledger.listings.find((item) => item.id === listingId);
    if (!listing || !listing.active) throw new Error("That item has already been bought.");
    if (listing.seller === sender) throw new Error("You can't buy your own listing.");
    if (listing.price !== price) throw new Error("The price changed. Refresh and try again.");
    debit(bucket(ledger, sender), "usdc", BigInt(price), "test USDC");
    debit(bucket(ledger, sender), "sui", 2_000_000n, "SUI for gas");
    credit(bucket(ledger, listing.seller), "usdc", BigInt(price));
    listing.active = false;
    const receipt = note(ledger, `Bought ${listing.title}`);
    return { ...receipt, voucher: receipt.digest.slice(-8).toUpperCase() };
  });
}

export function localList(sender: string, title: string, detail: string, price: string) {
  return withLedger((ledger) => {
    debit(bucket(ledger, sender), "sui", 2_000_000n, "SUI for gas");
    const listing: ListingRecord = {
      id: id(),
      seller: sender,
      title: title.trim(),
      detail: detail.trim(),
      price,
      kind: 1,
      active: true,
    };
    ledger.listings.unshift(listing);
    const receipt = note(ledger, `Listed ${listing.title}`);
    return { ...receipt, listingId: listing.id };
  });
}

export function localBadge(sender: string) {
  return withLedger((ledger) => {
    if (ledger.badges.includes(sender)) throw new Error("This wallet already has a learner badge.");
    debit(bucket(ledger, sender), "sui", 2_000_000n, "SUI for gas");
    ledger.badges.push(sender);
    const badgeId = id();
    const receipt = note(ledger, "Minted a learner badge");
    return { ...receipt, badgeId };
  });
}
