/// A programmable obligation. Funds lock up front. They leave only when every
/// agreed condition is true: a verified merchant if required, a price that is
/// still within the cap, the destination bound at acceptance, and proof of
/// delivery if required. There is no instruction that changes the price or
/// retargets the payment. If the merchant never accepts, or delivery does not
/// arrive before the deadline, the escrow returns to the payer.
module pago::obligation;

use pago::merchant::{Self, Registry};
use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;

const OFFERED: u8 = 0;
const ACCEPTED: u8 = 1;
const RELEASED: u8 = 2;
const RETURNED: u8 = 3;

const EAmount: u64 = 0;
const ETerms: u64 = 1;
const EExpiry: u64 = 2;
const ENotOffered: u64 = 3;
const ENotAccepted: u64 = 4;
const EExpired: u64 = 5;
const ENotExpired: u64 = 6;
const EPrice: u64 = 7;
const EUnverified: u64 = 8;
const EDestination: u64 = 9;
const ENoProof: u64 = 10;
const ENotPayer: u64 = 11;
const ENotMerchant: u64 = 12;
const EPriceChanged: u64 = 13;
const EClosed: u64 = 14;

const MAX_TEXT: u64 = 180;
const MAX_NAME: u64 = 48;
const YEAR_MS: u64 = 366 * 24 * 60 * 60 * 1000;

public struct Obligation<phantom T> has key {
    id: UID,
    payer: address,
    service: String,
    currency: String,
    max_quote: u64,
    accepted_quote: u64,
    rate_num: u64,
    rate_den: u64,
    require_verified: bool,
    require_proof: bool,
    merchant: address,
    merchant_name: String,
    destination: address,
    proof: String,
    expires_at_ms: u64,
    status: u8,
    outcome: String,
    escrow: Balance<T>,
}

public struct ObligationCreated has copy, drop {
    obligation_id: ID,
    payer: address,
    service: String,
    currency: String,
    max_quote: u64,
    expires_at_ms: u64,
}

public struct ObligationAccepted has copy, drop {
    obligation_id: ID,
    merchant: address,
    merchant_name: String,
    accepted_quote: u64,
    destination: address,
}

public struct ProofSubmitted has copy, drop {
    obligation_id: ID,
    merchant: address,
    proof: String,
}

public struct ObligationReleased has copy, drop {
    obligation_id: ID,
    payer: address,
    destination: address,
    paid: u64,
    refunded: u64,
}

public struct ObligationReturned has copy, drop {
    obligation_id: ID,
    payer: address,
    outcome: String,
    amount: u64,
}

public fun quote_to_micro(quote: u64, rate_num: u64, rate_den: u64): u64 {
    assert!(rate_den > 0 && quote <= 1_000_000 && rate_num <= 1_000_000_000, EAmount);
    (quote * rate_num) / rate_den
}

public fun create<T>(
    payment: Coin<T>,
    service: String,
    currency: String,
    max_quote: u64,
    rate_num: u64,
    rate_den: u64,
    require_verified: bool,
    require_proof: bool,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(string::length(&service) > 0 && string::length(&service) <= MAX_TEXT, ETerms);
    assert!(string::length(&currency) > 0 && string::length(&currency) <= 8, ETerms);
    assert!(max_quote > 0, EAmount);
    let expected = quote_to_micro(max_quote, rate_num, rate_den);
    assert!(expected > 0 && coin::value(&payment) == expected, EAmount);
    let now = clock.timestamp_ms();
    assert!(expires_at_ms > now && expires_at_ms < now + YEAR_MS, EExpiry);

    let payer = ctx.sender();
    let obligation = Obligation<T> {
        id: object::new(ctx),
        payer,
        service,
        currency,
        max_quote,
        accepted_quote: 0,
        rate_num,
        rate_den,
        require_verified,
        require_proof,
        merchant: @0x0,
        merchant_name: string::utf8(b""),
        destination: @0x0,
        proof: string::utf8(b""),
        expires_at_ms,
        status: OFFERED,
        outcome: string::utf8(b""),
        escrow: coin::into_balance(payment),
    };
    event::emit(ObligationCreated {
        obligation_id: object::id(&obligation),
        payer,
        service: obligation.service,
        currency: obligation.currency,
        max_quote,
        expires_at_ms,
    });
    transfer::share_object(obligation);
}

