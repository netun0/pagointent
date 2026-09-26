import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { chainMode, deployment } from "@/lib/sui/config";
import { sui } from "@/lib/sui/client";
import { bytesToHex, claimHashToHex, hashSecret, hexToBytes } from "@/lib/sui/hash";
import {
  localAccept,
  localActivity,
  localBadge,
  localBalances,
  localBootstrap,
  localBuy,
  localCancel,
  localCreate,
  localIntent,
  localIntents,
  localList,
  localListings,
  localReclaim,
} from "@/lib/sui/local-ledger";
import {
  STATUS_ACCEPTED,
  STATUS_PENDING,
  type ActivityRecord,
  type BalanceSnapshot,
  type ChainStatus,
  type IntentRecord,
  type ListingRecord,
  type TxReceipt,
} from "@/lib/sui/types";

function explain(error: unknown) {
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : JSON.stringify(error);
  if (!raw) return "The transaction failed.";
  if (raw.includes("EWrongSecret")) return "That code does not match this intent.";
  if (raw.includes("ENotPending")) return "This intent is no longer open.";
  if (raw.includes("EExpired")) return "This intent has passed its date.";
  if (raw.includes("ENotExpired")) return "This intent has not expired yet.";
  if (raw.includes("ENotPayer")) return "Only the payer can close this intent.";
  if (raw.includes("EAlready")) return "This wallet already has a learner badge.";
  if (raw.includes("EInactive")) return "That item has already been bought.";
  if (raw.includes("EPrice") || raw.includes("Insufficient")) return "The wallet does not have the right amount of test USDC.";
  if (raw.includes("ESelf")) return "You can't buy your own listing.";
  if (raw.includes("ELimit")) return "The faucet allows at most 100 test USDC per call.";
  return raw.length > 320 ? `${raw.slice(0, 320)}…` : raw;
}

function sponsor() {
  const secret = process.env.SPONSOR_SECRET_KEY;
  if (!secret) throw new Error("This server has no sponsor key. Run npm run chain:setup.");
  return Ed25519Keypair.fromSecretKey(secret);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCoin(owner: string, coinType: string, minimum: bigint) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { balance } = await sui().getBalance({ owner, coinType });
    if (BigInt(balance.balance) >= minimum || BigInt(balance.coinBalance) >= minimum) return;
    await sleep(750);
  }
}

function field(json: Record<string, unknown>, key: string) {
  return json[key];
}

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function parseIntent(id: string, json: Record<string, unknown>): IntentRecord {
  return {
    id,
    payer: asString(field(json, "payer")),
    payeeName: asString(field(json, "payee_name")),
    purpose: asString(field(json, "purpose")),
    amount: asString(field(json, "amount")),
    expiresAtMs: Number(field(json, "expires_at_ms") ?? 0),
    status: Number(field(json, "status") ?? 0),
    payee: asString(field(json, "payee")),
  };
}

function parseListing(id: string, json: Record<string, unknown>): ListingRecord {
  return {
    id,
    seller: asString(field(json, "seller")),
    title: asString(field(json, "title")),
    detail: asString(field(json, "detail")),
    price: asString(field(json, "price")),
    kind: Number(field(json, "kind") ?? 0),
    active: Boolean(field(json, "active")),
  };
}

async function objects(ids: string[]) {
  if (ids.length === 0) return [];
  const response = await sui().getObjects({ objectIds: ids, include: { json: true } });
  return response.objects;
}

async function events(eventType: string) {
  const page = await sui().listEvents({
    filter: { eventType },
    limit: 50,
    order: "descending",
  });
  return page.events;
}

async function settle(signer: Ed25519Keypair, tx: Transaction) {
  tx.setSender(signer.toSuiAddress());
  const bytes = await tx.build({ client: sui() });
  const signed = await signer.signTransaction(bytes);
  const result = await sui().executeTransaction({
    transaction: bytes,
    signatures: [signed.signature],
    include: { effects: true },
  });
  if (result.$kind !== "Transaction") throw new Error(explain(result.FailedTransaction.status.error));
  if (!result.Transaction.status.success) throw new Error(explain(result.Transaction.status.error));
  const full = await sui().getTransaction({
    digest: result.Transaction.digest,
    include: { effects: true, events: true },
  });
  if (full.$kind !== "Transaction") throw new Error(explain(full.FailedTransaction.status.error));
  return full.Transaction;
}

