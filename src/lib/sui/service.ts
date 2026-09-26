import { readFileSync } from "node:fs";
import path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { chainMode, deployment } from "@/lib/sui/config";
import { sui } from "@/lib/sui/client";
import { quoteToMicro } from "@/lib/sui/format";
import {
  localAccept,
  localBalances,
  localBootstrap,
  localCancel,
  localContact,
  localCreate,
  localDecline,
  localObligation,
  localObligations,
  localProof,
  localProve,
  localReclaim,
  localRedirect,
  localRelease,
  localRevise,
  localDesks,
  localVerify,
} from "@/lib/sui/local-ledger";
import {
  RATE_DEN,
  RATE_NUM,
  type BalanceSnapshot,
  type ChainStatus,
  type Desk,
  type ObligationRecord,
  type TxReceipt,
} from "@/lib/sui/types";

const secretPath = path.join(process.cwd(), "data", "merchant-secrets.json");

function aborted(raw: string, code: number) {
  return new RegExp(`abort code: ${code}\\b`).test(raw) || raw.includes(`, ${code})`);
}

function explain(error: unknown) {
  const raw = typeof error === "string" ? error : error instanceof Error ? error.message : JSON.stringify(error);
  if (!raw) return "The transaction failed.";
  if (raw.includes("EUnverified") || aborted(raw, 8)) return "That merchant is not on the verification registry.";
  if (raw.includes("EPriceChanged") || aborted(raw, 13)) return "The price was frozen at acceptance. There is no instruction that changes it.";
  if (raw.includes("ENoProof") || aborted(raw, 10)) return "Proof of delivery is still missing.";
  if (raw.includes("EDestination") || aborted(raw, 9)) return "The destination was bound at acceptance. There is no instruction that retargets it.";
  if (raw.includes("EPrice") || aborted(raw, 7)) return "That price is above the cap.";
  if (raw.includes("ENotExpired") || aborted(raw, 6)) return "This obligation has not expired yet.";
  if (raw.includes("EExpired") || aborted(raw, 5)) return "This obligation has passed its date.";
  if (raw.includes("ENotAccepted") || aborted(raw, 4)) return "This obligation is not accepted.";
  if (raw.includes("ENotOffered") || aborted(raw, 3)) return "This obligation is no longer open.";
  if (raw.includes("ENotMerchant") || aborted(raw, 12)) return "Only the bound merchant can do that.";
  if (raw.includes("ENotPayer") || aborted(raw, 11)) return "Only the payer can cancel this obligation.";
  if (raw.includes("EClosed") || aborted(raw, 14)) return "This obligation is already closed.";
  if (raw.includes("EAmount") || raw.includes("Insufficient")) return "The wallet does not have the right amount of test USDC.";
  if (raw.includes("ELimit")) return "The faucet allows at most 100 test USDC per call.";
  return raw.length > 360 ? `${raw.slice(0, 360)}…` : raw;
}

function sponsor() {
  const secret = process.env.SPONSOR_SECRET_KEY;
  if (!secret) throw new Error("This server has no sponsor key. Run npm run chain:setup.");
  return Ed25519Keypair.fromSecretKey(secret);
}

function merchantSecrets(): Record<string, string> {
  const fromEnv = process.env.MERCHANT_SECRETS_JSON;
  if (fromEnv) {
    const parsed = JSON.parse(fromEnv) as Record<string, string>;
    if (parsed && typeof parsed === "object") return parsed;
  }
  return JSON.parse(readFileSync(secretPath, "utf8")) as Record<string, string>;
}

