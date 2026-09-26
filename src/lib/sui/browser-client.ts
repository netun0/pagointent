import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { NetworkName } from "@/lib/sui/types";

export function browserSuiClient(network: Exclude<NetworkName, "local">) {
  const baseUrl =
    network === "devnet" ? "https://fullnode.devnet.sui.io:443" : "https://fullnode.testnet.sui.io:443";
  return new SuiGrpcClient({ network, baseUrl });
}
