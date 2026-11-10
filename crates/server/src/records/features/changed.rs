//! What changed, said on the bus: after a write of this domain, and after each burst of file
//! changes the core's watcher reports, as the Node server's `live.ts` mapped them.

use uraeda_core::watch::Changes;
use uraeda_protocol::{
    AllBranchChanges, BranchChanges, BranchDecision, Feature, History, Inbox, ItemArgs, Ledger,
    Priorities, ProposalFile, RecommendedMessage, RepositoryArgs, Trigger, WorkflowFile,
    WorkflowMessage, WorkflowMessageArgs,
};

use crate::live::Bus;

/// The rounds of the default branch, by their ids among the workflow files.
const DEFAULT_ROUNDS: [&str; 2] = ["inbox-triage", "decisions-check"];

/// Every trigger a workflow message is read for.
const TRIGGERS: [Trigger; 9] = [
    Trigger::Answers,
    Trigger::Approval,
    Trigger::CatchUp,
    Trigger::Changes,
    Trigger::Comments,
    Trigger::Proposal,
    Trigger::Start,
    Trigger::Manual,
    Trigger::NextStep,
];

/// The arguments of a record of a repository.
fn of(repo: &str) -> RepositoryArgs {
    RepositoryArgs {
        repo: repo.to_owned(),
    }
}

/// The arguments of a record of one thing of a repository.
fn item(repo: &str, id: &str) -> ItemArgs {
    ItemArgs {
        repo: repo.to_owned(),
        id: id.to_owned(),
    }
}

/// A repository's files changed, as the core's watcher says after each burst.
pub(super) fn files(bus: &Bus, repo: &str, changes: &Changes) {
    changes
        .features
        .iter()
        .for_each(|folder| feature(bus, repo, folder));
    // The cards' one record of every feature's changes goes with each feature's own.
    if !changes.features.is_empty() {
        bus.changed::<AllBranchChanges>(&of(repo));
    }
    for file in &changes.files {
        bus.changed::<WorkflowFile>(&item(repo, file));
    }
    for decision in &changes.branch_decisions {
        bus.changed::<BranchDecision>(&item(repo, decision));
    }
    // The inbox and the priorities share the count of changes waiting for a commit, so a change
    // of either, or of a feature, whose checkout a buffer may have edited, sends both.
    if changes.priorities || changes.inbox || !changes.features.is_empty() {
        lists(bus, repo);
    }
    // The ledger carries the decisions check's status, which a change of the inbox's rounds moves.
    if changes.decisions || changes.inbox {
        bus.changed::<Ledger>(&of(repo));
    }
    if changes.inbox {
        rounds(bus, repo);
    }
}

/// A feature changed: its step may have moved, which its messages, its history, and its
/// branch's changes read.
pub(super) fn feature(bus: &Bus, repo: &str, folder: &str) {
    let args = item(repo, folder);
    bus.changed::<Feature>(&args);
    bus.changed::<BranchChanges>(&args);
    bus.changed::<History>(&args);
    bus.changed::<RecommendedMessage>(&args);
    for trigger in TRIGGERS {
        bus.changed::<WorkflowMessage>(&WorkflowMessageArgs {
            repo: repo.to_owned(),
            folder: folder.to_owned(),
            trigger,
        });
    }
}

/// The inbox and the priorities changed.
pub(super) fn lists(bus: &Bus, repo: &str) {
    bus.changed::<Priorities>(&of(repo));
    bus.changed::<Inbox>(&of(repo));
}

/// The rounds of the default branch changed.
fn rounds(bus: &Bus, repo: &str) {
    for round in DEFAULT_ROUNDS {
        bus.changed::<WorkflowFile>(&item(repo, round));
    }
}

/// A proposal file was written, or moved to this path.
pub(super) fn proposal_file(bus: &Bus, repo: &str, path: &str) {
    bus.changed::<ProposalFile>(&item(repo, path));
}

/// A feature or a change started, was dropped, or was made a feature: the lists, the feature
/// itself, and every record that lists features are read again.
pub(super) fn life(bus: &Bus, repo: &str, folder: &str) {
    feature(bus, repo, folder);
    lists(bus, repo);
    bus.changed::<AllBranchChanges>(&of(repo));
    // A start moves its proposal file, and a promotion a change's files: whatever is held of
    // them is read again.
    bus.changed_all::<ProposalFile>();
    bus.changed_all::<WorkflowFile>();
}
