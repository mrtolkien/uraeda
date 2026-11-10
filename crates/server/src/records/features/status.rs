//! A feature's status, decided in one place, which every record and the notifications read: see
//! the feature status decision.

// JOIN(wave 6): `workspace::status::of` (task 7), word for word.

use uraeda_core::view::FeatureView;
use uraeda_protocol::feature_duplicates::{FeatureStatus, SessionStatus, StatusReason};

/// The status of a feature, from its step: it needs the human when it has problems, or when its
/// step waits on them, and is idle otherwise.
///
/// TEMPORARY: a feature follows its sessions first, a running one, then the latest. The sessions
/// (task 15) bring the rules before this one, and the `session`, `turn`, and `wait` it leaves
/// empty.
pub(super) fn of(feature: &FeatureView) -> FeatureStatus {
    let asks = !feature.problems.is_empty() || feature.step.waits_on == "human";
    let (status, label) = match asks {
        true => (SessionStatus::NeedsYou, "Needs you"),
        false => (SessionStatus::Idle, "Idle"),
    };
    // A feature with problems asks for them, whatever its step.
    let waits = asks && feature.problems.is_empty();
    FeatureStatus {
        status,
        label: label.to_owned(),
        reason: waits.then_some(StatusReason::Step),
        session: None,
        turn: None,
        wait: None,
    }
}
