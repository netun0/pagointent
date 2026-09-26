import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Payer } from "@/lib/custody";
import { signTransactionBytes } from "@/lib/payer-sign";
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

async function mutate(body: Mutation, payer?: Payer): Promise<TxReceipt> {
  const status = await getStatus();
  if (status.mode === "local") return request<TxReceipt>("POST", "", { op: "act", ...body });
  if (!payer || !("sender" in body)) throw new Error("Unlock the key that should sign this.");
  if (status.mode !== "devnet" && status.mode !== "testnet") throw new Error("Unsupported network.");
  const built = await request<{ bytes: string }>("POST", "", { op: "build", ...body });
  const signed = await signTransactionBytes(payer, built.bytes, status.mode);
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
  payer: Payer;
  service: string;
  maxQuote: string;
  requireVerified: boolean;
  requireProof: boolean;
  expiresAtMs: number;
}) {
  return mutate(
    {
      action: "create",
      sender: input.payer.address,
      service: input.service,
      maxQuote: input.maxQuote,
      requireVerified: input.requireVerified,
      requireProof: input.requireProof,
      expiresAtMs: input.expiresAtMs,
    },
    input.payer,
  );
}

export function cancelObligation(payer: Payer, obligationId: string) {
  return mutate({ action: "cancel", sender: payer.address, obligationId }, payer);
}

export function reclaimObligation(payer: Payer, obligationId: string) {
  return mutate({ action: "reclaim", sender: payer.address, obligationId }, payer);
}

export function releaseObligation(payer: Payer, obligationId: string) {
  return mutate({ action: "release", sender: payer.address, obligationId }, payer);
}

export function revisePrice(payer: Payer, obligationId: string, quote: string) {
  return mutate({ action: "revise", sender: payer.address, obligationId, quote }, payer);
}

export function redirectPayment(payer: Payer, obligationId: string, destination: string) {
  return mutate({ action: "redirect", sender: payer.address, obligationId, destination }, payer);
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
