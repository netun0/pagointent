/// Flagship goods seeded at publish, plus items a new payee lists themselves.
module intenses::market;

use std::string::{Self, String};
use sui::coin::{Self, Coin};
use sui::event;

const KIND_FLAGSHIP: u8 = 0;
const KIND_COMMUNITY: u8 = 1;

const ETitle: u64 = 0;
const EDetail: u64 = 1;
const EPrice: u64 = 2;
const EInactive: u64 = 3;
const ESelf: u64 = 4;

public struct Listing has key {
    id: UID,
    seller: address,
    title: String,
    detail: String,
    price: u64,
    kind: u8,
    active: bool,
}

public struct ListingCreated has copy, drop {
    listing_id: ID,
    seller: address,
    title: String,
    detail: String,
    price: u64,
    kind: u8,
}

public struct Purchased has copy, drop {
    listing_id: ID,
    buyer: address,
    seller: address,
    price: u64,
}

fun init(ctx: &mut TxContext) {
    // Prices are test USDC micro-units (6 decimals), sized so a $2 intent can buy something.
    seed(b"Oat latte", b"Corner Cup. A counter that gets paid in USDC without opening an exchange account.", 1_500_000, ctx);
    seed(b"Talk time", b"Airtime Desk. A $2 top-up. The demo prints a voucher from the transaction digest.", 2_000_000, ctx);
    seed(b"Chili crisp", b"Night Market. A jar, fulfilled by a flagship partner once the payment settles.", 3_000_000, ctx);
    seed(b"Day pass", b"Paper Route. One transit day. The kind of purchase that used to need a bank card.", 1_250_000, ctx);
}

fun seed(title: vector<u8>, detail: vector<u8>, price: u64, ctx: &mut TxContext) {
    let listing = Listing {
        id: object::new(ctx),
        seller: ctx.sender(),
        title: string::utf8(title),
        detail: string::utf8(detail),
        price,
        kind: KIND_FLAGSHIP,
        active: true,
    };
    event::emit(ListingCreated {
        listing_id: object::id(&listing),
        seller: listing.seller,
        title: listing.title,
        detail: listing.detail,
        price,
        kind: KIND_FLAGSHIP,
    });
    transfer::share_object(listing);
}

public fun list(title: String, detail: String, price: u64, ctx: &mut TxContext) {
    assert!(string::length(&title) > 0 && string::length(&title) <= 64, ETitle);
    assert!(string::length(&detail) > 0 && string::length(&detail) <= 240, EDetail);
    assert!(price > 0, EPrice);
    let listing = Listing {
        id: object::new(ctx),
        seller: ctx.sender(),
        title,
        detail,
        price,
        kind: KIND_COMMUNITY,
        active: true,
    };
    event::emit(ListingCreated {
        listing_id: object::id(&listing),
        seller: listing.seller,
        title: listing.title,
        detail: listing.detail,
        price,
        kind: KIND_COMMUNITY,
    });
    transfer::share_object(listing);
}

public fun buy<T>(listing: &mut Listing, payment: Coin<T>, ctx: &mut TxContext) {
    assert!(listing.active, EInactive);
    assert!(coin::value(&payment) == listing.price, EPrice);
    assert!(ctx.sender() != listing.seller, ESelf);
    listing.active = false;
    let listing_id = object::id(listing);
    let seller = listing.seller;
    let price = listing.price;
    transfer::public_transfer(payment, seller);
    event::emit(Purchased {
        listing_id,
        buyer: ctx.sender(),
        seller,
        price,
    });
}
