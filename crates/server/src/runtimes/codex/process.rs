//! A session's process: one `codex app-server`, its thread, and its turns.
//!
//! Everything a process keeps is one [`Session`], behind one lock: the task that reads Codex's
//! lines and the sessions that send messages each take it, do their step, and leave. So what a
//! line of Codex's leads to, an event, the next request, the turn that waited for an answer,
//! is done before the next line is read, and the order of a process's events never depends on
//! how its lines were cut on their way.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use serde_json::Value;

use super::Setup;
use super::catalog;
use super::events::Reader;
use super::models::Listing;
use super::rpc::{Answer, Read, Rpc};
use super::start::Step;
use super::thread::server_args;
use super::turns::Turns;
use super::wire::Wire;
use crate::live::locked;
use crate::runner::Event;
use crate::runtimes::{
    self, AgentProcess, Child, Emitter, Events, Options, Outgoing, Signal, Spawn,
};
use crate::shared::Shared;

/// What waits for an answer of Codex's.
pub(super) enum Pending {
    Initialize,
    Skills,
    /// A page of `model/list`.
    Page,
    Config,
    /// `thread/start`, or `thread/resume`.
    Thread,
    /// `turn/start`, or `review/start`, of the message of this id, as the turn of this count.
    TurnStart {
        started: u64,
        id: String,
        review: bool,
    },
    Steer(Outgoing),
    Interrupt,
}

/// Everything one process keeps.
pub(super) struct Session {
    pub(super) setup: Arc<Setup>,
    pub(super) options: Options,
    emitter: Emitter,
    pub(super) wire: Wire,
    rpc: Rpc<Pending>,
    /// The answers to give once the step that asked is over: those of requests made after the
    /// channel ended.
    settled: VecDeque<(Pending, Answer)>,
    pub(super) reader: Reader,
    pub(super) step: Step,
    pub(super) listing: Listing,
    /// The agent's default effort, once its models were read.
    pub(super) default_effort: Option<String>,
    pub(super) turns: Turns,
}

impl Session {
    fn new(setup: Arc<Setup>, options: Options, emitter: Emitter) -> Session {
        Session {
            setup,
            emitter,
            wire: Wire::Starting {
                lines: Vec::new(),
                signals: Vec::new(),
                ended: false,
            },
            rpc: Rpc::new(),
            settled: VecDeque::new(),
            reader: Reader::new(&options.cwd.to_string_lossy()),
            step: Step::Initialize,
            listing: Listing::default(),
            default_effort: None,
            turns: Turns::new(options.effort.clone(), options.resume),
            options,
        }
    }

    pub(super) fn push(&self, event: Event) {
        self.emitter.send(event);
    }

    pub(super) fn end_input(&mut self) {
        self.wire.end_input();
    }

    /// Writes a request, `waiting` kept for its answer.
    pub(super) fn request(&mut self, method: &str, params: Value, waiting: Pending) {
        match self.rpc.request(method, params, waiting) {
            Ok(line) => self.wire.write(line),
            Err((waiting, why)) => self.settled.push_back((waiting, Err(why))),
        }
    }

    /// Gives the answers that waited for the running step's end.
    pub(super) fn settle(&mut self) {
        while let Some((waiting, answer)) = self.settled.pop_front() {
            self.answered(waiting, answer);
        }
    }

    /// Reads one line of Codex's: an answer goes to what waited for it, a request of Codex's
    /// gets an error at once, and a notification gives its events.
    fn line(&mut self, line: &str) {
        match self.rpc.read(line) {
            Read::Notification { method, params } => self.heard(&method, &params),
            Read::Answer(waiting, answer) => self.answered(waiting, answer),
            Read::Refused(error) => self.wire.write(error),
            Read::Other => {}
        }
        self.settle();
    }

    fn heard(&mut self, method: &str, params: &Value) {
        for event in self.reader.read(method, params) {
            // The thread's start gives its `init`, once its permissions are checked: Codex's
            // own `thread/started` can come before.
            if matches!(event, Event::Init { .. }) {
                continue;
            }
            let ended = match &event {
                Event::Result { ok, .. } => Some(*ok),
                _ => None,
            };
            self.push(event);
            if let Some(ok) = ended {
                self.turn_ended(ok);
            }
        }
    }

    fn answered(&mut self, waiting: Pending, answer: Answer) {
        match waiting {
            Pending::Initialize => self.introduced(answer),
            Pending::Skills => self.skills_given(answer),
            Pending::Page => {
                let next = self.listing.page(answer);
                self.listed(next);
            }
            Pending::Config => {
                let next = self.listing.config(answer);
                self.listed(next);
            }
            Pending::Thread => self.thread_answered(answer),
            Pending::TurnStart {
                started,
                id,
                review,
            } => self.turn_asked(started, id, review, answer),
            Pending::Steer(message) => self.steered(message, &answer),
            Pending::Interrupt => {}
        }
    }

