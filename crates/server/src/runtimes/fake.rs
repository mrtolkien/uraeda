//! The fake runtime: an agent for tests and the sandbox, which runs nothing.
//!
//! It records each open and each message, and plays the turns scripted for it as messages are
//! sent: see [`Script`] for what a turn is made of.
//!
//! ```ignore
//! let fake = Fake::new();
//! fake.script(serde_json::from_value::<Script>(json!([
//!     { "type": "textDelta", "text": "Reading " },
//!     { "wait": 400 },
//!     { "type": "text", "text": "Reading the README." },
//! ]))?);
//! runtimes::register(&shared, "fake", Arc::new(fake.clone()))?;
//! ```
//!
//! - **A message plays the next scripted turn**, else the turn [`Fake::fallback`] gives for
//!   it, as an agent that answers anything. With neither it plays nothing: the test says each
//!   event with [`Fake::emit`], and the turn stays open until it emits a `result`.
//! - **A turn is** the message's `accepted`, the script's steps in order, then a successful
//!   `result`, unless the script ends itself with a `result` or an `exit`.
//! - **A process reacts** as an agent's does. An interrupt drops the steps not played yet and
//!   ends the turn with an interrupted `result`, keeping the process. A close plays what was
//!   written, without its waits, then exits with code 0. A kill drops everything and exits
//!   with the signal's code: 130, 143, or 137. A take-back cancels a message whose turn has not
//!   begun. Each can be ignored, as a stuck process does: see [`Behaviour`].
//! - **Waits are on tokio's clock**, so a test that pauses it waits for nothing.
//! - **It needs tokio**: `open` starts the task that plays the process, which ends with it.

mod accounts;
mod process;
mod script;

use std::collections::{BTreeSet, VecDeque};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, Weak};

pub use script::{Script, Step, Work};
use uraeda_protocol::{AgentModel, Capabilities, ModelDefaults, ModelEffort, ModelList};

use super::{
    Account, Accounts, AgentProcess, Options, Outgoing, ReviewAsk, ReviewMessage, Runtime,
    RuntimeError,
};
use crate::live::locked;
use crate::process::Signal;
use crate::runner::{Denial, Event};
use process::{Core, Process};

/// The turn a fake plays for a message no script waits for: none to play nothing.
type Fallback = Arc<dyn Fn(&Outgoing) -> Option<Script> + Send + Sync>;

/// The agent's own review, as a test sets it.
pub type Review = Arc<dyn Fn(&ReviewAsk) -> ReviewMessage + Send + Sync>;

/// What the fake says of itself and how its processes behave, which a test changes with
/// [`Fake::set`].
#[derive(Clone)]
pub struct Behaviour {
    /// Its name for people: "Fake agent".
    pub name: String,
    /// Its kind: "fake".
    pub kind: String,
    pub icon: String,
    pub capabilities: Capabilities,
    /// Whether the agent is available, for `version`.
    pub installed: bool,
    /// The sessions that have a transcript: each one it opened, until a test removes it.
    pub sessions: BTreeSet<String>,
    /// Keeps a turn going after the interrupt and `SIGINT`, as a stuck process would.
    pub ignore_interrupt: bool,
    /// Keeps a process running after its close, as one that ignores its stdin's end would.
    pub ignore_close: bool,
    /// Keeps a process running after `SIGTERM`: only `SIGKILL` ends it.
    pub ignore_term: bool,
    /// The model list `models` gives.
    pub models: ModelList,
    /// Makes `models` fail, as an agent down or too slow would.
    pub models_fail: bool,
    /// Whether its processes change their effort: without it, they are reopened.
    pub sets_effort: bool,
    /// Whether a process says `init` as it opens, with its own session id: else a test emits
    /// it.
    pub auto_init: bool,
    /// Whether a process says what it runs on, by the names of the model list, as it opens and
    /// as its effort changes, as a real agent does.
    pub reports_runs_on: bool,
    /// The agent's own review: none by default.
    pub review: Option<Review>,
    /// The accounts it lists, as last asked: none by default, and then it offers none.
    pub accounts: Vec<Account>,
    /// What its accounts say needs the human.
    pub account_problems: Vec<String>,
    /// The accounts that hold no transcript of a session opened in another.
    pub apart: BTreeSet<String>,
}

impl Default for Behaviour {
    fn default() -> Behaviour {
        Behaviour {
            name: "Fake agent".to_owned(),
            kind: "fake".to_owned(),
            icon: "uraeda:harness-agent".to_owned(),
            capabilities: Capabilities {
                approvals: false,
                images: true,
                queue: true,
                steer: true,
                subagents: true,
                take_back: true,
            },
            installed: true,
            sessions: BTreeSet::new(),
            ignore_interrupt: false,
            ignore_close: false,
            ignore_term: false,
            models: models(),
            models_fail: false,
            sets_effort: true,
            auto_init: true,
            reports_runs_on: false,
            review: None,
            accounts: Vec::new(),
            account_problems: Vec::new(),
            apart: BTreeSet::new(),
        }
    }
}

