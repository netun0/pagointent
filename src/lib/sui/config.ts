import { readFileSync } from "node:fs";
import path from "node:path";
import type { NetworkName } from "@/lib/sui/types";

export type Deployment = {
  network: "devnet" | "testnet";
  packageId: string;
  mintHubId: string;
  badgeRegistryId: string;
  usdcType: string;
  upgradeCapId: string;
  sponsorAddress: string;
  publishDigest: string;
};

const empty: Deployment = {
  network: "devnet",
  packageId: "",
  mintHubId: "",
  badgeRegistryId: "",
  usdcType: "",
  upgradeCapId: "",
  sponsorAddress: "",
  publishDigest: "",
};

export function deployment(): Deployment {
  try {
    const file = path.join(process.cwd(), "src/lib/sui/deployed.json");
    return { ...empty, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return empty;
  }
}

export function chainMode(): NetworkName {
  if (!deployment().packageId || !process.env.SPONSOR_SECRET_KEY) return "local";
  return deployment().network;
}

export function rpcUrl(network: Deployment["network"]) {
  return network === "devnet"
    ? "https://fullnode.devnet.sui.io:443"
    : "https://fullnode.testnet.sui.io:443";
}
