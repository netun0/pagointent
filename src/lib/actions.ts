import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bytesToHex, hashSecret, hexToBytes, randomSecret } from "@/lib/sui/hash";
import type { BalanceSnapshot, ChainStatus, IntentRecord, ListingRecord, TxReceipt } from "@/lib/sui/types";

async function request<T>(method: "GET" | "POST", query: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/chain${query}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function getStatus() {
  return request<ChainStatus>("GET", "?op=status");
}

export function getBalances(owner: string) {
  return request<BalanceSnapshot>("GET", `?op=balance&owner=${owner}`);
}

export function listIntents() {
  return request<{ intents: IntentRecord[] }>("GET", "?op=intents");
}

export function getIntent(id: string) {
  return request<{ intent: IntentRecord | null }>("GET", `?op=intent&id=${id}`);
}

export function listListings() {
  return request<{ listings: ListingRecord[] }>("GET", "?op=listings");
}

export function listActivity(owner: string) {
  return request<{ activity: { id: string; at: number; summary: string; digest?: string }[] }>(
    "GET",
    `?op=activity&owner=${owner}`,
  );
}

export function fundAddress(address: string) {
  return request<BalanceSnapshot>("POST", "", { op: "bootstrap", address });
}

export function acceptPayment(input: { intentId: string; secretHex: string; payee: string }) {
  return request<TxReceipt>("POST", "", { op: "accept", ...input });
}

type Mutation = Record<string, unknown> & { action: string; sender: string };

async function mutate(body: Mutation, secret?: string): Promise<TxReceipt> {
  const status = await getStatus();
  if (status.mode === "local") return request<TxReceipt>("POST", "", { op: "act", ...body });
  if (!secret) throw new Error("Unlock the wallet that should sign this.");
  const built = await request<{ bytes: string }>("POST", "", { op: "build", ...body });
  const signed = await Ed25519Keypair.fromSecretKey(secret).signTransaction(fromBase64(built.bytes));
  return request<TxReceipt>("POST", "", { op: "submit", bytes: built.bytes, signature: signed.signature });
}

function fromBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function createIntent(input: {
  secret: string;
  payeeName: string;
  purpose: string;
  amount: string;
  expiresAtMs: number;
}) {
  const claimSecret = randomSecret();
  const claimHashHex = bytesToHex(hashSecret(claimSecret));
  const sender = Ed25519Keypair.fromSecretKey(input.secret).toSuiAddress();
  return mutate(
    {
      action: "create",
      sender,
      payeeName: input.payeeName,
      purpose: input.purpose,
      amount: input.amount,
      expiresAtMs: input.expiresAtMs,
      claimHashHex,
    },
    input.secret,
  ).then((receipt) => ({ ...receipt, claimSecretHex: bytesToHex(claimSecret) }));
}

export function cancelIntent(secret: string, intentId: string) {
  return mutate({ action: "cancel", sender: Ed25519Keypair.fromSecretKey(secret).toSuiAddress(), intentId }, secret);
}

export function reclaimIntent(secret: string, intentId: string) {
  return mutate({ action: "reclaim", sender: Ed25519Keypair.fromSecretKey(secret).toSuiAddress(), intentId }, secret);
}

export function buyListing(secret: string, listingId: string, price: string) {
  return mutate({ action: "buy", sender: Ed25519Keypair.fromSecretKey(secret).toSuiAddress(), listingId, price }, secret);
}

export function listItem(secret: string, title: string, detail: string, price: string) {
  return mutate(
    { action: "list", sender: Ed25519Keypair.fromSecretKey(secret).toSuiAddress(), title, detail, price },
    secret,
  );
}

export function mintBadge(secret: string) {
  return mutate({ action: "badge", sender: Ed25519Keypair.fromSecretKey(secret).toSuiAddress() }, secret);
}

export function secretBytes(hex: string) {
  return hexToBytes(hex);
}
