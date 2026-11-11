//! The records `SessionList` and `SessionSearch`: the sidebar's rows of a repository's
//! sessions, what needs the human first, then the last updated.

use std::collections::HashMap;
use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{
    RepositoryArgs, SessionList, SessionRow, SessionSearch, SessionSearchArgs, SessionStatus,
};

use super::session::{is_latest, title_of};
use crate::live::{Fault, Registry};
use crate::runner::{self, Runner, sent, status};
use crate::shared::Shared;

/// How many sessions the sidebar lists: every feature's, and the chats.
const LIST_LIMIT: u32 = 10_000;

/// Registers the records `SessionList` and `SessionSearch`.
pub(super) fn register(registry: &Registry) {
    registry.record::<SessionList>(list);
    registry.record::<SessionSearch>(search);
}

/// A repository's features in flight, by their folders.
fn features_of(root: &str) -> HashMap<String, FeatureView> {
    let workspace = api::read_workspace(Path::new(root));
    let features = workspace
        .map(|workspace| workspace.features)
        .unwrap_or_default();
    features
        .into_iter()
        .map(|feature| (feature.folder.clone(), feature))
        .collect()
}

/// The sidebar's rows of some sessions, what needs the human first, in the order given. A
/// feature's session leaves the list with its feature, as when it was finished into its
/// record. The store leaves sub-sessions out: their parent lists them.
fn rows(
    runner: &Runner,
    features: &HashMap<String, FeatureView>,
    sessions: Vec<runner::Session>,
) -> Vec<SessionRow> {
    let listed = sessions.into_iter().filter(|row| {
        row.folder
            .as_ref()
            .is_none_or(|folder| features.contains_key(folder))
    });
    let mut rows: Vec<SessionRow> = listed
        .filter_map(|row| {
            let feature = row.folder.as_ref().and_then(|folder| features.get(folder));
            let turns = runner.turns_of(&row.id).ok()?;
            let read = runner.status_of(&row, &turns, feature, is_latest(runner, &row));
            let ended = turns.latest().is_some_and(|turn| turn.ended_at.is_some());
            let archived = row.archived_at.is_some();
            Some(SessionRow {
                agent: row.agent.clone(),
                title: title_of(&row, feature),
                archived,
                // A chat is done once idle and seen since its last turn ended: a later end
                // reads "New reply", and brings it back.
                done: !archived
                    && row.folder.is_none()
                    && read.status.status == SessionStatus::Idle
                    && ended,
                status: read.status.status,
                status_label: read.status.label.to_owned(),
                wait: read.wait,
                subagents: runner.subagents(&row.id),
                background_commands: runner.background_commands(&row.id),
                started_at: sent(row.created_at),
                updated_at: sent(row.updated_at),
                folder: row.folder,
                id: row.id,
            })
        })
        .collect();
    rows.sort_by_key(|row| status::order(row.status));
    rows
}

/// The value of the record `SessionList`.
fn list(shared: &Shared, args: RepositoryArgs) -> Result<SessionList, Fault> {
    let runner = Runner::of(shared);
    let root = runner.root_of(&args.repo)?;
    let sessions = runner.store().sessions_of(&root, LIST_LIMIT, None)?;
    Ok(SessionList {
        rows: rows(&runner, &features_of(&root), sessions),
    })
}

/// The value of the record `SessionSearch`: the sessions whose title, folder, or messages hold
/// the query, whatever its case, with every session of the features whose title holds it.
fn search(shared: &Shared, args: SessionSearchArgs) -> Result<SessionSearch, Fault> {
    let runner = Runner::of(shared);
    let root = runner.root_of(&args.repo)?;
    let store = runner.store();
    let features = features_of(&root);
    if args.query.trim().is_empty() {
        let sessions = store.sessions_of(&root, LIST_LIMIT, None)?;
        return Ok(SessionSearch {
            rows: rows(&runner, &features, sessions),
        });
    }
    let mut found = store.sessions_of(&root, LIST_LIMIT, Some(&args.query))?;
    let needle = args.query.to_lowercase();
    for feature in features.values() {
        if !feature.title.to_lowercase().contains(&needle) {
            continue;
        }
        for row in store.folder_sessions(&root, &feature.folder)? {
            if !found.iter().any(|known| known.id == row.id) {
                found.push(row);
            }
        }
    }
    found.sort_by_key(|row| std::cmp::Reverse(row.updated_at));
    Ok(SessionSearch {
        rows: rows(&runner, &features, found),
    })
}