function merchantKeyFor(address: string) {
  const wanted = address.toLowerCase();
  let secrets: Record<string, string>;
  try {
    secrets = merchantSecrets();
  } catch {
    return null;
  }
  for (const secret of Object.values(secrets)) {
    try {
      const key = Ed25519Keypair.fromSecretKey(secret);
      if (key.toSuiAddress().toLowerCase() === wanted) return key;
    } catch {
      // Skip a secret this process cannot parse.
    }
  }
  return null;
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

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function asBool(value: unknown) {
  return value === true || value === "true";
}

function isZero(address: string) {
  return !address || /^0x0+$/.test(address.toLowerCase());
}

function parseObligation(id: string, json: Record<string, unknown>): ObligationRecord {
  const escrow = json.escrow;
  const escrowValue =
    escrow && typeof escrow === "object" && "value" in escrow ? asString((escrow as { value: unknown }).value) : asString(escrow);
  return {
    id,
    payer: asString(json.payer),
    service: asString(json.service),
    currency: asString(json.currency) || "JPY",
    maxQuote: asString(json.max_quote),
    acceptedQuote: asString(json.accepted_quote) || "0",
    rateNum: asString(json.rate_num) || RATE_NUM.toString(),
    rateDen: asString(json.rate_den) || RATE_DEN.toString(),
    requireVerified: asBool(json.require_verified),
    requireProof: asBool(json.require_proof),
    merchant: asString(json.merchant),
    merchantName: asString(json.merchant_name),
    destination: asString(json.destination),
    proof: asString(json.proof),
    expiresAtMs: Number(json.expires_at_ms ?? 0),
    status: Number(json.status ?? 0),
    outcome: asString(json.outcome),
    escrow: escrowValue,
  };
}

async function objects(ids: string[]) {
  if (ids.length === 0) return [];
  const response = await sui().getObjects({ objectIds: ids, include: { json: true } });
  return response.objects;
}

async function events(eventType: string) {
  const page = await sui().listEvents({ filter: { eventType }, limit: 50, order: "descending" });
  return page.events;
}

async function settle(signer: Ed25519Keypair, tx: Transaction) {
  tx.setSender(signer.toSuiAddress());
  const bytes = await tx.build({ client: sui() });
  const signed = await signer.signTransaction(bytes);
  return execute(bytes, [signed.signature]);
}

async function execute(transaction: Uint8Array, signatures: string[]) {
  const result = await sui().executeTransaction({
    transaction,
    signatures,
    include: { effects: true },
  });
  if (result.$kind !== "Transaction") throw new Error(explain(result.FailedTransaction.status.error));
  if (!result.Transaction.status.success) throw new Error(explain(result.Transaction.status.error));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const full = await sui().getTransaction({
        digest: result.Transaction.digest,
        include: { effects: true, events: true },
      });
      if (full.$kind === "Transaction") return full.Transaction;
    } catch (error) {
      if (attempt === 11) throw new Error(explain(error));
    }
    await sleep(1000);
  }
  throw new Error("The transaction was submitted, but the fullnode has not indexed it yet.");
}

function receiptFrom(tx: { digest: string; events?: { eventType: string; json: Record<string, unknown> | null }[] }): TxReceipt {
  const created = tx.events?.find((event) => event.eventType.endsWith("::ObligationCreated"))?.json;
  return { digest: tx.digest, obligationId: created ? asString(created.obligation_id) : undefined };
}

