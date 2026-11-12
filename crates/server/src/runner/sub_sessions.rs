//! The sub-sessions of a workflow run: every sub-agent of a run is a session Uraeda starts, on
//! the agent, model, and effort its role is set to, as the run options decision says. And
//! `run_agent`, the tool a workflow session starts its implementers with, each in its task's
//! worktree.
//!
//! A sub-session is a session of its parent's feature, with its `parent` and `role`, titled by
//! its task: it never becomes its feature's latest session, works beside its feature's other
//! sessions, and stops with its parent.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use tokio::sync::watch;
use uraeda_core::api;

use super::event::Origin;
use super::manager::{Runner, State};
use super::picks::Picked;
use super::processes::uuid;
use super::running::{Shown, Starting, latest_of};
use super::session::{NewSession, Session};
use super::turn::{Turn, TurnKind, TurnState};
use crate::live::Fault;
use crate::mcp::RunAgent;
use crate::runtimes::{Outgoing, When};

/// The tool calls of each parent that wait for their sub-session.
#[derive(Default)]
pub(super) struct Calls {
    /// How many, by the parent.
    counts: HashMap<String, usize>,
    /// What halts each parent's counted calls, when its turn halts.
    halts: HashMap<String, Vec<(u64, watch::Sender<bool>)>>,
    next: u64,
}

/// A tool call of a parent, counted while it waits: its turn's watchdog waits meanwhile.
pub(super) struct Counted {
    runner: Runner,
    parent: String,
    id: u64,
}

impl Drop for Counted {
    fn drop(&mut self) {
        let mut state = self.runner.state();
        let calls = &mut state.subs;
        if let Some(count) = calls.counts.get_mut(&self.parent) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                calls.counts.remove(&self.parent);
            }
        }
        if let Some(halts) = calls.halts.get_mut(&self.parent) {
            halts.retain(|(id, _)| *id != self.id);
            if halts.is_empty() {
                calls.halts.remove(&self.parent);
            }
        }
    }
}

/// The sub-session to start: its task, or what it reviews, its worktree, its message, its
/// pick, and whether its message runs the agent's own review.
pub(super) struct SubStart {
    pub about: String,
    pub cwd: PathBuf,
    pub message: String,
    pub pick: Picked,
    pub review: bool,
}

/// What names a sub-session in an answer.
fn named(row: &Session) -> String {
    let role = row.role.as_deref().unwrap_or("sub-agent");
    let about = row.title.as_deref().unwrap_or("its task");
    format!("The {role} of {about}")
}

/// Whether a call starts a turn of a sub-session whose latest turn is `last`: its first, or
/// once its latest stopped or failed without a continue to wait for.
fn runs_again(last: Option<&Turn>) -> bool {
    last.is_none_or(|last| {
        matches!(last.state, TurnState::Stopped | TurnState::Failed) && last.continue_at.is_none()
    })
}

impl Runner {
    /// Whether a sub-session of `parent` works, or waits to continue: the parent's own
    /// continue waits for them, or it would call its tools again before they answered.
    pub(super) fn subs_work(&self, state: &State, parent: &str) -> bool {
        let store = self.store();
        let subs = store.sub_sessions(parent).unwrap_or_default();
        if subs.is_empty() {
            return false;
        }
        let waiting = store.pending_continues().unwrap_or_default();
        subs.iter().any(|sub| {
            let live = state.lives.sessions.get(&sub.id);
            live.is_some_and(super::live::Live::working)
                || waiting.iter().any(|turn| turn.session_id == sub.id)
        })
    }

    /// Whether a sub-session works, or waits to continue.
    pub(crate) fn sub_works(&self, sub: &str) -> bool {
        let waiting = self.store().pending_continues().unwrap_or_default();
        let state = self.state();
        let live = state.lives.sessions.get(sub);
        live.is_some_and(super::live::Live::working)
            || waiting.iter().any(|turn| turn.session_id == sub)
    }

    /// Whether `parent` waits for its sub-sessions: one of its calls waits for its answer, or
    /// one works or waits to continue. Its turn's watchdog waits meanwhile.
    pub(super) fn subs_busy(&self, state: &State, parent: &str) -> bool {
        state
            .subs
            .counts
            .get(parent)
            .is_some_and(|count| *count > 0)
            || self.subs_work(state, parent)
    }

