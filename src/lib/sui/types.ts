export type NetworkName = "local" | "devnet" | "testnet";

export type ChainStatus = {
  mode: NetworkName;
  packageId: string | null;
  usdcType: string | null;
  sponsorAddress: string | null;
  sponsorReady: boolean;
  referenceGasPrice: string | null;
  publishDigest: string | null;
  rpcOk: boolean;
  rpcError: string | null;
};

export type IntentRecord = {
  id: string;
  payer: string;
  payeeName: string;
  purpose: string;
  amount: string;
  expiresAtMs: number;
  status: number;
  payee: string;
};

export type ListingRecord = {
  id: string;
  seller: string;
  title: string;
  detail: string;
  price: string;
  kind: number;
  active: boolean;
};

export type ActivityRecord = {
  id: string;
  at: number;
  summary: string;
  digest?: string;
};

export type BalanceSnapshot = {
  sui: string;
  usdc: string;
};

export type TxReceipt = {
  digest: string;
  intentId?: string;
  listingId?: string;
  badgeId?: string;
  voucher?: string;
};

export const STATUS_PENDING = 0;
export const STATUS_ACCEPTED = 1;
export const STATUS_CANCELLED = 2;
export const STATUS_EXPIRED = 3;