    /// The process ended: its `exit` is its last event, and what waited for an answer gets
    /// none.
    fn exited(&mut self, exit: Event) {
        let why = match &exit {
            Event::Exit {
                missing: Some(true),
                stderr,
                ..
            } => format!("Codex is not available: {stderr}"),
            _ => "Codex exited".to_owned(),
        };
        self.push(exit);
        for waiting in self.rpc.end(&why) {
            self.settled.push_back((waiting, Err(why.clone())));
        }
        self.settle();
    }
}

/// A session's open process.
pub(super) struct Process {
    session: Arc<Mutex<Session>>,
    events: Option<Events>,
}

/// Opens a session's process: it returns at once, the command starting behind it.
pub(super) fn open(shared: &Shared, setup: Arc<Setup>, options: Options) -> Process {
    let (emitter, events) = runtimes::events();
    let within = setup.start_within;
    let mut session = Session::new(setup, options, emitter);
    session.begin();
    let session = Arc::new(Mutex::new(session));
    let tasks = tokio::runtime::Handle::current();
    tasks.spawn(run(shared.clone(), session.clone()));
    let waiting = Arc::downgrade(&session);
    tasks.spawn(async move {
        tokio::time::sleep(within).await;
        if let Some(session) = Weak::upgrade(&waiting) {
            locked(&session).late(within);
        }
    });
    Process {
        session,
        events: Some(events),
    }
}

/// The arguments of a session's process, once its catalog is known: one that could not be
/// written says so in the session, as Codex's own sub-agents may then run.
async fn arguments(shared: &Shared, session: &Mutex<Session>, command: &str) -> Vec<String> {
    let (setup, options) = {
        let session = locked(session);
        (session.setup.clone(), session.options.clone())
    };
    if options.tools.are_own() {
        return server_args(&options.tools, None);
    }
    let catalog = setup.catalogs.write(shared, command, &options.cwd).await;
    if let Err(problem) = &catalog {
        let text = catalog::notice(problem);
        locked(session).push(Event::Notice { text });
    }
    let path = catalog.ok().map(|path| path.to_string_lossy().into_owned());
    server_args(&options.tools, path.as_deref())
}

/// Runs a session's `codex app-server`, in a process group of its own, from its start to its
/// exit: each line it writes is read as it comes.
async fn run(shared: Shared, session: Arc<Mutex<Session>>) {
    let command = super::command(&shared);
    let args = arguments(&shared, &session, &command).await;
    let (cwd, env) = {
        let session = locked(&session);
        (session.options.cwd.clone(), session.options.tools.env())
    };
    let spawn = Spawn {
        program: command,
        args,
        cwd,
        env,
    };
    let mut child = Child::spawn(&shared, spawn);
    let mut lines = child.lines();
    let child = Arc::new(child);
    locked(&session).wire.start(child.clone());
    let exit = loop {
        tokio::select! {
            biased;
            line = lines.next() => match line {
                Some(line) => locked(&session).line(&line),
                None => break child.exited().await,
            },
            // A command that left the group holds the output open: what was printed is read.
            exit = child.exited() => {
                while let Ok(Some(line)) = tokio::time::timeout(Duration::ZERO, lines.next()).await {
                    locked(&session).line(&line);
                }
                break exit;
            }
        }
    };
    locked(&session).exited(exit);
}

impl AgentProcess for Process {
    fn events(&mut self) -> Events {
        self.events.take().unwrap_or_else(Events::ended)
    }

    fn send(&self, message: Outgoing) {
        let mut session = locked(&self.session);
        session.send(message);
        session.settle();
    }

    fn interrupt(&self) {
        let mut session = locked(&self.session);
        session.interrupt();
        session.settle();
    }

    fn kill(&self, signal: Signal) {
        locked(&self.session).wire.signal(signal);
    }

    fn take_back(&self, id: &str) {
        locked(&self.session).take_back(id);
    }

    /// From its next turn on: Codex takes a turn's effort for the turns after it too.
    fn set_effort(&self, effort: Option<&str>) -> bool {
        let mut session = locked(&self.session);
        session.turns.effort = effort.map(str::to_owned);
        !session.emitter.has_exited()
    }

    fn close(&self) {
        let mut session = locked(&self.session);
        session.close();
        session.settle();
    }
}

/// A process nobody holds ends as a closed one does: its stdin closes.
impl Drop for Process {
    fn drop(&mut self) {
        locked(&self.session).end_input();
    }
}