function receiptFrom(
  tx: { digest: string; events?: { eventType: string; json: Record<string, unknown> | null }[] },
  fallback: string,
): TxReceipt {
  const events = tx.events ?? [];
  const find = (suffix: string) => events.find((event) => event.eventType.endsWith(suffix))?.json ?? null;
  const created = find("::IntentCreated");
  const listed = find("::ListingCreated");
  const bought = find("::Purchased");
  const badge = find("::BadgeMinted");
  return {
    digest: tx.digest || fallback,
    intentId: created ? asString(created.intent_id) : undefined,
    listingId: listed ? asString(listed.listing_id) : undefined,
    badgeId: badge ? asString(badge.badge_id) : undefined,
    voucher: bought ? tx.digest.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() : undefined,
  };
}

export async function getStatus(): Promise<ChainStatus> {
  const deployed = deployment();
  if (chainMode() === "local") {
    return {
      mode: "local",
      packageId: null,
      usdcType: null,
      sponsorAddress: null,
      sponsorReady: false,
      referenceGasPrice: null,
      publishDigest: null,
      rpcOk: true,
      rpcError: null,
    };
  }
  let referenceGasPrice: string | null = null;
  let rpcError: string | null = null;
  try {
    const gas = await sui().getReferenceGasPrice();
    referenceGasPrice = gas.referenceGasPrice;
  } catch (error) {
    rpcError = explain(error);
  }
  return {
    mode: deployed.network,
    packageId: deployed.packageId,
    usdcType: deployed.usdcType,
    sponsorAddress: deployed.sponsorAddress,
    sponsorReady: Boolean(process.env.SPONSOR_SECRET_KEY),
    referenceGasPrice,
    publishDigest: deployed.publishDigest,
    rpcOk: !rpcError,
    rpcError,
  };
}

export async function getBalances(owner: string): Promise<BalanceSnapshot> {
  if (chainMode() === "local") return localBalances(owner);
  const [suiBalance, usdcBalance] = await Promise.all([
    sui().getBalance({ owner }),
    sui().getBalance({ owner, coinType: deployment().usdcType }),
  ]);
  return { sui: suiBalance.balance.balance, usdc: usdcBalance.balance.balance };
}

export async function listIntents(): Promise<IntentRecord[]> {
  if (chainMode() === "local") return localIntents();
  const deployed = deployment();
  const created = await events(`${deployed.packageId}::intent::IntentCreated`);
  const ids = created.map((event) => asString(event.json?.intent_id)).filter(Boolean);
  const fetched = await objects(ids);
  return fetched.flatMap((object) => {
    if (object instanceof Error || !object.json) return [];
    return [parseIntent(object.objectId, object.json)];
  });
}

export async function getIntent(id: string): Promise<IntentRecord | null> {
  if (chainMode() === "local") return localIntent(id);
  try {
    const response = await sui().getObject({ objectId: id, include: { json: true } });
    if (!response.object.json || !response.object.type?.includes("::intent::Intent")) return null;
    return parseIntent(response.object.objectId, response.object.json);
  } catch {
    return null;
  }
}

export async function listListings(): Promise<ListingRecord[]> {
  if (chainMode() === "local") return localListings();
  const deployed = deployment();
  const created = await events(`${deployed.packageId}::market::ListingCreated`);
  const ids = created.map((event) => asString(event.json?.listing_id)).filter(Boolean);
  const fetched = await objects(ids);
  return fetched.flatMap((object) => {
    if (object instanceof Error || !object.json) return [];
    return [parseListing(object.objectId, object.json)];
  });
}

