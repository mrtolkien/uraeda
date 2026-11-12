//! A feature's status, decided in one place, which every record and the notifications read: see
//! the feature status decision.

use std::collections::HashSet;
use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::{FeatureView, ProposalView};
use uraeda_protocol::{FeatureStatus, SessionStatus, StatusReason};

use crate::runner::Runner;
use crate::shared::Shared;

/// The status of a feature of the repository whose main checkout is `root`, from its sessions
/// first, a running one, then the latest, then its step: the feature status decision's rules,
/// which the sessions hold. `now`: its proposal is in **Now**, which [`now_of`] reads.
pub(in crate::records) fn of(
    shared: &Shared,
    root: &Path,
    feature: &FeatureView,
    now: bool,
) -> FeatureStatus {
    match Runner::find(shared) {
        Some(runner) => runner.feature_status(&root.to_string_lossy(), feature, now),
        None => of_step(feature),
    }
}

/// The folders of the features of **Now**, of a workspace as read.
pub(in crate::records) fn now_of(priorities: &[ProposalView]) -> HashSet<String> {
    crate::runner::in_now(priorities)
}

/// Whether one feature of the repository is in **Now**: its line read in the workspace, which
/// the core keeps read.
pub(in crate::records) fn in_now(root: &Path, folder: &str) -> bool {
    let workspace = api::read_workspace(root);
    workspace.is_ok_and(|workspace| now_of(&workspace.priorities).contains(folder))
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