/// The accepting address becomes the only destination. The quote is frozen.
/// A later attempt to pay anyone else, or any other price, has no function that succeeds.
public fun accept<T>(
    obligation: &mut Obligation<T>,
    registry: &Registry,
    quote: u64,
    merchant_name: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(obligation.status == OFFERED, ENotOffered);
    assert!(clock.timestamp_ms() <= obligation.expires_at_ms, EExpired);
    assert!(quote > 0 && quote <= obligation.max_quote, EPrice);
    assert!(string::length(&merchant_name) > 0 && string::length(&merchant_name) <= MAX_NAME, ETerms);
    let merchant = ctx.sender();
    assert!(merchant != @0x0 && merchant != obligation.payer, ENotMerchant);
    if (obligation.require_verified) {
        assert!(merchant::is_verified(registry, merchant), EUnverified);
    };
    obligation.accepted_quote = quote;
    obligation.merchant = merchant;
    obligation.destination = merchant;
    obligation.merchant_name = merchant_name;
    obligation.status = ACCEPTED;
    event::emit(ObligationAccepted {
        obligation_id: object::id(obligation),
        merchant,
        merchant_name: obligation.merchant_name,
        accepted_quote: quote,
        destination: merchant,
    });
}

public fun submit_proof<T>(obligation: &mut Obligation<T>, proof: String, ctx: &TxContext) {
    assert!(obligation.status == ACCEPTED, ENotAccepted);
    assert!(ctx.sender() == obligation.merchant, ENotMerchant);
    assert!(string::length(&proof) > 0 && string::length(&proof) <= MAX_TEXT, ENoProof);
    obligation.proof = proof;
    event::emit(ProofSubmitted {
        obligation_id: object::id(obligation),
        merchant: obligation.merchant,
        proof: obligation.proof,
    });
}

/// Permissionless. Succeeds only when the predicate holds, so an agent may pay
/// without being trusted to decide the terms.
public fun release<T>(
    obligation: &mut Obligation<T>,
    registry: &Registry,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(obligation.status == ACCEPTED, ENotAccepted);
    assert!(clock.timestamp_ms() <= obligation.expires_at_ms, EExpired);
    assert!(obligation.destination != @0x0 && obligation.destination == obligation.merchant, EDestination);
    assert!(obligation.accepted_quote > 0 && obligation.accepted_quote <= obligation.max_quote, EPrice);
    if (obligation.require_verified) {
        assert!(merchant::is_verified(registry, obligation.merchant), EUnverified);
    };
    if (obligation.require_proof) {
        assert!(string::length(&obligation.proof) > 0, ENoProof);
    };
    let pay = quote_to_micro(obligation.accepted_quote, obligation.rate_num, obligation.rate_den);
    let escrow_value = balance::value(&obligation.escrow);
    assert!(pay > 0 && pay <= escrow_value, EAmount);

    obligation.status = RELEASED;
    obligation.outcome = string::utf8(b"released");
    let paid = coin::from_balance(balance::split(&mut obligation.escrow, pay), ctx);
    transfer::public_transfer(paid, obligation.destination);
    let refunded = balance::value(&obligation.escrow);
    if (refunded > 0) {
        let rest = coin::from_balance(balance::withdraw_all(&mut obligation.escrow), ctx);
        transfer::public_transfer(rest, obligation.payer);
    };
    event::emit(ObligationReleased {
        obligation_id: object::id(obligation),
        payer: obligation.payer,
        destination: obligation.destination,
        paid: pay,
        refunded,
    });
}

