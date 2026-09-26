/// A merchant is verified by being recorded here. The credential is soulbound:
/// it has `key` but not `store`, so the merchant cannot hand it to someone else.
module pago::merchant;

use std::string::{Self, String};
use sui::event;
use sui::table::{Self, Table};

const EAdmin: u64 = 0;

public struct Registry has key {
    id: UID,
    admin: address,
    verified: Table<address, bool>,
}

public struct Credential has key {
    id: UID,
    merchant: address,
    name: String,
}

public struct MerchantVerified has copy, drop {
    merchant: address,
    name: String,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry {
        id: object::new(ctx),
        admin: ctx.sender(),
        verified: table::new(ctx),
    });
}

public fun verify(registry: &mut Registry, merchant: address, name: String, ctx: &mut TxContext) {
    assert!(ctx.sender() == registry.admin, EAdmin);
    assert!(merchant != @0x0, EAdmin);
    assert!(string::length(&name) > 0 && string::length(&name) <= 48, EAdmin);
    if (table::contains(&registry.verified, merchant)) {
        *table::borrow_mut(&mut registry.verified, merchant) = true;
    } else {
        table::add(&mut registry.verified, merchant, true);
    };
    event::emit(MerchantVerified { merchant, name });
    let credential = Credential {
        id: object::new(ctx),
        merchant,
        name,
    };
    transfer::transfer(credential, merchant);
}

public fun is_verified(registry: &Registry, merchant: address): bool {
    table::contains(&registry.verified, merchant) && *table::borrow(&registry.verified, merchant)
}

#[test_only]
public fun share_for_test(admin: address, ctx: &mut TxContext) {
    transfer::share_object(Registry {
        id: object::new(ctx),
        admin,
        verified: table::new(ctx),
    });
}
