"use client";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { ZkLoginSigner } from "@mysten/sui/zklogin";
import type { Payer } from "@/lib/custody";
import { browserSuiClient } from "@/lib/sui/browser-client";
import type { NetworkName } from "@/lib/sui/types";
import { getStatus } from "@/lib/actions";

function fromBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export async function signTransactionBytes(payer: Payer, bytesBase64: string, network: Exclude<NetworkName, "local">) {
  const bytes = fromBase64(bytesBase64);
  if (payer.kind === "ed25519") {
    return Ed25519Keypair.fromSecretKey(payer.secret).signTransaction(bytes);
  }

  const status = await getStatus();
  const epoch = status.epoch ? Number(status.epoch) : 0;
  if (epoch > payer.session.maxEpoch) {
    throw new Error("Your zkLogin session expired. Sign in with Google again.");
  }

  const client = browserSuiClient(network);
  const ephemeral = Ed25519Keypair.fromSecretKey(payer.session.ephemeralSecret);
  const signer = new ZkLoginSigner({
    ephemeralSigner: ephemeral,
    maxEpoch: payer.session.maxEpoch,
    inputs: payer.session.inputs,
    legacyAddress: false,
    address: payer.address,
    client,
  });
  return signer.signTransaction(bytes);
}