public fun cancel<T>(obligation: &mut Obligation<T>, ctx: &mut TxContext) {
    assert!(ctx.sender() == obligation.payer, ENotPayer);
    assert!(obligation.status == OFFERED, ENotOffered);
    return_all(obligation, string::utf8(b"cancelled"), ctx);
}

/// The bound merchant can hand the offer back before proof exists.
/// After proof, only release or the deadline moves the funds.
public fun decline<T>(obligation: &mut Obligation<T>, ctx: &mut TxContext) {
    assert!(obligation.status == ACCEPTED, ENotAccepted);
    assert!(ctx.sender() == obligation.merchant, ENotMerchant);
    assert!(string::length(&obligation.proof) == 0, EClosed);
    return_all(obligation, string::utf8(b"declined"), ctx);
}

public fun reclaim<T>(obligation: &mut Obligation<T>, clock: &Clock, ctx: &mut TxContext) {
    assert!(obligation.status == OFFERED || obligation.status == ACCEPTED, EClosed);
    assert!(clock.timestamp_ms() > obligation.expires_at_ms, ENotExpired);
    return_all(obligation, string::utf8(b"expired"), ctx);
}

/// Kept so a client can demonstrate the refusal. No price revision exists.
public fun revise_price<T>(_obligation: &Obligation<T>, _quote: u64) {
    abort EPriceChanged
}

/// Kept so a client can demonstrate the refusal. No retarget exists.
public fun redirect<T>(_obligation: &Obligation<T>, _destination: address) {
    abort EDestination
}

fun return_all<T>(obligation: &mut Obligation<T>, outcome: String, ctx: &mut TxContext) {
    obligation.status = RETURNED;
    obligation.outcome = outcome;
    let amount = balance::value(&obligation.escrow);
    let refund = coin::from_balance(balance::withdraw_all(&mut obligation.escrow), ctx);
    transfer::public_transfer(refund, obligation.payer);
    event::emit(ObligationReturned {
        obligation_id: object::id(obligation),
        payer: obligation.payer,
        outcome: obligation.outcome,
        amount,
    });
}

#[test_only]
use sui::clock;
#[test_only]
use sui::coin::mint_for_testing;
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario;

#[test_only]
fun fixture(_payer: address, scenario: &mut test_scenario::Scenario, expires: u64) {
    let ctx = scenario.ctx();
    let mut tick = clock::create_for_testing(ctx);
    tick.set_for_testing(1_000);
    create<SUI>(
        mint_for_testing<SUI>(20_000_000, ctx),
        string::utf8(b"this service"),
        string::utf8(b"JPY"),
        3_000,
        1_000_000,
        150,
        true,
        true,
        expires,
        &tick,
        ctx,
    );
    clock::destroy_for_testing(tick);
}

#[test]
fun release_pays_the_bound_price_and_returns_the_rest() {
    let admin = @0xA;
    let payer = @0xB;
    let merchant = @0xC;
    let mut scenario = test_scenario::begin(admin);
    merchant::share_for_test(admin, scenario.ctx());
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<Registry>();
        merchant::verify(&mut registry, merchant, string::utf8(b"Harbor Bindery"), scenario.ctx());
        test_scenario::return_shared(registry);
    };
    scenario.next_tx(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(merchant);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let registry = scenario.take_shared<Registry>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(
            &mut obligation,
            &registry,
            1_500,
            string::utf8(b"Harbor Bindery"),
            &tick,
            scenario.ctx(),
        );
        submit_proof(&mut obligation, string::utf8(b"POD-4421"), scenario.ctx());
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(obligation);
    };
    scenario.next_tx(payer);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let registry = scenario.take_shared<Registry>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(3_000);
        release(&mut obligation, &registry, &tick, scenario.ctx());
        assert!(obligation.status == RELEASED);
        assert!(obligation.destination == merchant);
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(obligation);
    };
    scenario.next_tx(merchant);
    {
        let paid = scenario.take_from_sender<Coin<SUI>>();
        // 1500 * 1_000_000 / 150 = 10_000_000
        assert!(coin::value(&paid) == 10_000_000);
        scenario.return_to_sender(paid);
    };
    scenario.next_tx(payer);
    {
        let refund = scenario.take_from_sender<Coin<SUI>>();
        assert!(coin::value(&refund) == 10_000_000);
        scenario.return_to_sender(refund);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = EUnverified)]
