import { blake2b } from "@noble/hashes/blake2.js";

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2 !== 0) {
    throw new Error("The claim code is not valid hex.");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

export function hashSecret(secret: Uint8Array) {
  return blake2b(secret, { dkLen: 32 });
}

export function randomSecret() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytes;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function claimHashToHex(value: unknown) {
  if (typeof value === "string") {
    if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
    try {
      const decoded = decodeBase64(value);
      if (decoded.length === 32) return bytesToHex(decoded);
    } catch {
      return "";
    }
  }
  if (Array.isArray(value) && value.length === 32) {
    return value.map((part) => Number(part).toString(16).padStart(2, "0")).join("");
  }
  return "";
}
