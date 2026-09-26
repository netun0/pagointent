import { useSyncExternalStore } from "react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { clearZkLoginSession, readZkLoginSession } from "@/lib/zklogin/session";
import type { ZkLoginSession } from "@/lib/zklogin/session";

const PAYER_KEY = "pagointent.payer";
const VAULT_KEY = "pagointent.vault";
const ITERATIONS = 120_000;

export type VaultFile = {
  version: 1;
  address: string;
  salt: string;
  iv: string;
  cipher: string;
  iterations: number;
};

export type Payer =
  | { kind: "ed25519"; secret: string; address: string; keypair: Ed25519Keypair }
  | { kind: "zklogin"; address: string; session: ZkLoginSession };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

function bufferOf(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(password: string, salt: Uint8Array, usages: KeyUsage[]) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: bufferOf(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function encryptKey(password: string, secret: string, address: string): Promise<VaultFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  return {
    version: 1,
    address,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipher)),
    iterations: ITERATIONS,
  };
}

export async function decryptKey(password: string, vault: VaultFile) {
  const key = await deriveKey(password, base64ToBytes(vault.salt), ["decrypt"]);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(vault.iv) },
      key,
      base64ToBytes(vault.cipher),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("That password does not open this wallet.");
  }
}

const listeners = new Set<() => void>();

export function emitCustodyChange() {
  payerSnapshotCache = undefined;
  listeners.forEach((listener) => listener());
}

function emit() {
  emitCustodyChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let vaultRaw: string | null | undefined;
let vaultSnapshot: VaultFile | null = null;

export function readVault(): VaultFile | null {
  const raw = localStorage.getItem(VAULT_KEY);
  if (raw === vaultRaw) return vaultSnapshot;
  vaultRaw = raw;
  vaultSnapshot = raw ? (JSON.parse(raw) as VaultFile) : null;
  return vaultSnapshot;
}

export function writeVault(vault: VaultFile) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  vaultRaw = undefined;
  emit();
}

export function forgetVault() {
  localStorage.removeItem(VAULT_KEY);
  vaultRaw = undefined;
  emit();
}

export function writePayerSecret(secret: string) {
  clearZkLoginSession();
  localStorage.setItem(PAYER_KEY, secret);
  emit();
}

export function forgetPayer() {
  localStorage.removeItem(PAYER_KEY);
  clearZkLoginSession();
  emit();
}

let payerSecretCache: string | null | undefined;
let payerSnapshotCache: Payer | null | undefined;

function readPayer(): Payer | null {
  const zk = readZkLoginSession();
  if (zk) {
    if (payerSnapshotCache?.kind === "zklogin" && payerSnapshotCache.address === zk.address) {
      return payerSnapshotCache;
    }
    payerSnapshotCache = { kind: "zklogin", address: zk.address, session: zk };
    return payerSnapshotCache;
  }

  const secret = localStorage.getItem(PAYER_KEY);
  if (secret === payerSecretCache && payerSnapshotCache?.kind === "ed25519") return payerSnapshotCache;
  payerSecretCache = secret;
  if (!secret) {
    payerSnapshotCache = null;
    return null;
  }
  const keypair = Ed25519Keypair.fromSecretKey(secret);
  payerSnapshotCache = { secret, address: keypair.toSuiAddress(), keypair, kind: "ed25519" };
  return payerSnapshotCache;
}

export function usePayer() {
  return useSyncExternalStore(subscribe, readPayer, () => null);
}

export function useVault() {
  return useSyncExternalStore(subscribe, readVault, () => null);
}

/** @deprecated use payer.kind === "ed25519" ? payer.secret : undefined */
export function payerEd25519Secret(payer: Payer | null) {
  return payer?.kind === "ed25519" ? payer.secret : undefined;
}