export async function getStatus(): Promise<ChainStatus> {
  const deployed = deployment();
  if (chainMode() === "local") {
    return {
      mode: "local",
      packageId: null,
      usdcType: null,
      merchantRegistryId: null,
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
    merchantRegistryId: deployed.merchantRegistryId,
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

export async function listObligations(): Promise<ObligationRecord[]> {
  if (chainMode() === "local") return localObligations();
  const deployed = deployment();
  const created = await events(`${deployed.packageId}::obligation::ObligationCreated`);
  const ids = created.map((event) => asString(event.json?.obligation_id)).filter(Boolean);
  const fetched = await objects(ids);
  return fetched.flatMap((object) => {
    if (object instanceof Error || !object.json) return [];
    return [parseObligation(object.objectId, object.json)];
  });
}

export async function getObligation(id: string): Promise<ObligationRecord | null> {
  if (chainMode() === "local") return localObligation(id);
  try {
    const response = await sui().getObject({ objectId: id, include: { json: true } });
    if (!response.object.json || !response.object.type?.includes("::obligation::Obligation")) return null;
    return parseObligation(response.object.objectId, response.object.json);
  } catch {
    return null;
  }
}

function desksFromRegistry(names: Map<string, string>): Desk[] {
  return [...names.entries()].map(([address, name]) => ({
    id: address,
    name: name || "Verified merchant",
    address,
    verified: true,
    reachable: Boolean(merchantKeyFor(address)),
  }));
}

export async function listDesks(): Promise<{ desks: Desk[]; verified: string[] }> {
  if (chainMode() === "local") {
    const desks = await localDesks();
    return { desks, verified: desks.map((desk) => desk.address) };
  }
  try {
    const verifiedEvents = await events(`${deployment().packageId}::merchant::MerchantVerified`);
    const names = new Map<string, string>();
    for (const event of [...verifiedEvents].reverse()) {
      const address = asString(event.json?.merchant).toLowerCase();
      const name = asString(event.json?.name);
      if (address && !isZero(address)) names.set(address, name || names.get(address) || "Verified merchant");
    }
    const desks = desksFromRegistry(names);
    return { desks, verified: desks.map((desk) => desk.address) };
  } catch {
    return { desks: [], verified: [] };
  }
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
  if (BigInt(mid.usdc) < 25_000_000n) {
    const tx = new Transaction();
    tx.moveCall({
      target: `${deployed.packageId}::usdc::drip`,
      arguments: [tx.object(deployed.mintHubId), tx.pure.address(address), tx.pure.u64(60_000_000)],
    });
    await settle(key, tx);
    await waitForCoin(address, deployed.usdcType, 20_000_000n);
  }
  return getBalances(address);
}

type BuildInput =
  | { action: "create"; sender: string; service: string; maxQuote: string; requireVerified: boolean; requireProof: boolean; expiresAtMs: number }
  | { action: "cancel"; sender: string; obligationId: string }
  | { action: "reclaim"; sender: string; obligationId: string }
  | { action: "release"; sender: string; obligationId: string }
  | { action: "revise"; sender: string; obligationId: string; quote: string }
  | { action: "redirect"; sender: string; obligationId: string; destination: string }
  | { action: "accept"; sender: string; obligationId: string; quote: string; merchantName: string }
  | { action: "proof"; sender: string; obligationId: string; proof: string }
  | { action: "decline"; sender: string; obligationId: string }
  | { action: "verify"; sender: string; merchant: string; merchantName: string }
  | { action: "contact"; obligationId: string; merchant: string; merchantName: string; quote: string }
  | { action: "prove"; obligationId: string; merchant: string; proof: string };

function assertText(value: string, label: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`${label} needs 1–${max} characters.`);
  return trimmed;
}

export async function act(input: BuildInput): Promise<TxReceipt> {
  if (chainMode() !== "local") throw new Error("This network needs a signature. Build the transaction first.");
  if (input.action === "create") return localCreate(input);
  if (input.action === "cancel") return localCancel(input);
  if (input.action === "reclaim") return localReclaim(input);
  if (input.action === "release") return localRelease(input);
  if (input.action === "revise") return localRevise();
  if (input.action === "redirect") return localRedirect();
  if (input.action === "accept") return localAccept(input);
  if (input.action === "proof") return localProof(input);
  if (input.action === "decline") return localDecline(input);
  if (input.action === "verify") return localVerify(input.merchant, input.merchantName);
  if (input.action === "contact") return localContact(input);
  return localProve(input);
}

export async function buildTransaction(input: BuildInput) {
  if (chainMode() === "local") throw new Error("Preview mode does not build chain transactions.");
  if (!("sender" in input)) throw new Error("This action is signed on the server.");
  const deployed = deployment();
  const tx = new Transaction();
  tx.setSender(input.sender);
  const usdc = deployed.usdcType;
  const registry = tx.object(deployed.merchantRegistryId);
  if (input.action === "create") {
    const service = assertText(input.service, "Service", 180);
    const quote = BigInt(input.maxQuote);
    const escrow = quoteToMicro(quote);
    if (escrow <= 0n) throw new Error("Amount must be a whole number of yen, up to ¥1,000,000.");
    tx.moveCall({
      target: `${deployed.packageId}::obligation::create`,
      typeArguments: [usdc],
      arguments: [
        coinWithBalance({ type: usdc, balance: escrow }),
        tx.pure.string(service),
        tx.pure.string("JPY"),
        tx.pure.u64(quote),
        tx.pure.u64(RATE_NUM),
        tx.pure.u64(RATE_DEN),
        tx.pure.bool(input.requireVerified),
        tx.pure.bool(input.requireProof),
        tx.pure.u64(input.expiresAtMs),
        tx.object.clock(),
      ],
    });
  } else if (input.action === "cancel") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::cancel`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId)],
    });
  } else if (input.action === "reclaim") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::reclaim`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId), tx.object.clock()],
    });
  } else if (input.action === "release") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::release`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId), registry, tx.object.clock()],
    });
  } else if (input.action === "revise") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::revise_price`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId), tx.pure.u64(BigInt(input.quote))],
    });
  } else if (input.action === "redirect") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::redirect`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId), tx.pure.address(input.destination)],
    });
  } else {
    throw new Error("That action is sponsored from the merchant side.");
  }
  return transactionBytes(tx);
}

async function transactionBytes(tx: Transaction) {
  try {
    const bytes = await tx.build({ client: sui() });
    return { bytes: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    throw new Error(explain(error));
  }
}

async function prepareMerchant(input: Extract<BuildInput, { action: "accept" | "proof" | "decline" }>) {
  const deployed = deployment();
  const tx = new Transaction();
  tx.setSender(input.sender);
  tx.setGasOwner(sponsor().toSuiAddress());
  const usdc = deployed.usdcType;
  if (input.action === "accept") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::accept`,
      typeArguments: [usdc],
      arguments: [
        tx.object(input.obligationId),
        tx.object(deployed.merchantRegistryId),
        tx.pure.u64(BigInt(input.quote)),
        tx.pure.string(assertText(input.merchantName, "Name", 48)),
        tx.object.clock(),
      ],
    });
  } else if (input.action === "proof") {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::submit_proof`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId), tx.pure.string(assertText(input.proof, "Proof", 180))],
    });
  } else {
    tx.moveCall({
      target: `${deployed.packageId}::obligation::decline`,
      typeArguments: [usdc],
      arguments: [tx.object(input.obligationId)],
    });
  }
  return transactionBytes(tx);
}

export async function prepareSponsored(input: BuildInput) {
  if (chainMode() === "local") throw new Error("Preview mode does not build chain transactions.");
  if (input.action !== "accept" && input.action !== "proof" && input.action !== "decline") {
    throw new Error("That action is not sponsored.");
  }
  return prepareMerchant(input);
}

export async function cosign(bytes: string, signature: string) {
  const transaction = Uint8Array.from(Buffer.from(bytes, "base64"));
  const sponsorSig = await sponsor().signTransaction(transaction);
  const done = await execute(transaction, [signature, sponsorSig.signature]);
  return receiptFrom(done);
}

export async function submitTransaction(bytes: string, signature: string) {
  const transaction = Uint8Array.from(Buffer.from(bytes, "base64"));
  const done = await execute(transaction, [signature]);
  return receiptFrom(done);
}

export async function verifyMerchant(merchant: string, merchantName: string) {
  if (chainMode() === "local") return localVerify(merchant, merchantName);
  const deployed = deployment();
  const tx = new Transaction();
  tx.moveCall({
    target: `${deployed.packageId}::merchant::verify`,
    arguments: [tx.object(deployed.merchantRegistryId), tx.pure.address(merchant), tx.pure.string(assertText(merchantName, "Name", 48))],
  });
  const done = await settle(sponsor(), tx);
  return receiptFrom(done);
}

export async function agentAct(input: Extract<BuildInput, { action: "contact" | "prove" }>) {
  if (chainMode() === "local") return act(input);
  const key = merchantKeyFor(input.merchant);
  if (!key) throw new Error("The registry found this merchant. They sign the acceptance from their own desk.");
  const prepared =
    input.action === "contact"
      ? await prepareMerchant({
          action: "accept",
          sender: key.toSuiAddress(),
          obligationId: input.obligationId,
          quote: input.quote,
          merchantName: input.merchantName,
        })
      : await prepareMerchant({
          action: "proof",
          sender: key.toSuiAddress(),
          obligationId: input.obligationId,
          proof: input.proof,
        });
  const transaction = Uint8Array.from(Buffer.from(prepared.bytes, "base64"));
  const signed = await key.signTransaction(transaction);
  return cosign(prepared.bytes, signed.signature);
}
