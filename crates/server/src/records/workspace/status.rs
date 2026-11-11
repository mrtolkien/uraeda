//! A feature's status, decided in one place, which every record and the notifications read: see
//! the feature status decision.

use std::path::Path;

use uraeda_core::view::FeatureView;
use uraeda_protocol::{FeatureStatus, SessionStatus, StatusReason};

use crate::runner::Runner;
use crate::shared::Shared;

/// The status of a feature of the repository whose main checkout is `root`, from its sessions
/// first, a running one, then the latest, then its step: the feature status decision's rules,
/// which the sessions hold.
pub(in crate::records) fn of(shared: &Shared, root: &Path, feature: &FeatureView) -> FeatureStatus {
    match Runner::find(shared) {
        Some(runner) => runner.feature_status(&root.to_string_lossy(), feature),
        None => of_step(feature),
    }
}

/// The status of a feature no session follows, from its step: it needs the human when it has
/// problems, or when its step waits on them, and is idle otherwise.
fn of_step(feature: &FeatureView) -> FeatureStatus {
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
