/// Testnet stand-in for native USDC. Not issued by Circle.
/// On mainnet, intents escrow `0x...::usdc::USDC` from Circle instead of this type.
module intenses::usdc;

use std::string::{Self, String};
use sui::coin::{Self, TreasuryCap};
use sui::coin_registry;

const MAX_DRIP: u64 = 100_000_000;
const ELimit: u64 = 0;

public struct USDC has drop {}

/// Shared mint counter for the hackathon demo. Each call caps at 100 test USDC.
public struct MintHub has key {
    id: UID,
    cap: TreasuryCap<USDC>,
}

fun init(otw: USDC, ctx: &mut TxContext) {
    let (mut initializer, treasury_cap) = coin_registry::new_currency_with_otw<USDC>(
        otw,
        6,
        string::utf8(b"USDC"),
        string::utf8(b"Intenses Test USD"),
        string::utf8(b"Testnet stand-in for native USDC on Sui. Not issued by Circle."),
        string::utf8(b"https://cryptologos.cc/logos/usd-coin-usdc-logo.png"),
        ctx,
    );
    let metadata_cap = initializer.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::share_object(MintHub {
        id: object::new(ctx),
        cap: treasury_cap,
    });
}

public fun drip(hub: &mut MintHub, recipient: address, amount: u64, ctx: &mut TxContext) {
    assert!(amount > 0 && amount <= MAX_DRIP, ELimit);
    let minted = coin::mint(&mut hub.cap, amount, ctx);
    transfer::public_transfer(minted, recipient);
}

#[test_only]
public fun init_for_test(ctx: &mut TxContext) {
    init(USDC {}, ctx);
}