    /// Counts a tool call of `parent` while it waits: what ends the count, and what says the
    /// parent's turn halted meanwhile, even when the agent never cancels the call.
    pub(super) fn counted(&self, parent: &str) -> (Counted, watch::Receiver<bool>) {
        let mut state = self.state();
        let calls = &mut state.subs;
        calls.next += 1;
        let id = calls.next;
        *calls.counts.entry(parent.to_owned()).or_default() += 1;
        let (halt, halted) = watch::channel(false);
        calls
            .halts
            .entry(parent.to_owned())
            .or_default()
            .push((id, halt));
        let counted = Counted {
            runner: self.clone(),
            parent: parent.to_owned(),
            id,
        };
        (counted, halted)
    }

    /// Stops the parent's sub-sessions that work or wait to continue, whatever their role:
    /// their calls answer an error. The parent's counted calls are halted too.
    pub(super) fn stop_subs(&self, state: &mut State, parent: &str) {
        for (_, halt) in state.subs.halts.get(parent).into_iter().flatten() {
            halt.send_replace(true);
        }
        for row in self.store().sub_sessions(parent).unwrap_or_default() {
            self.live_of(state, &row);
            self.stop_run(state, &row.id);
        }
    }

    /// The sub-session of `parent` as `role` for `about`, when a start made it.
    fn find_sub(&self, parent: &str, role: &str, about: &str) -> Result<Option<Session>, Fault> {
        let subs = self.store().sub_sessions(parent)?;
        let found = subs
            .into_iter()
            .find(|sub| sub.role.as_deref() == Some(role) && sub.title.as_deref() == Some(about));
        Ok(found)
    }

    /// Starts a sub-session of `parent`'s feature, as `role`, and sends it its message as a
    /// workflow turn of its parent's step: the sub-session. A second start of the same parent,
    /// role, and task starts no session: it gives the first one, with a new turn of it once
    /// that one stopped or failed without a continue to wait for.
    pub(super) fn start_sub(
        &self,
        parent: &str,
        role: &str,
        start: SubStart,
    ) -> Result<Session, Fault> {
        // Under the manager's lock: two starts of the same task make one session.
        let row = {
            let _one = self.state();
            match self.find_sub(parent, role, &start.about)? {
                Some(found) => found,
                None => {
                    let from = self.store().session(parent)?;
                    let none = || Fault::refused(format!("no session {parent} of a feature"));
                    let from = from.filter(|from| from.folder.is_some()).ok_or_else(none)?;
                    self.store().create_session(
                        NewSession {
                            repo: from.repo,
                            folder: from.folder,
                            parent: Some(parent.to_owned()),
                            role: Some(role.to_owned()),
                            step: None,
                            worktree: Some(start.cwd.to_string_lossy().into_owned()),
                            agent: start.pick.agent,
                            native_id: uuid(),
                            title: Some(start.about),
                            model: start.pick.model,
                            effort: start.pick.effort,
                        },
                        self.now(),
                    )?
                }
            }
        };
        self.begin_sub(&row, &start.message, start.review)?;
        Ok(row)
    }

    /// Starts a turn of a sub-session, its first, or a new one once its latest stopped or
    /// failed without a continue to wait for: its process opens in its worktree, and the turn
    /// takes its parent's step and trigger. Nothing while it works or waits to continue, or
    /// once it ended done: the call answers that turn's end. A first turn that cannot start
    /// removes the sub-session, which has nothing to show.
    pub(super) fn begin_sub(&self, row: &Session, text: &str, review: bool) -> Result<(), Fault> {
        self.serial(row, || {
            let store = self.store();
            if store.session(&row.id)?.is_none() {
                return Err(Fault::refused(format!("{} did not start.", named(row))));
            }
            let turns = store.turns(&row.id)?;
            {
                let mut state = self.state();
                let live = self.live_of(&mut state, row);
                if live.working() || !runs_again(latest_of(&turns, None)) {
                    return Ok(());
                }
                live.starting = true;
            }
            let opened = self.open(&row.id, None);
            let mut state = self.state();
            if let Some(live) = state.lives.get(&row.id) {
                live.starting = false;
            }
            let begun = opened.and_then(|opened| {
                let (step, trigger) = self.parent_turn(&mut state, row.parent.as_deref());
                let id = uuid();
                let starting = Starting {
                    kind: TurnKind::Workflow,
                    trigger,
                    step,
                    allowed: None,
                    caught_up_to: None,
                    lines: opened.line.into_iter().collect(),
                    after: Vec::new(),
                    shown: Shown {
                        origin: Origin::Workflow,
                        text: text.to_owned(),
                        opening: None,
                        images: Vec::new(),
                    },
                    message: Outgoing {
                        id,
                        text: text.to_owned(),
                        images: Vec::new(),
                        when: When::Queue,
                        review,
                    },
                };
                self.begin(&mut state, &row.id, starting)
            });
            if begun.is_err() {
                // A sub-session that never started a turn goes: the task asked again starts a
                // new one.
                let _ = store.remove_empty_session(&row.id);
                state.lives.prune(&row.id);
            }
            begun.map(|_| ())
        })
    }

