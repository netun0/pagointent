import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";

export const ZKLOGIN_PENDING_KEY = "pagointent.zklogin.pending";
export const ZKLOGIN_SESSION_KEY = "pagointent.zklogin.session";

export type ZkLoginPending = {
  ephemeralSecret: string;
  maxEpoch: number;
  randomness: string;
};

export type ZkLoginSession = {
  address: string;
  maxEpoch: number;
  ephemeralSecret: string;
  inputs: ZkLoginSignatureInputs;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function readZkLoginPending() {
  return readJson<ZkLoginPending>(ZKLOGIN_PENDING_KEY);
}

export function writeZkLoginPending(pending: ZkLoginPending) {
  writeJson(ZKLOGIN_PENDING_KEY, pending);
}

export function clearZkLoginPending() {
  sessionStorage.removeItem(ZKLOGIN_PENDING_KEY);
}

export function readZkLoginSession() {
  return readJson<ZkLoginSession>(ZKLOGIN_SESSION_KEY);
}

export function writeZkLoginSession(session: ZkLoginSession) {
  writeJson(ZKLOGIN_SESSION_KEY, session);
}

export function clearZkLoginSession() {
  sessionStorage.removeItem(ZKLOGIN_SESSION_KEY);
}