/// The fake's model list: a model taking every effort from Low to Max, its default at Medium,
/// and one taking none.
pub fn models() -> ModelList {
    let efforts = ["low", "medium", "high", "xhigh", "max"].map(|id| ModelEffort {
        id: id.to_owned(),
        name: effort_name(id).to_owned(),
    });
    let big = AgentModel {
        id: "fake-big".to_owned(),
        name: "Fake Big".to_owned(),
        description: Some("The fake's large model".to_owned()),
        efforts: efforts.to_vec(),
    };
    let small = AgentModel {
        id: "fake-small".to_owned(),
        name: "Fake Small".to_owned(),
        description: None,
        efforts: Vec::new(),
    };
    ModelList {
        defaults: ModelDefaults {
            model: Some("fake-big".to_owned()),
            effort: Some("medium".to_owned()),
        },
        models: vec![big, small],
    }
}

/// An effort's name for people, by its id.
fn effort_name(id: &str) -> &str {
    match id {
        "low" => "Low",
        "medium" => "Medium",
        "high" => "High",
        "xhigh" => "Extra high",
        "max" => "Max",
        other => other,
    }
}

/// What a process on `model` at `effort` says it runs on, by the list's names: the list's
/// defaults for what was not picked, and no effort for a model that takes none.
fn runs_on(list: &ModelList, model: Option<&str>, effort: Option<&str>) -> Event {
    let id = model.or(list.defaults.model.as_deref());
    let model = list
        .models
        .iter()
        .find(|model| Some(model.id.as_str()) == id);
    let efforts = model.map_or(&[][..], |model| &model.efforts);
    let ran = effort.or(list.defaults.effort.as_deref());
    let effort = efforts
        .iter()
        .find(|effort| Some(effort.id.as_str()) == ran);
    let name = model.map(|model| model.name.as_str()).or(id);
    Event::RunsOn {
        model: name.unwrap_or("Fake Big").to_owned(),
        effort: effort.map(|effort| effort.name.clone()),
    }
}

/// What a blocked action is about: its command, its file, or its address.
fn target(denial: &Denial) -> Option<&str> {
    let keys = ["command", "file_path", "url"];
    keys.iter().find_map(|key| denial.input.get(*key)?.as_str())
}

/// The fake's rule for one blocked action: `Tool(target)`, or the tool alone, and none for a
/// target with a `*` or a line break, which no rule matches alone.
fn rule(denial: &Denial) -> Option<String> {
    let Some(target) = target(denial) else {
        return Some(denial.tool.clone());
    };
    let narrow = !target.contains(['*', '\n']);
    narrow.then(|| format!("{}({target})", denial.tool))
}

/// What the fake recorded of what it was told.
#[derive(Default)]
struct Seen {
    opens: Vec<Options>,
    sent: Vec<Outgoing>,
    taken_back: Vec<String>,
    interrupts: usize,
    closes: usize,
    kills: Vec<Signal>,
    efforts: Vec<Option<String>>,
}

/// What a fake and its processes share.
struct Inner {
    behaviour: Mutex<Behaviour>,
    seen: Mutex<Seen>,
    scripts: Mutex<VecDeque<Script>>,
    fallback: Mutex<Option<Fallback>>,
    /// The process opened last, which `emit` speaks on.
    current: Mutex<Weak<Core>>,
    running: AtomicUsize,
    model_asks: AtomicUsize,
    account_asks: AtomicUsize,
    /// The accounts as the last refresh read them: the behaviour's before one.
    asked: Mutex<Option<Vec<Account>>>,
}

impl Inner {
    fn behaviour(&self) -> Behaviour {
        locked(&self.behaviour).clone()
    }

    /// The turn a message plays: the next scripted one, else the fallback's.
    fn script_for(&self, message: &Outgoing) -> Option<Script> {
        if let Some(script) = locked(&self.scripts).pop_front() {
            return Some(script);
        }
        let fallback = locked(&self.fallback).clone();
        fallback.and_then(|fallback| fallback(message))
    }
}

/// The fake runtime. A clone is the same fake: register one, and keep one to script it.
#[derive(Clone)]
pub struct Fake(Arc<Inner>);

impl Default for Fake {
    fn default() -> Fake {
        Fake::new()
    }
}

impl Fake {
    /// A fake that is installed, lists two models, and plays nothing until it is scripted.
    pub fn new() -> Fake {
        Fake(Arc::new(Inner {
            behaviour: Mutex::default(),
            seen: Mutex::default(),
            scripts: Mutex::default(),
            fallback: Mutex::default(),
            current: Mutex::default(),
            running: AtomicUsize::new(0),
            model_asks: AtomicUsize::new(0),
            account_asks: AtomicUsize::new(0),
            asked: Mutex::default(),
        }))
    }

    /// Queues a turn, played when a message is sent: one message plays one turn, in the order
    /// they were queued.
    pub fn script(&self, script: impl Into<Script>) {
        locked(&self.0.scripts).push_back(script.into());
    }

