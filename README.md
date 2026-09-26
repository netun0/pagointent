# Intenses

Pay anyone in crypto, even if they don’t have a wallet. Intenses locks USDC in a Sui escrow, shows a QR code, and creates the payee’s wallet the moment they accept.

An intent reads like this: pay Mark up to $2 for lunch today, in USDC, if he accepts. Mark scans the code, sets a password, and the coins are already at a new Sui address. The private key is encrypted in the browser with that password. Gas for the accept transaction is sponsored, so he does not need SUI — or a wallet app — beforehand.

Built for the ETHGlobal Sui track.

## What is on chain

The Move package in `move/intenses` does four things:

- `usdc` — a 6-decimal test coin and a shared mint hub. On mainnet this would be native Circle USDC.
- `intent` — a shared escrow. Create locks the coin. Accept checks a Blake2b-256 claim secret from the QR and pays a new address. Cancel and expiry return the funds to the payer.
- `market` — flagship goods plus items a payee lists. Buying transfers the test USDC to the seller.
- `learn` — one non-transferable learner badge per address.

The app talks to Sui through `@mysten/sui`: gRPC reads (`getObject`, `getBalance`, `listEvents`, `getReferenceGasPrice`), sponsored transactions for the accept path, and user-signed transactions for create, buy, list, and the badge.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

If `src/lib/sui/deployed.json` has a package id and `SPONSOR_SECRET_KEY` is set, the app settles on that Sui network. Otherwise it uses a local preview ledger with the same rules, so the screens still work. On Vercel, add `SPONSOR_SECRET_KEY` to use the published package; leave it empty for the preview ledger.

## Publish the package

Install the [Sui CLI](https://docs.sui.io/getting-started/onboarding/sui-install), then:

```bash
npm run move:test
npm run move:build
SUI_NETWORK=devnet npm run chain:setup
```

`chain:setup` writes a sponsor key to `.env.local`, asks the faucet for SUI, publishes the package, and records the object ids. Use `SUI_NETWORK=testnet` when the testnet faucet is available. Restart `npm run dev` after setup so Next.js loads the new key.

The demo coin is not Circle USDC. Do not send real funds to these addresses.

## The flow

1. **Pay** creates a demo payer, funds it with SUI and test USDC, and locks an intent.
2. The QR encodes `/i/<id>?k=<secret>`. The secret is not stored on chain — only its hash.
3. **Scan / accept** generates an Ed25519 key, encrypts it with the payee’s password (PBKDF2 + AES-GCM), and the sponsor submits `intent::accept` plus a small SUI stipend.
4. **Learn** is five short lessons. Finishing them mints a badge the payee signs for.
5. **Market** sells the seeded partner goods and lets the payee list their own.

The encrypted backup (`intenses-wallet.json`) can be imported on another browser. The password is the only way to decrypt it.
