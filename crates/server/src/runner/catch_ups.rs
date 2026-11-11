//! The catcher: with the switch on, each open pull request behind the default branch gets its
//! catch-up's run by itself, once per tip of the default branch. It runs on each change of a
//! repository's files, each turn's end there, and each change of the switch.
//!
//! And Continue all, which sends each feature whose run stopped and asks for the human its
//! step's message: both send a feature its step's message from a session.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::FeatureView;
use uraeda_protocol::{ErrorCode, FeatureStatus, RefusedRun, SessionStatus, Trigger};

use super::manager::Runner;
use super::message::catch_up_line;
use super::reads::status_of_feature;
use super::send::{Message, Run};
use super::status::{CATCH_UP, continued_by_all};
use crate::live::Fault;
use crate::records::features::recommend;
use crate::records::settings;

/// What the catcher keeps in memory.
#[derive(Default)]
pub(super) struct Catching {
    /// Each repository's run, by its main checkout: whether one runs, and whether another was
    /// asked meanwhile, which runs once after it.
    runs: HashMap<String, bool>,
    /// The refusals said already, by feature and commit: each is printed once.
    printed: HashSet<(String, String, String)>,
}

/// An automatic run's message: the step it is sent at, what started it, the line its session
/// shows before it, saying why it happened, and the commit it catches up with.
struct Automatic {
    commit: String,
    line: String,
}

/// The trigger a recommended message is sent with, by the workflow's name for it.
fn trigger_name(trigger: Trigger) -> String {
    crate::records::word(&trigger)
}

impl Runner {
    /// Whether the catcher's switch is on, and the server still runs.
    fn catching(&self) -> bool {
        let on = settings::current(&self.shared)
            .runs
            .catch_up_pull_requests
            .in_force;
        on && !self.state().closed
    }

    /// Sends a feature its step's message from `session`, which goes on there, or in the
    /// session its step's options give, whose agent the send checks: nothing when its step
    /// has no message, as at a gate. An automatic run sends it with its own trigger and line,
    /// and only while the feature is still at its step, catching up with its commit: the
    /// default branch moved since, the next trigger catches up with the new tip.
    fn continue_one(
        &self,
        root: &str,
        feature: &FeatureView,
        session: &str,
        automatic: Option<Automatic>,
    ) -> Result<(), Fault> {
        let next = api::next_step(Path::new(root), &feature.folder)?;
        let message = recommend(feature, &next, None);
        let (Some(step), Some(trigger)) = (message.step, message.trigger) else {
            return Ok(());
        };
        let run = match automatic {
            None => Run {
                trigger: trigger_name(trigger),
                step: Some(step),
                ..Run::default()
            },
            Some(automatic) => {
                let tip = next.step.catch_up.as_ref().map(|catch_up| &catch_up.commit);
                if step != CATCH_UP || tip != Some(&automatic.commit) {
                    return Ok(());
                }
                Run {
                    trigger: "catch-up".to_owned(),
                    step: Some(step),
                    fresh: false,
                    line: Some(automatic.line),
                }
            }
        };
        let row = self.row(session)?;
        let input = Message {
            text: message.text,
            workflow: Some(run),
            ..Message::default()
        };
        self.send(&row, input).map(|_| ())
    }

    /// Continue all: sends each feature whose run stopped and asks, or sits at `catch-up` with
    /// no run, its step's message, in its latest session. A feature at a gate, blocked, or at
    /// work is skipped, and so is one whose step has no message. One refused, as while another
    /// session of its worktree works, is left as it was, and returned with why.
    pub(crate) fn continue_all(&self, root: &str) -> Result<Vec<RefusedRun>, Fault> {
        // Refused at once when the repository's runtime is off or gone: each run is checked
        // on its own.
        super::picks::message_runtime(self, root, None, None)?;
        let mut refused = Vec::new();
        for (feature, status) in self.feature_statuses(root) {
            let Some(session) = &status.session else {
                continue;
            };
            if !self.continued_by_all(root, &feature, &status) {
                continue;
            }
            if let Err(fault) = self.continue_one(root, &feature, session, None) {
                // A refusal leaves the feature as it was, still asking: the others go on.
                if fault.code() != ErrorCode::Refused {
                    let why = fault.message();
                    eprintln!("uraeda: Continue all skipped {}: {why}", feature.folder);
                }
                refused.push(RefusedRun {
                    id: feature.folder,
                    name: feature.slug,
                    reason: fault.message().to_owned(),
                });
            }
        }
        Ok(refused)
    }

