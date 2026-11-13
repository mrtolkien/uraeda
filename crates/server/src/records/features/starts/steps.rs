//! A start's steps, as its write in the queue shows them: each waiting, running, done, or
//! refused, with when it started and the seconds it took, and the commit's with what git and the
//! hooks print.

use std::cell::RefCell;
use std::time::{SystemTime, UNIX_EPOCH};

use uraeda_core::actions::start::StartProgress;
use uraeda_protocol::{StartStep, StepState};

use crate::records::writing::Landing;
use crate::shared::Shared;

/// The commit on the default branch, among a start's steps.
const COMMIT: usize = 0;

/// The branch and its worktree.
const BRANCH: usize = 1;

/// The agent's start, with the start's first run or the messages kept for its folder.
const AGENT: usize = 2;

/// The steps of a start: the commit on the default branch, then the branch and its worktree,
/// whose name is unknown before a typed change's start runs, then the agent, which gets the
/// start's first run, or the messages kept for its folder while it landed.
pub(super) fn of(default_branch: &str, branch: Option<&str>) -> Vec<StartStep> {
    let branching = match branch {
        Some(branch) => format!("Make the branch {branch} and its worktree"),
        None => "Make the branch and its worktree".to_owned(),
    };
    let committing = format!("Commit the proposal on {default_branch}, running your hooks");
    let waiting = |label| StartStep {
        label,
        state: StepState::Waiting,
        started_at: None,
        seconds: None,
        output: None,
    };
    let starting = "Start the agent with your message".to_owned();
    [committing, branching, starting].map(waiting).into()
}

/// The steps of a start as it lands, each change shown in its write. The core's steps move them
/// on; one the core reports once the start settled is ignored: the start's result is its end.
pub(super) struct Progress<'a> {
    landing: &'a Landing<'a>,
    shared: &'a Shared,
    state: RefCell<State>,
}

struct State {
    steps: Vec<StartStep>,
    /// The step that runs, or ran last: none before the first.
    at: Option<usize>,
    /// When that step started.
    since: SystemTime,
    settled: bool,
}

impl<'a> Progress<'a> {
    /// The steps of a start that begins to land: its commit's step runs.
    pub(super) fn begun(
        steps: Vec<StartStep>,
        landing: &'a Landing<'a>,
        shared: &'a Shared,
    ) -> Self {
        let state = State {
            steps,
            at: None,
            since: shared.now(),
            settled: false,
        };
        let progress = Progress {
            landing,
            shared,
            state: RefCell::new(state),
        };
        progress.to(COMMIT);
        progress
    }

    /// Moves on with the core's step: the commit, a line of its output, or the branch, from
    /// where the lists' writes no longer wait for the start.
    pub(super) fn step(&self, step: StartProgress) {
        match step {
            StartProgress::Committing => self.to(COMMIT),
            StartProgress::Branching => {
                self.landing.free_lists();
                self.to(BRANCH);
            }
            StartProgress::Output(line) => self.printed(&line),
            StartProgress::Done => {}
        }
    }

    /// The start ran: its agent starts.
    pub(super) fn agent(&self) {
        self.to(AGENT);
    }

    /// Every step done.
    pub(super) fn done(&self) {
        let mut state = self.state.borrow_mut();
        state.end(self.shared.now(), StepState::Done);
        state.settled = true;
        for step in &mut state.steps {
            step.state = StepState::Done;
        }
        self.show(&state);
    }

    /// The running step refused, the first if none ran, with the refusal as its output when
    /// nothing was printed.
    pub(super) fn refused(&self, output: &str) {
        let mut state = self.state.borrow_mut();
        let at = *state.at.get_or_insert(COMMIT);
        state.steps[at]
            .output
            .get_or_insert_with(|| output.to_owned());
        state.end(self.shared.now(), StepState::Refused);
        state.settled = true;
        self.show(&state);
    }

    /// Ends the running step and those before `index`, done, and runs the step `index`.
    fn to(&self, index: usize) {
        let mut state = self.state.borrow_mut();
        if state.settled || state.at.is_some_and(|at| index <= at) {
            return;
        }
        let now = self.shared.now();
        state.end(now, StepState::Done);
        for skipped in &mut state.steps[..index] {
            skipped.state = StepState::Done;
        }
        (state.at, state.since) = (Some(index), now);
        let step = &mut state.steps[index];
        step.state = StepState::Running;
        step.started_at = Some(milliseconds(now));
        self.show(&state);
    }

    /// Adds a line the commit or its hooks printed to the commit's step, and to the write.
    fn printed(&self, line: &str) {
        let mut state = self.state.borrow_mut();
        if state.settled {
            return;
        }
        let output = state.steps[COMMIT].output.get_or_insert_default();
        if !output.is_empty() {
            output.push('\n');
        }
        output.push_str(line);
        self.landing.printed(line);
        self.show(&state);
    }

    fn show(&self, state: &State) {
        self.landing.steps(state.steps.clone());
    }
}

impl State {
    /// Ends the step that runs, with the seconds it took.
    fn end(&mut self, now: SystemTime, ended: StepState) {
        let took = now.duration_since(self.since).unwrap_or_default();
        let running = self.at.and_then(|at| self.steps.get_mut(at));
        if let Some(step) = running.filter(|step| step.state == StepState::Running) {
            step.state = ended;
            step.seconds = Some(u32::try_from(took.as_secs()).unwrap_or(u32::MAX));
        }
    }
}

/// A time, in milliseconds since 1970.
fn milliseconds(time: SystemTime) -> u64 {
    let since = time.duration_since(UNIX_EPOCH).unwrap_or_default();
    u64::try_from(since.as_millis()).unwrap_or(u64::MAX)
}
