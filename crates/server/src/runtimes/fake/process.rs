//! One fake process: the steps queued for it, the task that plays them in order, and how it
//! reacts to what a session tells a process.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tokio::sync::{Notify, watch};

use super::script::{Script, Step, Work};
use super::{Inner, rule, target};
use crate::live::locked;
use crate::process::Signal;
use crate::runner::{Denial, Event, ToolKind};
use crate::runtimes::{AgentProcess, Emitter, Events, Options, Outgoing, events};

/// What the task plays: a step, or the result the fake ends a turn with itself.
enum Play {
    Step(Step),
    End,
}

/// A queued step, and the message whose turn it is of.
struct Queued {
    play: Play,
    message: Option<String>,
}

#[derive(Default)]
struct State {
    queue: VecDeque<Queued>,
    /// Its `exit` is queued, or sent: nothing more is.
    exited: bool,
}

/// What a fake process and the task that plays it share.
pub(super) struct Core {
    fake: Arc<Inner>,
    options: Options,
    emitter: Emitter,
    state: Mutex<State>,
    /// Told when a step is queued.
    queued: Notify,
    /// Moves on each cut: the step being awaited ends there.
    cut: watch::Sender<u64>,
    /// Whether the fake still counts the process as running.
    counted: AtomicBool,
}

impl Core {
    /// Queues a step, behind those queued before it: dropped once the process's `exit` is.
    pub(super) fn push(&self, step: Step) {
        self.queue(Play::Step(step), None);
    }

    fn queue(&self, play: Play, message: Option<&str>) {
        let mut state = locked(&self.state);
        if state.exited {
            return;
        }
        state.exited = matches!(play, Play::Step(Step::Event(Event::Exit { .. })));
        let message = message.map(str::to_owned);
        state.queue.push_back(Queued { play, message });
        self.queued.notify_one();
    }

    fn has_exited(&self) -> bool {
        locked(&self.state).exited
    }

    /// The next step to play, and the cut it was taken at: none once the process exited and
    /// everything queued was played.
    async fn next(&self) -> Option<(Play, u64)> {
        loop {
            {
                let mut state = locked(&self.state);
                if let Some(next) = state.queue.pop_front() {
                    return Some((next.play, *self.cut.borrow()));
                }
                if state.exited {
                    return None;
                }
            }
            self.queued.notified().await;
        }
    }

    /// Waits until the step taken at `taken` is cut short.
    async fn cut_since(&self, taken: u64) {
        let mut cut = self.cut.subscribe();
        let _ = cut.wait_for(|now| *now != taken).await;
    }

    /// Drops what is queued, but what `keep` keeps, and cuts short the step being awaited.
    fn cut(&self, keep: impl Fn(&Play) -> bool) {
        let mut state = locked(&self.state);
        state.queue.retain(|queued| keep(&queued.play));
        self.cut.send_modify(|cut| *cut += 1);
    }

    /// The fake counts the process as running no more.
    fn ended(&self) {
        if self.counted.swap(false, Ordering::SeqCst) {
            self.fake.running.fetch_sub(1, Ordering::SeqCst);
        }
    }

    /// Sends an event: whether the stream took it. The `exit` is the last one.
    fn emit(&self, event: Event) -> bool {
        if matches!(event, Event::Exit { .. }) {
            self.ended();
        }
        self.emitter.send(event)
    }

    /// Ends the process as a step that failed: nothing queued is played.
    fn fail(&self, why: String) {
        let mut state = locked(&self.state);
        state.queue.clear();
        state.exited = true;
        drop(state);
        self.emit(Event::Exit {
            code: Some(1),
            missing: None,
            stderr: why,
        });
    }

    /// Plays the action an agent tries: the tool call, and whether its permissions blocked it.
    fn attempt(&self, id: String, denial: Denial) -> Option<Denial> {
        let allowed = rule(&denial).is_some_and(|rule| self.options.allowed.contains(&rule));
        self.emit(Event::ToolStart {
            id: id.clone(),
            input: denial.input.clone(),
            kind: ToolKind::Other,
            name: denial.tool.clone(),
            parent: None,
            subagent: None,
            target: target(&denial).map(str::to_owned),
        });
        let output = if allowed {
            String::new()
        } else {
            format!("Permission to use {} has been denied.", denial.tool)
        };
        self.emit(Event::ToolEnd {
            id,
            is_error: !allowed,
            output,
        });
        (!allowed).then_some(denial)
    }

    /// Runs a test's own step in the process's directory, unless it is cut short first.
    async fn run(&self, work: Work, taken: u64) {
        let cwd = self.options.cwd.clone();
        let running = tokio::task::spawn_blocking(move || work(&cwd));
        let failure = tokio::select! {
            done = running => match done {
                Ok(done) => done.err(),
                Err(_) => Some("the step panicked".to_owned()),
            },
            () = self.cut_since(taken) => None,
        };
        if let Some(why) = failure.filter(|_| *self.cut.borrow() == taken) {
            self.fail(why);
        }
    }
}

/// Plays a process's steps in order, until its `exit` is sent or its reader is gone.
pub(super) async fn play(core: Arc<Core>) {
    // The actions blocked in the running turn, which its result names.
    let mut denials = Vec::new();
    while let Some((play, taken)) = core.next().await {
        let taken_by_reader = match play {
            Play::Step(Step::Event(event)) => {
                if matches!(event, Event::Result { .. }) {
                    denials.clear();
                }
                core.emit(event)
            }
            Play::Step(Step::Wait(wait)) => {
                tokio::select! {
                    () = tokio::time::sleep(wait) => {}
                    () = core.cut_since(taken) => {}
                }
                true
            }
            Play::Step(Step::Try { id, denial }) => {
                denials.extend(core.attempt(id, denial));
                true
            }
            Play::Step(Step::Run(work)) => {
                core.run(work, taken).await;
                true
            }
            Play::End => core.emit(Event::Result {
                cost_usd: None,
                denials: std::mem::take(&mut denials),
                errors: Vec::new(),
                interrupted: false,
                models: None,
                ok: true,
            }),
        };
        if !taken_by_reader {
            break;
        }
    }
    core.ended();
}

