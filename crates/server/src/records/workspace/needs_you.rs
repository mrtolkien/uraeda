//! What needs the human across every listed repository, for the notifications: each feature in
//! flight whose status asks something of them, with what it asks and where to answer it.

use uraeda_core::api::{self, ApiError};
use uraeda_core::view::FeatureView;
use uraeda_protocol::{
    FeatureStatus, NeedsYouList, NeedsYouReason, NeedsYouRow, SessionStatus, StatusReason,
};

use super::repositories::{self, Repository};
use super::status;
use crate::live::Registry;
use crate::records::views::word;
use crate::runner::Runner;
use crate::shared::Shared;

/// What a refused action tells.
const REFUSED: &str = "The agent was refused an action";

/// Registers the record `NeedsYouList`.
pub(super) fn register(registry: &Registry) {
    registry.record::<NeedsYouList>(|shared, ()| Ok(list(shared)));
}

/// Every listed repository's items that need the human: its features, then its chats. A
/// repository whose folder is gone, or that cannot be read, is left out.
fn list(shared: &Shared) -> NeedsYouList {
    let repositories = repositories::all(shared).into_iter();
    let there = repositories.filter(|repository| !repository.missing);
    let rows = there.flat_map(|repository| {
        let features = rows_of(shared, &repository).unwrap_or_default();
        features.into_iter().chain(chats_of(shared, &repository))
    });
    NeedsYouList {
        rows: rows.collect(),
    }
}

/// The chats of one repository whose latest turn was refused an action: archived ones are put
/// away.
fn chats_of(shared: &Shared, repository: &Repository) -> Vec<NeedsYouRow> {
    let Some(runner) = Runner::find(shared) else {
        return Vec::new();
    };
    let chats = runner.chat_statuses(&repository.path.to_string_lossy());
    let blocked = chats
        .into_iter()
        .filter(|(_, _, status)| status.reason == Some(StatusReason::Blocked));
    let rows = blocked.map(|(row, latest, _)| {
        let name = &repository.name;
        let id = format!("{name}/sessions/{}", row.id);
        let title = row
            .title
            .clone()
            .unwrap_or_else(|| "New session".to_owned());
        let turn = latest.map(|turn| turn.to_string()).unwrap_or_default();
        NeedsYouRow {
            key: format!("{id}:blocked:{turn}"),
            repository: name.clone(),
            folder: None,
            href: format!("/r/{name}/sessions/{}", row.id),
            label: title.clone(),
            title,
            message: REFUSED.to_owned(),
            reason: NeedsYouReason::Blocked,
            continued: false,
            id,
        }
    });
    rows.collect()
}

/// The turn a feature's ask follows, for its key: its status's, but when its step asks, the
/// followed session's latest turn not sent at `catch-up`. A catch-up that ended at the pull
/// request only brought back the review it asked before; one that stopped or was refused asks.
fn asked_by(shared: &Shared, status: &FeatureStatus) -> String {
    let own = || status.turn.clone().unwrap_or_default();
    let (Some(session), Some(runner)) = (&status.session, Runner::find(shared)) else {
        return own();
    };
    if status.reason != Some(StatusReason::Step) {
        return own();
    }
    let turns = runner.store().turns(session).unwrap_or_default();
    let turns: Vec<_> = turns
        .into_iter()
        .filter(|turn| turn.step.as_deref() != Some("catch-up"))
        .collect();
    let latest = crate::runner::latest_of(&turns, None);
    latest.map(|turn| turn.id.to_string()).unwrap_or_default()
}

/// The features in flight of one repository that need the human.
fn rows_of(shared: &Shared, repository: &Repository) -> Result<Vec<NeedsYouRow>, ApiError> {
    let features = api::read_workspace(&repository.path)?.features.into_iter();
    let in_flight =
        features.filter(|feature| !matches!(feature.step.name.as_str(), "done" | "none"));
    Ok(in_flight
        .filter_map(|feature| row(shared, repository, &feature))
        .collect())
}

