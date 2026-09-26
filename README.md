# PagoIntent

A programmable obligation layer for agentic commerce on Sui. PagoIntent decides what must be true before an autonomous agent is allowed to pay.

A user can say: buy this service for up to ¥3,000, only from a verified merchant, and only release the money when proof of delivery arrives. PagoIntent contacts a merchant, creates a Sui key for them if they do not have one, locks test USDC in a shared escrow, and releases it only when the predicate holds.

If the merchant changes the price, the payment is aimed at another address, delivery never arrives, or nobody accepts before the deadline, the funds are not released. They return to the payer.

## What is on chain

The Move package in `move/pago` does three things:

- `usdc` — a 6-decimal test coin and a shared mint hub. The obligation is denominated in yen. This coin is only the settlement asset, at a rate frozen on the object (¥150 = 1 test USDC). It is not Circle USDC.
- `merchant` — a shared verification registry. A verified merchant also receives a soulbound credential (`key`, not `store`).
- `obligation` — a shared escrow. `create` locks the cap. `accept` freezes the quote and binds the destination to the accepting address, and refuses an unverified merchant when required. `submit_proof` records delivery. `release` is permissionless and succeeds only when every condition holds, paying the bound address and refunding the unused cap. `revise_price` and `redirect` abort. Cancel, decline, and expiry return the escrow.

The app uses `@mysten/sui` gRPC. The payer signs lock, cancel, reclaim, and release. Merchant accept and proof are sponsored: the merchant is the sender, the sponsor pays gas, so a new desk does not need SUI.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

If `src/lib/sui/deployed.json` has a package id and a merchant registry, and `SPONSOR_SECRET_KEY` is set, the app settles on that Sui network. Otherwise it uses a local preview ledger with the same rules.

## Publish the package

Install the [Sui CLI](https://docs.sui.io/getting-started/onboarding/sui-install), then:

```bash
npm run move:test
npm run move:build
SUI_NETWORK=devnet npm run chain:setup
```

`chain:setup` publishes the package, verifies Harbor Bindery and Kanda Desk, leaves Night Window unverified, and writes their public addresses to `src/lib/sui/merchants.json`. Private keys stay in `.env.local` and `data/merchant-secrets.json`. Do not commit those. Restart `npm run dev` after setup.

Set `FORCE_PUBLISH=1` to publish again when a package is already recorded.

The demo coin is not Circle USDC. Do not send real funds to these addresses.
