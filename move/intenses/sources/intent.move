/// A payment intent locks a coin until the payee presents the claim secret
/// from the QR code, or until the payer cancels, or the expiry passes.
module intenses::intent;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::hash;

const STATUS_PENDING: u8 = 0;
const STATUS_ACCEPTED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;
const STATUS_EXPIRED: u8 = 3;

const EAmount: u64 = 0;
const EName: u64 = 1;
const EPurpose: u64 = 2;
const EHash: u64 = 3;
const EExpiry: u64 = 4;
const ENotPending: u64 = 5;
const EExpired: u64 = 6;
const ENotExpired: u64 = 7;
const EWrongSecret: u64 = 8;
const ENotPayer: u64 = 9;
const EPayee: u64 = 10;

const MAX_NAME: u64 = 48;
const MAX_PURPOSE: u64 = 180;
const YEAR_MS: u64 = 366 * 24 * 60 * 60 * 1000;

public struct Intent<phantom T> has key {
    id: UID,
    payer: address,
    payee_name: String,
    purpose: String,
    amount: u64,
    expires_at_ms: u64,
    claim_hash: vector<u8>,
    status: u8,
    payee: address,
    escrow: Balance<T>,
}

public struct IntentCreated has copy, drop {
    intent_id: ID,
    payer: address,
    payee_name: String,
    purpose: String,
    amount: u64,
    expires_at_ms: u64,
}

public struct IntentAccepted has copy, drop {
    intent_id: ID,
    payer: address,
    payee: address,
    amount: u64,
}

public struct IntentClosed has copy, drop {
    intent_id: ID,
    payer: address,
    status: u8,
    amount: u64,
}

public fun create<T>(
    payment: Coin<T>,
    payee_name: String,
    purpose: String,
    expires_at_ms: u64,
    claim_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&payment);
    assert!(amount > 0, EAmount);
    assert!(string::length(&payee_name) > 0 && string::length(&payee_name) <= MAX_NAME, EName);
    assert!(string::length(&purpose) > 0 && string::length(&purpose) <= MAX_PURPOSE, EPurpose);
    assert!(claim_hash.length() == 32, EHash);
    let now = clock.timestamp_ms();
    assert!(expires_at_ms > now && expires_at_ms < now + YEAR_MS, EExpiry);

    let intent = Intent<T> {
        id: object::new(ctx),
        payer: ctx.sender(),
        payee_name,
        purpose,
        amount,
        expires_at_ms,
        claim_hash,
        status: STATUS_PENDING,
        payee: @0x0,
        escrow: coin::into_balance(payment),
    };
    event::emit(IntentCreated {
        intent_id: object::id(&intent),
        payer: intent.payer,
        payee_name: intent.payee_name,
        purpose: intent.purpose,
        amount,
        expires_at_ms,
    });
    transfer::share_object(intent);
}

/// Bearer presentation of the QR secret. Gas can be paid by a sponsor so the
/// payee does not need SUI, or a wallet, before this call.
public fun accept<T>(
    intent: &mut Intent<T>,
    secret: vector<u8>,
    payee: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(intent.status == STATUS_PENDING, ENotPending);
    assert!(clock.timestamp_ms() <= intent.expires_at_ms, EExpired);
    assert!(payee != @0x0, EPayee);
    assert!(secret.length() > 0 && secret.length() <= 128, EWrongSecret);
    let digest = hash::blake2b256(&secret);
    assert!(digest == intent.claim_hash, EWrongSecret);

    intent.status = STATUS_ACCEPTED;
    intent.payee = payee;
    let amount = intent.amount;
    let payer = intent.payer;
    let intent_id = object::id(intent);
    let paid = coin::from_balance(balance::withdraw_all(&mut intent.escrow), ctx);
    transfer::public_transfer(paid, payee);
    event::emit(IntentAccepted { intent_id, payer, payee, amount });
}

public fun cancel<T>(intent: &mut Intent<T>, ctx: &mut TxContext) {
    assert!(intent.payer == ctx.sender(), ENotPayer);
    assert!(intent.status == STATUS_PENDING, ENotPending);
    close_to_payer(intent, STATUS_CANCELLED, ctx);
}

