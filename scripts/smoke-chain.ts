import { readFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { blake2b } from "@noble/hashes/blake2.js";
import deployed from "../src/lib/sui/deployed.json";

const client = new SuiGrpcClient({
  network: "devnet",
  baseUrl: "https://fullnode.devnet.sui.io:443",
});

function fail(error: unknown): never {
  throw new Error(typeof error === "string" ? error : JSON.stringify(error));
}

async function execute(signer: Ed25519Keypair, tx: Transaction) {
  tx.setSender(signer.toSuiAddress());
  const result = await signer.signAndExecuteTransaction({
    transaction: tx,
    client,
    include: { effects: true, events: true, balanceChanges: true },
  });
  if (result.$kind !== "Transaction") fail(result.FailedTransaction.status.error);
  if (!result.Transaction.status.success) fail(result.Transaction.status.error);
  return result.Transaction;
}

async function main() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
  const sponsor = Ed25519Keypair.fromSecretKey(env.SPONSOR_SECRET_KEY);
  const payer = new Ed25519Keypair();
  const payee = new Ed25519Keypair();
  console.log("payer", payer.toSuiAddress());
  console.log("payee", payee.toSuiAddress());

  const fund = new Transaction();
  fund.transferObjects(
    [coinWithBalance({ balance: 200_000_000n })],
    payer.toSuiAddress(),
  );
  fund.moveCall({
    target: `${deployed.packageId}::usdc::drip`,
    arguments: [
      fund.object(deployed.mintHubId),
      fund.pure.address(payer.toSuiAddress()),
      fund.pure.u64(20_000_000),
    ],
  });
  const funded = await execute(sponsor, fund);
  console.log("funded", funded.digest);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const ready = await client.getBalance({
      owner: payer.toSuiAddress(),
      coinType: deployed.usdcType,
    });
    if (BigInt(ready.balance.coinBalance) >= 2_000_000n) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const secret = new TextEncoder().encode("open-sesame");
  const claimHash = blake2b(secret, { dkLen: 32 });
  const create = new Transaction();
  create.moveCall({
    target: `${deployed.packageId}::intent::create`,
    typeArguments: [deployed.usdcType],
    arguments: [
      coinWithBalance({ type: deployed.usdcType, balance: 2_000_000n }),
      create.pure.string("Mark"),
      create.pure.string("lunch"),
      create.pure.u64(Date.now() + 60 * 60 * 1000),
      create.pure.vector("u8", claimHash),
      create.object.clock(),
    ],
  });
  const created = await execute(payer, create);
  const createdEvent = created.events?.find((event) => event.eventType.endsWith("::IntentCreated"));
  const intentId = String(createdEvent?.json?.intent_id ?? "");
  console.log("intent", intentId, created.digest);
  if (!intentId) fail(created.events);

  const accept = new Transaction();
  accept.moveCall({
    target: `${deployed.packageId}::intent::accept`,
    typeArguments: [deployed.usdcType],
    arguments: [
      accept.object(intentId),
      accept.pure.vector("u8", secret),
      accept.pure.address(payee.toSuiAddress()),
      accept.object.clock(),
    ],
  });
  accept.transferObjects(
    [coinWithBalance({ balance: 100_000_000n })],
    payee.toSuiAddress(),
  );
  const accepted = await execute(sponsor, accept);
  console.log("accepted", accepted.digest);

  const { balance } = await client.getBalance({
    owner: payee.toSuiAddress(),
    coinType: deployed.usdcType,
  });
  const gas = await client.getBalance({ owner: payee.toSuiAddress() });
  console.log("payee usdc", balance.balance, "sui", gas.balance.balance);
  if (balance.balance !== "2000000") fail(`unexpected usdc ${balance.balance}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