    /// The turn played for a message when no turn is scripted, as an agent that answers
    /// anything: none plays nothing.
    pub fn fallback(&self, turn: impl Fn(&Outgoing) -> Option<Script> + Send + Sync + 'static) {
        *locked(&self.0.fallback) = Some(Arc::new(turn));
    }

    /// Changes what the fake says of itself, or how its processes behave, from now on.
    pub fn set(&self, change: impl FnOnce(&mut Behaviour)) {
        change(&mut locked(&self.0.behaviour));
    }

    /// Sends an event on the process opened last, after what is queued for it.
    pub fn emit(&self, event: Event) {
        if let Some(current) = locked(&self.0.current).upgrade() {
            current.push(Step::Event(event));
        }
    }

    /// Ends the process opened last, as one that exits by itself.
    pub fn exit(&self, code: i32, stderr: &str) {
        self.emit(Event::Exit {
            code: Some(code),
            missing: None,
            stderr: stderr.to_owned(),
        });
    }

    /// How each process was opened.
    pub fn opens(&self) -> Vec<Options> {
        locked(&self.0.seen).opens.clone()
    }

    /// Every message sent, to any of its processes.
    pub fn sent(&self) -> Vec<Outgoing> {
        locked(&self.0.seen).sent.clone()
    }

    /// The ids of the messages a take-back named.
    pub fn taken_back(&self) -> Vec<String> {
        locked(&self.0.seen).taken_back.clone()
    }

    /// How many interrupts its processes got.
    pub fn interrupts(&self) -> usize {
        locked(&self.0.seen).interrupts
    }

    /// How many closes its processes got.
    pub fn closes(&self) -> usize {
        locked(&self.0.seen).closes
    }

    /// Every signal its processes got.
    pub fn kills(&self) -> Vec<Signal> {
        locked(&self.0.seen).kills.clone()
    }

    /// Each effort its processes were changed to.
    pub fn efforts(&self) -> Vec<Option<String>> {
        locked(&self.0.seen).efforts.clone()
    }

    /// How many times its models were asked for.
    pub fn model_asks(&self) -> usize {
        self.0.model_asks.load(Ordering::SeqCst)
    }

    /// How many times its accounts' usage was asked for.
    pub fn account_asks(&self) -> usize {
        self.0.account_asks.load(Ordering::SeqCst)
    }

    /// How many of its processes have not exited: each has a task that plays it.
    pub fn running(&self) -> usize {
        self.0.running.load(Ordering::SeqCst)
    }
}

impl Runtime for Fake {
    fn name(&self) -> String {
        self.0.behaviour().name
    }

    fn kind(&self) -> String {
        self.0.behaviour().kind
    }

    fn icon(&self) -> String {
        self.0.behaviour().icon
    }

    fn capabilities(&self) -> Capabilities {
        self.0.behaviour().capabilities
    }

    /// Records the open, keeps a transcript for the session, and starts the process: it says
    /// `init` with the session's id, then what it runs on when the fake reports it.
    fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        locked(&self.0.seen).opens.push(options.clone());
        let behaviour = {
            let mut behaviour = locked(&self.0.behaviour);
            behaviour.sessions.insert(options.native_id.clone());
            behaviour.clone()
        };
        let (process, core) = Process::open(self.0.clone(), options.clone());
        *locked(&self.0.current) = Arc::downgrade(&core);
        if behaviour.auto_init {
            core.push(Step::Event(Event::Init {
                session_id: options.native_id,
                problem: None,
            }));
        }
        if behaviour.reports_runs_on {
            let (model, effort) = (options.model.as_deref(), options.effort.as_deref());
            core.push(Step::Event(runs_on(&behaviour.models, model, effort)));
        }
        Box::new(process)
    }

    /// A session the fake opened, in any account but those that hold no other's transcripts.
    fn has_session(&self, native_id: &str, account: Option<&str>) -> bool {
        let behaviour = locked(&self.0.behaviour);
        let apart = account.is_some_and(|account| behaviour.apart.contains(account));
        behaviour.sessions.contains(native_id) && !apart
    }

    fn accounts(&self) -> Option<Arc<dyn Accounts>> {
        let listed = !locked(&self.0.behaviour).accounts.is_empty();
        listed.then(|| Arc::new(accounts::Scripted(self.0.clone())) as Arc<dyn Accounts>)
    }

    fn allow_rule(&self, denial: &Denial) -> Option<String> {
        rule(denial)
    }

    fn version(&self) -> Option<String> {
        let installed = locked(&self.0.behaviour).installed;
        installed.then(|| "0.0.0 (fake agent)".to_owned())
    }

    fn models(&self) -> Result<Option<ModelList>, RuntimeError> {
        self.0.model_asks.fetch_add(1, Ordering::SeqCst);
        let behaviour = self.0.behaviour();
        if behaviour.models_fail {
            let why = "the fake agent cannot list its models";
            return Err(RuntimeError::Failed(why.to_owned()));
        }
        Ok(Some(behaviour.models))
    }

    fn review_message(&self, ask: &ReviewAsk) -> Option<ReviewMessage> {
        let review = locked(&self.0.behaviour).review.clone();
        review.map(|review| review(ask))
    }
}