    /// The step and trigger of the parent's turn: its running one, else its latest workflow
    /// turn.
    fn parent_turn(
        &self,
        state: &mut State,
        parent: Option<&str>,
    ) -> (Option<String>, Option<String>) {
        let Some(parent) = parent else {
            return (None, None);
        };
        let store = self.store();
        let running = state.lives.get(parent).and_then(|live| live.turn.as_ref());
        let running = running.and_then(|turn| store.turn(turn.id).ok()?);
        let turn = running.or_else(|| {
            let turns = store.turns(parent).ok()?;
            turns
                .into_iter()
                .rev()
                .find(|turn| turn.kind == TurnKind::Workflow)
        });
        turn.map_or((None, None), |turn| (turn.step, turn.trigger))
    }

    /// Resolves once a session no longer works: its turn, and the turns queued after it,
    /// ended, and the continue of the last one decided.
    pub(super) async fn idle(&self, session: &str) {
        loop {
            // A turn's end settles once its continue is decided.
            let last = self.store().turns(session).ok();
            if let Some(last) = last.and_then(|turns| turns.last().map(|turn| turn.id)) {
                self.settled(last).await;
            }
            let next = {
                let mut state = self.state();
                match state.lives.get(session).filter(|live| live.working()) {
                    None => return,
                    Some(live) => {
                        let running = live.turn.as_ref().map(|turn| turn.id);
                        running.or_else(|| live.queue.front().map(|queued| queued.id))
                    }
                }
            };
            match next {
                Some(turn) => self.settled(turn).await,
                // Its process opens: a turn follows.
                None => tokio::time::sleep(Duration::from_millis(20)).await,
            }
        }
    }

    /// A sub-session's answer: the last text of its latest turn, or why that turn did not end
    /// done, with the last text it gave, which may hold its whole report.
    pub(super) fn answer(&self, row: &Session) -> Result<String, String> {
        let store = self.store();
        let turns = store.turns(&row.id).map_err(|error| error.to_string())?;
        let name = named(row);
        let Some(turn) = latest_of(&turns, None) else {
            return Err(format!("{name} did not start."));
        };
        let said = store
            .last_text(turn.id)
            .map_err(|error| error.to_string())?;
        if turn.state == TurnState::Done {
            return Ok(said.unwrap_or_default());
        }
        let why = match &turn.reason {
            Some(reason) => format!("{name} {}: {reason}", turn.state.name()),
            None => format!("{name} {}.", turn.state.name()),
        };
        Err(match said.filter(|said| !said.is_empty()) {
            Some(said) => format!("{why}\nIts last message:\n{said}"),
            None => why,
        })
    }

    /// Runs `run_agent` for the workflow session `parent`: an implementer of the task in its
    /// worktree, on the feature's implementers' pick. A worktree that is not one of the
    /// repository's, or is its main checkout, or a change's or a feature's, is refused. A
    /// task asked again goes to its sub-session, before the worktree and the pick are read.
    /// Once the parent's turn halts while the call checks its worktree, it starts no
    /// implementer. The call dropped gives the wait up, the sub-session left working.
    pub(super) async fn run_agent(self, parent: String, input: RunAgent) -> Result<String, String> {
        let (_counted, halted) = self.counted(&parent);
        let runner = self.clone();
        let begun =
            tokio::task::spawn_blocking(move || runner.begin_agent(&parent, &input, &halted));
        let sub = match begun.await {
            Ok(begun) => begun.map_err(|fault| fault.message().to_owned())?,
            Err(_) => return Err("The implementer could not start.".to_owned()),
        };
        self.idle(&sub.id).await;
        let runner = self.clone();
        let answered = tokio::task::spawn_blocking(move || runner.answer(&sub));
        answered
            .await
            .unwrap_or_else(|_| Err("The implementer's answer was lost.".to_owned()))
    }