export async function listActivity(owner: string): Promise<ActivityRecord[]> {
  if (chainMode() === "local") return localActivity();
  const deployed = deployment();
  const ownerLower = owner.toLowerCase();
  const groups = await Promise.all([
    events(`${deployed.packageId}::intent::IntentCreated`),
    events(`${deployed.packageId}::intent::IntentAccepted`),
    events(`${deployed.packageId}::intent::IntentClosed`),
    events(`${deployed.packageId}::market::Purchased`),
    events(`${deployed.packageId}::market::ListingCreated`),
    events(`${deployed.packageId}::learn::BadgeMinted`),
  ]);
  const items: ActivityRecord[] = [];
  for (const event of groups.flat()) {
    const json = event.json ?? {};
    const addresses = ["payer", "payee", "buyer", "seller", "learner"].map((key) => asString(json[key]).toLowerCase());
    if (!addresses.includes(ownerLower)) continue;
    let summary = "On-chain event";
    if (event.eventType.endsWith("IntentCreated") && asString(json.payer).toLowerCase() === ownerLower) {
      summary = `Locked a payment for ${asString(json.payee_name)}`;
    } else if (event.eventType.endsWith("IntentAccepted") && asString(json.payee).toLowerCase() === ownerLower) {
      summary = "Accepted a payment into this wallet";
    } else if (event.eventType.endsWith("IntentAccepted")) {
      summary = "Someone accepted your payment";
    } else if (event.eventType.endsWith("IntentClosed")) {
      summary = "Closed an intent and took the escrow back";
    } else if (event.eventType.endsWith("Purchased") && asString(json.buyer).toLowerCase() === ownerLower) {
      summary = "Bought a partner item";
    } else if (event.eventType.endsWith("ListingCreated")) {
      summary = `Listed ${asString(json.title)}`;
    } else if (event.eventType.endsWith("BadgeMinted")) {
      summary = "Minted a learner badge";
    }
    items.push({ id: `${event.transactionDigest}:${event.eventIndex}`, at: 0, summary, digest: event.transactionDigest });
  }
  return items.slice(0, 20);
}