/// A session's process on the fake runtime.
pub(super) struct Process {
    core: Arc<Core>,
    events: Option<Events>,
}

impl Process {
    /// A process opened with `options`, and the task that plays it.
    pub(super) fn open(fake: Arc<Inner>, options: Options) -> (Process, Arc<Core>) {
        let (emitter, stream) = events();
        fake.running.fetch_add(1, Ordering::SeqCst);
        let core = Arc::new(Core {
            fake,
            options,
            emitter,
            state: Mutex::default(),
            queued: Notify::new(),
            cut: watch::Sender::new(0),
            counted: AtomicBool::new(true),
        });
        tokio::spawn(play(core.clone()));
        let process = Process {
            core: core.clone(),
            events: Some(stream),
        };
        (process, core)
    }

    /// Queues the turn a message plays: its `accepted`, the script, and a result of the fake's
    /// own unless the script ends the turn itself.
    fn turn(&self, id: &str, script: Script) {
        let ends_itself = script.ends_itself();
        let accepted = Event::Accepted { id: id.to_owned() };
        self.core.queue(Play::Step(Step::Event(accepted)), Some(id));
        for step in script.0 {
            self.core.queue(Play::Step(step), Some(id));
        }
        if !ends_itself {
            self.core.queue(Play::End, Some(id));
        }
    }

    /// Ends the process as a signal does, with the exit code a shell gives it.
    fn exit(&self, code: i32) {
        self.core.push(Step::Event(Event::Exit {
            code: Some(code),
            missing: None,
            stderr: String::new(),
        }));
    }
}

impl AgentProcess for Process {
    fn events(&mut self) -> Events {
        self.events.take().unwrap_or_else(Events::ended)
    }

    /// Records the message, and plays the next scripted turn, else the fallback's: with
    /// neither, nothing plays, and the turn is the test's to `emit`.
    fn send(&self, message: Outgoing) {
        locked(&self.core.fake.seen).sent.push(message.clone());
        if self.core.has_exited() {
            return;
        }
        if let Some(script) = self.core.fake.script_for(&message) {
            self.turn(&message.id, script);
        }
    }

    /// Drops the steps not played yet, and ends the turn as interrupted, unless it is stuck.
    fn interrupt(&self) {
        locked(&self.core.fake.seen).interrupts += 1;
        if self.core.fake.behaviour().ignore_interrupt || self.core.has_exited() {
            return;
        }
        self.core.cut(|_| false);
        self.core.push(Step::Event(Event::Result {
            cost_usd: None,
            denials: Vec::new(),
            errors: Vec::new(),
            interrupted: true,
            models: None,
            ok: false,
        }));
    }

    /// `SIGKILL` ends it; `SIGTERM` too, unless it ignores it; `SIGINT` too, unless it is
    /// stuck. Each drops the steps not played yet.
    fn kill(&self, signal: Signal) {
        locked(&self.core.fake.seen).kills.push(signal);
        let behaviour = self.core.fake.behaviour();
        let (ignored, code) = match signal {
            Signal::Interrupt => (behaviour.ignore_interrupt, 130),
            Signal::Terminate => (behaviour.ignore_term, 143),
            Signal::Kill => (false, 137),
        };
        if ignored || self.core.has_exited() {
            return;
        }
        self.core.cut(|_| false);
        self.exit(code);
    }

    /// Records the take-back. A message whose turn has not begun is taken back: its steps are
    /// dropped, and its `cancelled` sent. One the agent read stays read.
    fn take_back(&self, id: &str) {
        locked(&self.core.fake.seen).taken_back.push(id.to_owned());
        let unread = |queued: &Queued| matches!(&queued.play, Play::Step(Step::Event(Event::Accepted { id: read })) if read == id);
        let mut state = locked(&self.core.state);
        if !state.queue.iter().any(unread) {
            return;
        }
        state
            .queue
            .retain(|queued| queued.message.as_deref() != Some(id));
        drop(state);
        self.core.emit(Event::Cancelled { id: id.to_owned() });
    }

    /// Records the effort, and says what it runs on from now, unless the fake cannot change
    /// its effort.
    fn set_effort(&self, effort: Option<&str>) -> bool {
        let behaviour = self.core.fake.behaviour();
        if !behaviour.sets_effort {
            return false;
        }
        let effort = effort.map(str::to_owned);
        locked(&self.core.fake.seen).efforts.push(effort.clone());
        if behaviour.reports_runs_on {
            let model = self.core.options.model.as_deref();
            let runs_on = super::runs_on(&behaviour.models, model, effort.as_deref());
            self.core.push(Step::Event(runs_on));
        }
        true
    }

    /// Ends it after the events it already wrote, cutting its waits short, unless it ignores
    /// its stdin's end.
    fn close(&self) {
        locked(&self.core.fake.seen).closes += 1;
        if self.core.fake.behaviour().ignore_close || self.core.has_exited() {
            return;
        }
        self.core.cut(|play| match play {
            Play::Step(step) => step.is_written(),
            Play::End => true,
        });
        self.exit(0);
    }
}

/// A process nobody holds any more is killed: its task ends with it.
impl Drop for Process {
    fn drop(&mut self) {
        if !self.core.has_exited() {
            self.core.cut(|_| false);
            self.exit(137);
        }
    }
}
