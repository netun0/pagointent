import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { BalanceSnapshot, ChainStatus, Desk, ObligationRecord, TxReceipt } from "@/lib/sui/types";

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

function fromBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

type Mutation = Record<string, unknown> & { action: string };

async function mutate(body: Mutation, secret?: string): Promise<TxReceipt> {
  const status = await getStatus();
  if (status.mode === "local") return request<TxReceipt>("POST", "", { op: "act", ...body });
  if (!secret || !("sender" in body)) throw new Error("Unlock the key that should sign this.");
  const built = await request<{ bytes: string }>("POST", "", { op: "build", ...body });
  const signed = await Ed25519Keypair.fromSecretKey(secret).signTransaction(fromBase64(built.bytes));
  return request<TxReceipt>("POST", "", { op: "submit", bytes: built.bytes, signature: signed.signature });
}

async function sponsored(body: Mutation, secret: string): Promise<TxReceipt> {
  const status = await getStatus();
  if (status.mode === "local") return request<TxReceipt>("POST", "", { op: "act", ...body });
  const built = await request<{ bytes: string }>("POST", "", { op: "prepare", ...body });
  const signed = await Ed25519Keypair.fromSecretKey(secret).signTransaction(fromBase64(built.bytes));
  return request<TxReceipt>("POST", "", { op: "cosign", bytes: built.bytes, signature: signed.signature });
}

export function getStatus() {
  return request<ChainStatus>("GET", "?op=status");
}

export function getBalances(owner: string) {
  return request<BalanceSnapshot>("GET", `?op=balance&owner=${owner}`);
}

export function listObligations() {
  return request<{ obligations: ObligationRecord[] }>("GET", "?op=obligations");
}

export function getObligation(id: string) {
  return request<{ obligation: ObligationRecord | null }>("GET", `?op=obligation&id=${id}`);
}

export function listDesks() {
  return request<{ desks: Desk[]; verified: string[] }>("GET", "?op=desks");
}

export function fundAddress(address: string) {
  return request<BalanceSnapshot>("POST", "", { op: "bootstrap", address });
}

export function createObligation(input: {
  secret: string;
  service: string;
  maxQuote: string;
  requireVerified: boolean;
  requireProof: boolean;
  expiresAtMs: number;
}) {
  const sender = Ed25519Keypair.fromSecretKey(input.secret).toSuiAddress();
  return mutate(
    {
      action: "create",
      sender,
      service: input.service,
      maxQuote: input.maxQuote,
      requireVerified: input.requireVerified,
      requireProof: input.requireProof,
      expiresAtMs: input.expiresAtMs,
    },
    input.secret,
  );
}

export function cancelObligation(secret: string, obligationId: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return mutate({ action: "cancel", sender, obligationId }, secret);
}

export function reclaimObligation(secret: string, obligationId: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return mutate({ action: "reclaim", sender, obligationId }, secret);
}

export function releaseObligation(secret: string, obligationId: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return mutate({ action: "release", sender, obligationId }, secret);
}

export function revisePrice(secret: string, obligationId: string, quote: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return mutate({ action: "revise", sender, obligationId, quote }, secret);
}

export function redirectPayment(secret: string, obligationId: string, destination: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return mutate({ action: "redirect", sender, obligationId, destination }, secret);
}

export function contactDesk(obligationId: string, merchant: string, merchantName: string, quote: string) {
  return request<TxReceipt>("POST", "", { op: "agent", action: "contact", obligationId, merchant, merchantName, quote });
}

export function submitDeskProof(obligationId: string, merchant: string, proof: string) {
  return request<TxReceipt>("POST", "", { op: "agent", action: "prove", obligationId, merchant, proof });
}

export function merchantAccept(secret: string, obligationId: string, quote: string, merchantName: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return sponsored({ action: "accept", sender, obligationId, quote, merchantName }, secret);
}

export function merchantProof(secret: string, obligationId: string, proof: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return sponsored({ action: "proof", sender, obligationId, proof }, secret);
}

export function merchantDecline(secret: string, obligationId: string) {
  const sender = Ed25519Keypair.fromSecretKey(secret).toSuiAddress();
  return sponsored({ action: "decline", sender, obligationId }, secret);
}

export function verifyDesk(merchant: string, merchantName: string) {
  return request<TxReceipt>("POST", "", { op: "verify", merchant, merchantName });
}