export async function bootstrap(address: string) {
  if (chainMode() === "local") return localBootstrap(address);
  const deployed = deployment();
  const key = sponsor();
  const before = await getBalances(address);
  if (BigInt(before.sui) < 150_000_000n) {
    try {
      await requestSuiFromFaucetV2({ host: getFaucetHost(deployed.network), recipient: address });
      await waitForCoin(address, "0x2::sui::SUI", 150_000_000n);
    } catch {
      // The public faucet is often rate limited. The sponsor can pay gas instead.
    }
    const afterFaucet = await getBalances(address);
    if (BigInt(afterFaucet.sui) < 150_000_000n) {
      const tx = new Transaction();
      tx.transferObjects([coinWithBalance({ balance: 200_000_000n })], address);
      await settle(key, tx);
      await waitForCoin(address, "0x2::sui::SUI", 1n);
    }
  }
  const mid = await getBalances(address);
  if (BigInt(mid.usdc) < 10_000_000n) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${deployed.packageId}::usdc::drip`,
      arguments: [tx.object(deployed.mintHubId), tx.pure.address(address), tx.pure.u64(20_000_000)],
    });
    await settle(key, tx);
    await waitForCoin(address, deployed.usdcType, 10_000_000n);
  }
  return getBalances(address);
}

export async function acceptIntent(input: { intentId: string; secretHex: string; payee: string }) {
  if (chainMode() === "local") return localAccept(input);
  const deployed = deployment();
  const current = await getIntent(input.intentId);
  if (!current) throw new Error("No intent with that id.");
  if (current.status === STATUS_ACCEPTED && current.payee.toLowerCase() === input.payee.toLowerCase()) {
    return { digest: "already-accepted", intentId: current.id };
  }
  if (current.status !== STATUS_PENDING) throw new Error("This intent is no longer open.");
  const object = await sui().getObject({ objectId: input.intentId, include: { json: true } });
  const expected = claimHashToHex(object.object.json?.claim_hash);
  const actual = bytesToHex(hashSecret(hexToBytes(input.secretHex)));
  if (expected && actual !== expected) throw new Error("That code does not match this intent.");

  const tx = new Transaction();
  tx.moveCall({
    target: `${deployed.packageId}::intent::accept`,
    typeArguments: [deployed.usdcType],
    arguments: [
      tx.object(input.intentId),
      tx.pure.vector("u8", hexToBytes(input.secretHex)),
      tx.pure.address(input.payee),
      tx.object.clock(),
    ],
  });
  tx.transferObjects([coinWithBalance({ balance: 100_000_000n })], input.payee);
  const done = await settle(sponsor(), tx);
  await waitForCoin(input.payee, deployed.usdcType, BigInt(current.amount));
  return { digest: done.digest, intentId: input.intentId };
}

type BuildInput =
  | { action: "create"; sender: string; payeeName: string; purpose: string; amount: string; expiresAtMs: number; claimHashHex: string }
  | { action: "cancel"; sender: string; intentId: string }
  | { action: "reclaim"; sender: string; intentId: string }
  | { action: "buy"; sender: string; listingId: string; price: string }
  | { action: "list"; sender: string; title: string; detail: string; price: string }
  | { action: "badge"; sender: string };

function assertText(value: string, label: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`${label} needs 1–${max} characters.`);
  return trimmed;
}

export async function act(input: BuildInput): Promise<TxReceipt> {
  if (chainMode() === "local") {
    if (input.action === "create") return localCreate(input);
    if (input.action === "cancel") return localCancel(input.sender, input.intentId);
    if (input.action === "reclaim") return localReclaim(input.sender, input.intentId);
    if (input.action === "buy") return localBuy(input.sender, input.listingId, input.price);
    if (input.action === "list") return localList(input.sender, input.title, input.detail, input.price);
    return localBadge(input.sender);
  }
  throw new Error("This network needs a signature. Build the transaction first.");
}

export async function buildTransaction(input: BuildInput) {
  if (chainMode() === "local") throw new Error("Preview mode does not build chain transactions.");
  const deployed = deployment();
  const tx = new Transaction();
  tx.setSender(input.sender);
  if (input.action === "create") {
    const name = assertText(input.payeeName, "Name", 48);
    const purpose = assertText(input.purpose, "Purpose", 180);
    const amount = BigInt(input.amount);
    if (amount <= 0n || amount > 100_000_000n) throw new Error("Amount must be between $0.01 and $100.");
    tx.moveCall({
      target: `${deployed.packageId}::intent::create`,
      typeArguments: [deployed.usdcType],
      arguments: [
        coinWithBalance({ type: deployed.usdcType, balance: amount }),
        tx.pure.string(name),
        tx.pure.string(purpose),
        tx.pure.u64(input.expiresAtMs),
        tx.pure.vector("u8", hexToBytes(input.claimHashHex)),
        tx.object.clock(),
      ],
    });
  } else if (input.action === "cancel" || input.action === "reclaim") {
    tx.moveCall({
      target: `${deployed.packageId}::intent::${input.action === "cancel" ? "cancel" : "reclaim_expired"}`,
      typeArguments: [deployed.usdcType],
      arguments:
        input.action === "cancel"
          ? [tx.object(input.intentId)]
          : [tx.object(input.intentId), tx.object.clock()],
    });
  } else if (input.action === "buy") {
    tx.moveCall({
      target: `${deployed.packageId}::market::buy`,
      typeArguments: [deployed.usdcType],
      arguments: [tx.object(input.listingId), coinWithBalance({ type: deployed.usdcType, balance: BigInt(input.price) })],
    });
  } else if (input.action === "list") {
    tx.moveCall({
      target: `${deployed.packageId}::market::list`,
      arguments: [
        tx.pure.string(assertText(input.title, "Title", 64)),
        tx.pure.string(assertText(input.detail, "Description", 240)),
        tx.pure.u64(input.price),
      ],
    });
  } else {
    tx.moveCall({
      target: `${deployed.packageId}::learn::mint_badge`,
      arguments: [tx.object(deployed.badgeRegistryId), tx.object.clock()],
    });
  }
  const bytes = await tx.build({ client: sui() });
  return { bytes: Buffer.from(bytes).toString("base64") };
}

export async function submitTransaction(bytes: string, signature: string) {
  const transaction = Uint8Array.from(Buffer.from(bytes, "base64"));
  const result = await sui().executeTransaction({
    transaction,
    signatures: [signature],
    include: { effects: true },
  });
  if (result.$kind !== "Transaction") throw new Error(explain(result.FailedTransaction.status.error));
  if (!result.Transaction.status.success) throw new Error(explain(result.Transaction.status.error));
  const full = await sui().getTransaction({
    digest: result.Transaction.digest,
    include: { events: true, effects: true },
  });
  if (full.$kind !== "Transaction") throw new Error(explain(full.FailedTransaction.status.error));
  return receiptFrom(full.Transaction, result.Transaction.digest);
}
