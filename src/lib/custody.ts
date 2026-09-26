import { useSyncExternalStore } from "react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const PAYER_KEY = "intenses.payer";
const VAULT_KEY = "intenses.vault";
const SECRETS_KEY = "intenses.secrets";
const LESSONS_KEY = "intenses.lessons";
const ITERATIONS = 120_000;

export type VaultFile = {
  version: 1;
  address: string;
  salt: string;
  iv: string;
  cipher: string;
  iterations: number;
};

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

function emit() {
  listeners.forEach((listener) => listener());
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

export function readPayerSecret() {
  return localStorage.getItem(PAYER_KEY);
}

export function writePayerSecret(secret: string) {
  localStorage.setItem(PAYER_KEY, secret);
  payerSecretCache = undefined;
  emit();
}

let payerSecretCache: string | null | undefined;
let payerSnapshot: { secret: string; address: string; keypair: Ed25519Keypair } | null = null;

function readPayer() {
  const secret = localStorage.getItem(PAYER_KEY);
  if (secret === payerSecretCache) return payerSnapshot;
  payerSecretCache = secret;
  if (!secret) {
    payerSnapshot = null;
    return null;
  }
  const keypair = Ed25519Keypair.fromSecretKey(secret);
  payerSnapshot = { secret, address: keypair.toSuiAddress(), keypair };
  return payerSnapshot;
}

export function usePayer() {
  return useSyncExternalStore(subscribe, readPayer, () => null);
}

export function useVault() {
  return useSyncExternalStore(subscribe, readVault, () => null);
}

let lessonRaw = "";
let lessonSnapshot: string[] = [];

function readLessonSnapshot() {
  const raw = localStorage.getItem(LESSONS_KEY) ?? "[]";
  if (raw === lessonRaw) return lessonSnapshot;
  lessonRaw = raw;
  lessonSnapshot = JSON.parse(raw) as string[];
  return lessonSnapshot;
}

export function useLessons() {
  return useSyncExternalStore(subscribe, readLessonSnapshot, () => lessonSnapshot);
}

export function useOrigin() {
  return useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
}

export function payerFromStorage() {
  const secret = readPayerSecret();
  if (!secret) return null;
  const keypair = Ed25519Keypair.fromSecretKey(secret);
  return { secret, address: keypair.toSuiAddress(), keypair };
}

export function rememberClaim(intentId: string, secretHex: string) {
  const current = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? "{}") as Record<string, string>;
  current[intentId] = secretHex;
  localStorage.setItem(SECRETS_KEY, JSON.stringify(current));
  emit();
}

export function useClaim(intentId: string) {
  return useSyncExternalStore(subscribe, () => recallClaim(intentId), () => null);
}

export function recallClaim(intentId: string) {
  const current = JSON.parse(localStorage.getItem(SECRETS_KEY) ?? "{}") as Record<string, string>;
  return current[intentId] ?? null;
}

export function readLessons() {
  return JSON.parse(localStorage.getItem(LESSONS_KEY) ?? "[]") as string[];
}

export function writeLessons(ids: string[]) {
  localStorage.setItem(LESSONS_KEY, JSON.stringify(ids));
  lessonRaw = "";
  emit();
}