public fun reclaim_expired<T>(intent: &mut Intent<T>, clock: &Clock, ctx: &mut TxContext) {
    assert!(intent.status == STATUS_PENDING, ENotPending);
    assert!(clock.timestamp_ms() > intent.expires_at_ms, ENotExpired);
    close_to_payer(intent, STATUS_EXPIRED, ctx);
}

fun close_to_payer<T>(intent: &mut Intent<T>, status: u8, ctx: &mut TxContext) {
    intent.status = status;
    let amount = intent.amount;
    let payer = intent.payer;
    let intent_id = object::id(intent);
    let refund = coin::from_balance(balance::withdraw_all(&mut intent.escrow), ctx);
    transfer::public_transfer(refund, payer);
    event::emit(IntentClosed { intent_id, payer, status, amount });
}

#[test_only]
use sui::clock;
#[test_only]
use sui::coin::mint_for_testing;
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario;

#[test]
fun accept_pays_the_new_address() {
    let payer = @0xA;
    let payee = @0xB;
    let mut scenario = test_scenario::begin(payer);
    let secret = b"open-sesame";
    {
        let ctx = scenario.ctx();
        let mut tick = clock::create_for_testing(ctx);
        tick.set_for_testing(1_000);
        create<SUI>(
            mint_for_testing<SUI>(2_000_000, ctx),
            string::utf8(b"Mark"),
            string::utf8(b"lunch"),
            50_000,
            hash::blake2b256(&secret),
            &tick,
            ctx,
        );
        clock::destroy_for_testing(tick);
    };
    scenario.next_tx(payee);
    {
        let mut intent = scenario.take_shared<Intent<SUI>>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(&mut intent, secret, payee, &tick, scenario.ctx());
        assert!(intent.status == STATUS_ACCEPTED);
        assert!(intent.payee == payee);
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(intent);
    };
    scenario.next_tx(payee);
    {
        let paid = scenario.take_from_sender<Coin<SUI>>();
        assert!(coin::value(&paid) == 2_000_000);
        scenario.return_to_sender(paid);
    };
    scenario.end();
}

#[test]
fun cancel_returns_escrow() {
    let payer = @0xA;
    let mut scenario = test_scenario::begin(payer);
    {
        let ctx = scenario.ctx();
        let mut tick = clock::create_for_testing(ctx);
        tick.set_for_testing(1_000);
        create<SUI>(
            mint_for_testing<SUI>(5, ctx),
            string::utf8(b"Mark"),
            string::utf8(b"lunch"),
            90_000,
            hash::blake2b256(&b"secret-secret"),
            &tick,
            ctx,
        );
        clock::destroy_for_testing(tick);
    };
    scenario.next_tx(payer);
    {
        let mut intent = scenario.take_shared<Intent<SUI>>();
        cancel(&mut intent, scenario.ctx());
        assert!(intent.status == STATUS_CANCELLED);
        test_scenario::return_shared(intent);
    };
    scenario.next_tx(payer);
    {
        let refund = scenario.take_from_sender<Coin<SUI>>();
        assert!(coin::value(&refund) == 5);
        scenario.return_to_sender(refund);
    };
    scenario.end();
}

#[test]
fun hash_matches_blake2b256() {
    let digest = hash::blake2b256(&b"open-sesame");
    assert!(digest == vector[
        11, 161, 85, 0, 147, 128, 152, 139, 159, 118, 200, 86, 122, 69, 33, 17,
        113, 18, 253, 78, 173, 28, 72, 135, 157, 94, 43, 148, 241, 213, 14, 163,
    ]);
}

#[test]
#[expected_failure(abort_code = EWrongSecret)]
fun wrong_secret_aborts() {
    let payer = @0xA;
    let mut scenario = test_scenario::begin(payer);
    {
        let ctx = scenario.ctx();
        let mut tick = clock::create_for_testing(ctx);
        tick.set_for_testing(1_000);
        create<SUI>(
            mint_for_testing<SUI>(5, ctx),
            string::utf8(b"Mark"),
            string::utf8(b"lunch"),
            90_000,
            hash::blake2b256(&b"the-real-secret"),
            &tick,
            ctx,
        );
        clock::destroy_for_testing(tick);
    };
    scenario.next_tx(@0xB);
    {
        let mut intent = scenario.take_shared<Intent<SUI>>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(&mut intent, b"nope", @0xB, &tick, scenario.ctx());
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(intent);
    };
    scenario.end();
}
