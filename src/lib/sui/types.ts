export type NetworkName = "local" | "devnet" | "testnet";

export type ChainStatus = {
  mode: NetworkName;
  packageId: string | null;
  usdcType: string | null;
  merchantRegistryId: string | null;
  sponsorAddress: string | null;
  sponsorReady: boolean;
  referenceGasPrice: string | null;
  publishDigest: string | null;
  rpcOk: boolean;
  rpcError: string | null;
};

export type ObligationRecord = {
  id: string;
  payer: string;
  service: string;
  currency: string;
  maxQuote: string;
  acceptedQuote: string;
  rateNum: string;
  rateDen: string;
  requireVerified: boolean;
  requireProof: boolean;
  merchant: string;
  merchantName: string;
  destination: string;
  proof: string;
  expiresAtMs: number;
  status: number;
  outcome: string;
  escrow: string;
};

export type Desk = {
  id: string;
  name: string;
  address: string;
  verified: boolean;
  reachable: boolean;
};

export type BalanceSnapshot = {
  sui: string;
  usdc: string;
};

export type TxReceipt = {
  digest: string;
  obligationId?: string;
};

export const OFFERED = 0;
export const ACCEPTED = 1;
export const RELEASED = 2;
export const RETURNED = 3;

export const RATE_NUM = 1_000_000n;
export const RATE_DEN = 150n;