/// A feature's row, when its status asks something of the human.
fn row(shared: &Shared, repository: &Repository, feature: &FeatureView) -> Option<NeedsYouRow> {
    let status = status::of(shared, &repository.path, feature);
    let reason = reason(&status, &feature.step.name)?;
    let id = format!("{}/{}", repository.name, feature.folder);
    // The key holds the turn the status follows, so a run that ends at the same gate notifies
    // again.
    let key = [
        id.as_str(),
        &word(&reason),
        &feature.step.name,
        feature.step.file.as_deref().unwrap_or_default(),
        &status.reason.as_ref().map(word).unwrap_or_default(),
        &asked_by(shared, &status),
    ]
    .join(":");
    let label = repositories::label(repository, &feature.folder);
    let root = repository.path.to_string_lossy();
    let continued =
        Runner::find(shared).is_some_and(|runner| runner.continued_by_all(&root, feature, &status));
    Some(NeedsYouRow {
        key,
        repository: repository.name.clone(),
        folder: Some(feature.folder.clone()),
        href: href(&repository.name, feature, reason),
        label: label.unwrap_or_else(|| feature.slug.clone()),
        title: feature.title.clone(),
        message: message(feature, reason, status.reason),
        reason,
        continued,
        id,
    })
}

/// Why a status needs the human, or nothing: a refused action first, then a run that ended early,
/// then a step that waits on them.
fn reason(status: &FeatureStatus, step: &str) -> Option<NeedsYouReason> {
    match (status.reason, status.status) {
        (Some(StatusReason::Blocked), _) => Some(NeedsYouReason::Blocked),
        (_, SessionStatus::Attention) => Some(NeedsYouReason::Attention),
        (_, SessionStatus::NeedsYou) if step == "pull-request" => Some(NeedsYouReason::PullRequest),
        (_, SessionStatus::NeedsYou) => Some(NeedsYouReason::Step),
        _ => None,
    }
}

/// The kind of the file a feature's step waits on.
fn asked_kind(feature: &FeatureView) -> Option<&str> {
    let name = feature.step.file.as_deref()?;
    let file = feature.files.iter().find(|file| file.name == name)?;
    Some(file.kind.as_str())
}

/// What an item asks, in words.
fn message(feature: &FeatureView, reason: NeedsYouReason, why: Option<StatusReason>) -> String {
    let text = match reason {
        NeedsYouReason::Blocked => REFUSED,
        NeedsYouReason::Attention => attention(why),
        NeedsYouReason::PullRequest => {
            let number = feature
                .pull_request
                .as_ref()
                .map(|pull| pull.number.to_string());
            let number = number.unwrap_or_default();
            return format!("Pull request #{number} is ready for review");
        }
        // What a gate asks, by the kind of file it waits on.
        NeedsYouReason::Step => match asked_kind(feature) {
            Some("clarifications") => "Questions to answer",
            Some("plan") => "The plan to review",
            Some("proposal") => "The proposal to write",
            Some("spec") => "The spec to review",
            _ => "A step to take",
        },
    };
    text.to_owned()
}

/// What a run that needs attention tells, by why: one halted before a gate, by default.
fn attention(why: Option<StatusReason>) -> &'static str {
    match why {
        Some(StatusReason::Capped) => "The agent keeps stopping",
        Some(StatusReason::Conflict) => "The catch-up stopped on a conflict",
        Some(StatusReason::Failed) => "The run failed",
        Some(StatusReason::Interrupted) => "The server stopped the run",
        Some(StatusReason::Stopped) => "You stopped the run",
        _ => "The run stopped before a gate",
    }
}

/// Where the human answers an item: its session for a run, the file its step waits on, in its
/// editor for a proposal, or else its page.
fn href(repository: &str, feature: &FeatureView, reason: NeedsYouReason) -> String {
    let base = format!("/r/{repository}");
    let folder = &feature.folder;
    let file = feature.step.file.as_deref();
    match (reason, file) {
        (NeedsYouReason::Blocked | NeedsYouReason::Attention, _) => {
            format!("{base}/f/{folder}/session")
        }
        (NeedsYouReason::Step, Some(file)) if asked_kind(feature) == Some("proposal") => {
            format!("{base}/edit/{}/{file}", feature.path)
        }
        (NeedsYouReason::Step, Some(file)) => format!("{base}/f/{folder}/{file}"),
        _ => format!("{base}/f/{folder}"),
    }
}
