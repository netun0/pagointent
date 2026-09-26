"use client";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  decodeJwt,
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from "@mysten/sui/zklogin";
import { googleClientId, ZKLOGIN_EPOCH_VALIDITY } from "@/lib/zklogin/config";
import {
  clearZkLoginPending,
  clearZkLoginSession,
  readZkLoginPending,
  writeZkLoginPending,
  writeZkLoginSession,
  type ZkLoginSession,
} from "@/lib/zklogin/session";
import { getStatus } from "@/lib/actions";

export function zkLoginRedirectUri() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/zklogin/callback`;
}

export async function beginGoogleZkLogin() {
  const clientId = googleClientId();
  if (!clientId) throw new Error("Google zkLogin is not configured on this deployment.");

  const status = await getStatus();
  if (status.mode === "local" || !status.epoch) {
    throw new Error("Connect to Sui devnet or testnet before using zkLogin.");
  }

  const maxEpoch = Number(status.epoch) + ZKLOGIN_EPOCH_VALIDITY;
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

  writeZkLoginPending({
    ephemeralSecret: ephemeralKeyPair.getSecretKey(),
    maxEpoch,
    randomness: randomness.toString(),
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: zkLoginRedirectUri(),
    scope: "openid email profile",
    nonce,
  });

  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function completeGoogleZkLogin(idToken: string): Promise<ZkLoginSession> {
  const pending = readPendingOrThrow();
  const status = await getStatus();
  if (status.mode === "local") throw new Error("Sui is not available.");

  const saltResponse = await fetch("/api/zklogin/salt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwt: idToken }),
  });
  const saltBody = (await saltResponse.json()) as { salt?: string; error?: string };
  if (!saltResponse.ok || !saltBody.salt) throw new Error(saltBody.error || "Could not fetch zkLogin salt.");

  const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(pending.ephemeralSecret);
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());

  const proveResponse = await fetch("/api/zklogin/prove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt: idToken,
      extendedEphemeralPublicKey,
      maxEpoch: pending.maxEpoch,
      jwtRandomness: pending.randomness,
      salt: saltBody.salt,
    }),
  });
  const proofBody = (await proveResponse.json()) as {
    proofPoints?: ZkLoginSession["inputs"]["proofPoints"];
    issBase64Details?: ZkLoginSession["inputs"]["issBase64Details"];
    headerBase64?: string;
    error?: string;
  };
  if (!proveResponse.ok || !proofBody.proofPoints || !proofBody.issBase64Details || !proofBody.headerBase64) {
    throw new Error(proofBody.error || "Could not fetch zkLogin proof.");
  }

  const decoded = decodeJwt(idToken);
  const addressSeed = genAddressSeed(BigInt(saltBody.salt), "sub", decoded.sub, decoded.aud).toString();
  const address = jwtToAddress(idToken, saltBody.salt, false);

  const session: ZkLoginSession = {
    address,
    maxEpoch: pending.maxEpoch,
    ephemeralSecret: pending.ephemeralSecret,
    inputs: {
      proofPoints: proofBody.proofPoints,
      issBase64Details: proofBody.issBase64Details,
      headerBase64: proofBody.headerBase64,
      addressSeed,
    },
  };

  writeZkLoginSession(session);
  clearZkLoginPending();
  return session;
}

function readPendingOrThrow() {
  const pending = readZkLoginPending();
  if (!pending) throw new Error("The zkLogin session expired before Google returned. Try again.");
  return pending;
}

export function logoutZkLogin() {
  clearZkLoginPending();
  clearZkLoginSession();
}
