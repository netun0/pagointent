import { proverUrl, saltServiceUrl } from "@/lib/zklogin/config";
import type { NetworkName } from "@/lib/sui/types";

export type ZkLoginProofPayload = {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
};

export async function fetchUserSalt(jwt: string) {
  const response = await fetch(saltServiceUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: jwt }),
  });
  const data = (await response.json()) as { salt?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "Salt service rejected the request.");
  if (!data.salt) throw new Error("Salt service returned no salt.");
  return data.salt;
}

export async function fetchZkProof(
  network: Exclude<NetworkName, "local">,
  body: {
    jwt: string;
    extendedEphemeralPublicKey: string;
    maxEpoch: number;
    jwtRandomness: string;
    salt: string;
    keyClaimName: "sub";
  },
): Promise<ZkLoginProofPayload> {
  const response = await fetch(proverUrl(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt: body.jwt,
      extendedEphemeralPublicKey: body.extendedEphemeralPublicKey,
      maxEpoch: String(body.maxEpoch),
      jwtRandomness: body.jwtRandomness,
      salt: body.salt,
      keyClaimName: body.keyClaimName,
    }),
  });
  const data = (await response.json()) as ZkLoginProofPayload & { error?: string; message?: string };
  if (!response.ok) throw new Error(data.error || data.message || "Prover rejected the request.");
  if (!data.proofPoints || !data.headerBase64) throw new Error("Prover returned an incomplete proof.");
  return data;
}