    /// Finds or starts the implementer of a task: its sub-session, with a turn running when
    /// one was to start.
    fn begin_agent(
        &self,
        parent: &str,
        input: &RunAgent,
        halted: &watch::Receiver<bool>,
    ) -> Result<Session, Fault> {
        let row = self.store().session(parent)?;
        let only = || Fault::refused("Only a workflow session of a feature starts implementers.");
        let row = row.filter(|row| row.parent.is_none()).ok_or_else(only)?;
        let folder = row.folder.clone().ok_or_else(only)?;
        // The same task again answers its sub-session, wherever the call says it works.
        if let Some(found) = self.find_sub(parent, "implementer", &input.task)? {
            self.begin_sub(&found, &input.prompt, false)?;
            return Ok(found);
        }
        let cwd = task_worktree(&row.repo, &folder, &input.worktree)?;
        // Stop listed the parent's sub-sessions while the worktree was checked: start none
        // after.
        if *halted.borrow() {
            let task = &input.task;
            let refusal = format!("The run stopped before the implementer of {task} started.");
            return Err(Fault::refused(refusal));
        }
        let pick = self.implementer_pick(&row.repo, &folder)?;
        let start = SubStart {
            about: input.task.clone(),
            cwd,
            message: input.prompt.clone(),
            pick,
            review: false,
        };
        self.start_sub(parent, "implementer", start)
    }
}

/// The worktree `given` names, by its real path: refused unless it is the absolute path of a
/// linked worktree of the repository whose main checkout is `root`, there now, as `git
/// worktree list` gives them, and not the worktree of a change or a feature, which has its
/// branch: the parent's own, or another's. Its branch is one made from the feature `folder`'s,
/// named after it, as `<feature-branch>-task-N`: another feature's task is refused.
fn task_worktree(root: &str, folder: &str, given: &str) -> Result<PathBuf, Fault> {
    let refuse = |why: &str| {
        Fault::refused(format!(
            "{given} {why}: give the path of the task's worktree, from git worktree list."
        ))
    };
    if !Path::new(given).is_absolute() {
        return Err(refuse("is not an absolute path"));
    }
    let not_one = || refuse("is not a worktree of this repository");
    let real = fs::canonicalize(given).map_err(|_| not_one())?;
    if fs::canonicalize(root).is_ok_and(|main| main == real) {
        return Err(refuse("is the main checkout, not a worktree of a task"));
    }
    let worktrees = api::git_page(Path::new(root))?.worktrees;
    let listed = worktrees
        .iter()
        .filter(|worktree| worktree.state != "missing");
    let listed: Vec<_> = listed
        .map(|worktree| {
            let real = fs::canonicalize(Path::new(root).join(&worktree.path)).ok();
            (worktree, real)
        })
        .collect();
    let found = listed.iter().find(|(_, path)| path.as_ref() == Some(&real));
    let (found, _) = found.ok_or_else(not_one)?;
    if let Some(of) = &found.folder {
        return Err(refuse(&format!("is the worktree of {of}, not of a task")));
    }
    let feature = listed
        .iter()
        .find(|(worktree, _)| worktree.folder.as_deref() == Some(folder));
    let feature = feature.and_then(|(worktree, _)| worktree.branch.clone());
    let on_task = feature.as_ref().is_some_and(|feature| {
        let branch = found.branch.as_deref().unwrap_or_default();
        branch.starts_with(&format!("{feature}-"))
    });
    if !on_task {
        let of = feature.unwrap_or_else(|| folder.to_owned());
        return Err(refuse(&format!(
            "is not on a task branch of {of}, named after it"
        )));
    }
    Ok(real)
}
