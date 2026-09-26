import { SuiGrpcClient } from "@mysten/sui/grpc";
import { deployment, rpcUrl } from "@/lib/sui/config";

let client: SuiGrpcClient | null = null;

export function sui() {
  if (!client) {
    const deployed = deployment();
    client = new SuiGrpcClient({
      network: deployed.network,
      baseUrl: rpcUrl(deployed.network),
    });
  }
  return client;
}