fun unverified_merchant_cannot_accept() {
    let admin = @0xA;
    let payer = @0xB;
    let merchant = @0xC;
    let mut scenario = test_scenario::begin(admin);
    merchant::share_for_test(admin, scenario.ctx());
    scenario.next_tx(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(merchant);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let registry = scenario.take_shared<Registry>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(&mut obligation, &registry, 2_500, string::utf8(b"Night Window"), &tick, scenario.ctx());
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(obligation);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = ENoProof)]
fun release_without_proof_aborts() {
    let admin = @0xA;
    let payer = @0xB;
    let merchant = @0xC;
    let mut scenario = test_scenario::begin(admin);
    merchant::share_for_test(admin, scenario.ctx());
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<Registry>();
        merchant::verify(&mut registry, merchant, string::utf8(b"Harbor"), scenario.ctx());
        test_scenario::return_shared(registry);
    };
    scenario.next_tx(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(merchant);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let registry = scenario.take_shared<Registry>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(&mut obligation, &registry, 3_000, string::utf8(b"Harbor"), &tick, scenario.ctx());
        release(&mut obligation, &registry, &tick, scenario.ctx());
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(obligation);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = EPrice)]
fun price_above_the_cap_aborts() {
    let admin = @0xA;
    let payer = @0xB;
    let merchant = @0xC;
    let mut scenario = test_scenario::begin(admin);
    merchant::share_for_test(admin, scenario.ctx());
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<Registry>();
        merchant::verify(&mut registry, merchant, string::utf8(b"Harbor"), scenario.ctx());
        test_scenario::return_shared(registry);
    };
    scenario.next_tx(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(merchant);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let registry = scenario.take_shared<Registry>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(2_000);
        accept(&mut obligation, &registry, 3_001, string::utf8(b"Harbor"), &tick, scenario.ctx());
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(registry);
        test_scenario::return_shared(obligation);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = EPriceChanged)]
fun revise_price_always_aborts() {
    let payer = @0xB;
    let mut scenario = test_scenario::begin(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(payer);
    {
        let obligation = scenario.take_shared<Obligation<SUI>>();
        revise_price(&obligation, 1);
        test_scenario::return_shared(obligation);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = EDestination)]
fun redirect_always_aborts() {
    let payer = @0xB;
    let mut scenario = test_scenario::begin(payer);
    fixture(payer, &mut scenario, 90_000);
    scenario.next_tx(payer);
    {
        let obligation = scenario.take_shared<Obligation<SUI>>();
        redirect(&obligation, @0xD);
        test_scenario::return_shared(obligation);
    };
    scenario.end();
}

#[test]
fun expiry_returns_the_escrow_if_nobody_accepted() {
    let payer = @0xB;
    let mut scenario = test_scenario::begin(payer);
    fixture(payer, &mut scenario, 5_000);
    scenario.next_tx(payer);
    {
        let mut obligation = scenario.take_shared<Obligation<SUI>>();
        let mut tick = clock::create_for_testing(scenario.ctx());
        tick.set_for_testing(5_001);
        reclaim(&mut obligation, &tick, scenario.ctx());
        assert!(obligation.status == RETURNED);
        clock::destroy_for_testing(tick);
        test_scenario::return_shared(obligation);
    };
    scenario.next_tx(payer);
    {
        let refund = scenario.take_from_sender<Coin<SUI>>();
        assert!(coin::value(&refund) == 20_000_000);
        scenario.return_to_sender(refund);
    };
    scenario.end();
}
