/// One soulbound-style badge per address after the free lessons.
module intenses::learn;

use sui::clock::Clock;
use sui::event;
use sui::table::{Self, Table};

const EAlready: u64 = 0;

public struct Registry has key {
    id: UID,
    learners: Table<address, bool>,
}

public struct LearnerBadge has key {
    id: UID,
    learner: address,
    completed_at_ms: u64,
}

public struct BadgeMinted has copy, drop {
    learner: address,
    badge_id: ID,
    completed_at_ms: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry {
        id: object::new(ctx),
        learners: table::new(ctx),
    });
}

public fun mint_badge(registry: &mut Registry, clock: &Clock, ctx: &mut TxContext) {
    let learner = ctx.sender();
    assert!(!registry.learners.contains(learner), EAlready);
    registry.learners.add(learner, true);
    let completed_at_ms = clock.timestamp_ms();
    let badge = LearnerBadge {
        id: object::new(ctx),
        learner,
        completed_at_ms,
    };
    event::emit(BadgeMinted {
        learner,
        badge_id: object::id(&badge),
        completed_at_ms,
    });
    transfer::transfer(badge, learner);
}