    /// Whether a feature at `catch-up` already had its catch-up for the tip it reads.
    /// Whether Continue all goes on with a feature of the repository at `root`, whose status
    /// is `status`: what its button counts, and what it sends.
    pub(crate) fn continued_by_all(
        &self,
        root: &str,
        feature: &FeatureView,
        status: &FeatureStatus,
    ) -> bool {
        let asks = status_of_feature(status);
        // A conflict dismissed reads idle, and would be sent again: a catch-up runs once per
        // tip. A run that asks, as one the human stopped, is continued all the same.
        let ran = !asks.continuable() && self.ran_for(root, feature);
        continued_by_all(&asks, &feature.step.name, &feature.step.waits_on) && !ran
    }

    fn ran_for(&self, root: &str, feature: &FeatureView) -> bool {
        let Some(catch_up) = feature.step.catch_up.as_ref() else {
            return false;
        };
        let caught = self
            .store()
            .caught_up(root, &feature.folder, &catch_up.commit);
        feature.step.name == CATCH_UP && caught.unwrap_or(false)
    }

    /// Catches up a listed repository's features: after a change of its files, or a turn's end
    /// there. A repository's runs go one at a time: one asked meanwhile runs once after it, so
    /// two triggers at once start one catch-up.
    pub(crate) fn catch_up(&self, repository: &str) {
        let Ok(root) = self.root_of(repository) else {
            return;
        };
        if !self.catching() {
            return;
        }
        {
            let mut state = self.state();
            if let Some(again) = state.catching.runs.get_mut(&root) {
                *again = true;
                return;
            }
            state.catching.runs.insert(root.clone(), false);
        }
        loop {
            self.catch_up_once(&root);
            let mut state = self.state();
            match state.catching.runs.get_mut(&root) {
                Some(again) if *again => *again = false,
                _ => {
                    state.catching.runs.remove(&root);
                    return;
                }
            }
        }
    }

    /// Catches up every listed repository: the switch changed, or the server started.
    pub(crate) fn catch_up_all(&self) {
        let listed = crate::records::repositories::all(&self.shared);
        for repository in listed.into_iter().filter(|repository| !repository.missing) {
            self.catch_up(&repository.name);
        }
    }

    /// Sends each feature due its catch-up's message, with the line saying why, in its latest
    /// session: at `catch-up`, its latest session idle or with a new reply, and no turn of the
    /// folder caught up with that commit yet, whatever started it. A refusal leaves the
    /// feature, printed once per feature and commit; the next trigger tries again.
    fn catch_up_once(&self, root: &str) {
        for (feature, status) in self.feature_statuses(root) {
            // The switch turned off, or the server stopping, during the run starts no other.
            if !self.catching() {
                return;
            }
            let Some((session, automatic)) = self.due(root, &feature, &status) else {
                continue;
            };
            let commit = automatic.commit.clone();
            let Err(fault) = self.continue_one(root, &feature, &session, Some(automatic)) else {
                continue;
            };
            let key = (root.to_owned(), feature.folder.clone(), commit);
            if self.state().catching.printed.insert(key) {
                let why = fault.message();
                eprintln!(
                    "uraeda: the catch-up of {} was refused: {why}",
                    feature.folder
                );
            }
        }
    }

    /// What a feature catches up with now, and the session it goes on in, when the catcher
    /// starts its run.
    fn due(
        &self,
        root: &str,
        feature: &FeatureView,
        status: &FeatureStatus,
    ) -> Option<(String, Automatic)> {
        let catch_up = feature.step.catch_up.as_ref()?;
        let session = status.session.clone()?;
        let rests = matches!(status.status, SessionStatus::Idle | SessionStatus::Unread);
        if feature.step.name != CATCH_UP || !rests {
            return None;
        }
        let caught = self
            .store()
            .caught_up(root, &feature.folder, &catch_up.commit);
        if caught.unwrap_or(true) {
            return None;
        }
        let automatic = Automatic {
            commit: catch_up.commit.clone(),
            line: catch_up_line(&catch_up.branch, &catch_up.subject),
        };
        Some((session, automatic))
    }
}
