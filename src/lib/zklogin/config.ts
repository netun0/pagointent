import type { NetworkName } from "@/lib/sui/types";

export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_ZKLOGIN_CLIENT_ID?.trim() || "";
}

export function zkLoginEnabled() {
  return googleClientId().length > 0;
}

export function proverUrl(network: Exclude<NetworkName, "local">) {
  const override = process.env.ZKLOGIN_PROVER_URL?.trim();
  if (override) return override;
  if (network === "devnet") return "https://prover-devnet.mystenlabs.com/v1";
  return "https://prover.testnet.sui.io/v1";
}

export function saltServiceUrl() {
  return process.env.ZKLOGIN_SALT_URL?.trim() || "https://salt.api.mystenlabs.com/get_salt";
}

export const ZKLOGIN_EPOCH_VALIDITY = 10;
