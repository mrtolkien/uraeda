//! One extension's VM: QuickJS on a thread of its own, with a limit on its memory and on the
//! time each piece of its code runs. Nothing else of the server touches QuickJS: another
//! engine replaces this file (ruling R4).
//!
//! - **The thread owns everything.** The engine, the extension's timers, and the calls waiting
//!   for an answer live on the VM's thread, and go with it. The server talks to it through
//!   [`Vm`], a handle any thread holds: it sends a command, and waits for the answer, or not.
//! - **Code runs in pieces.** A piece is one command, or one timer, and the promise jobs it
//!   leaves. Each has a time limit, 2 seconds for the activation and 10 for anything after it,
//!   which the engine's interrupt handler enforces: a piece that runs over it is cut off, and
//!   the VM ends, as it does for a timer's callback that throws and for a rejection nothing
//!   handles.
//! - **Nothing unwinds out of the thread.** A panic of the engine, or of the server's own code
//!   under it, is caught at the thread's edge and ends this VM alone, as a failure with its
//!   words.
//! - **What the extension's code reaches is the [`Host`]'s**: one operation at a time, by name,
//!   with JSON both ways. The prelude, the modules of `api/`, builds the server API over it.

mod machine;

use std::any::Any;
use std::cell::RefCell;
use std::collections::BTreeSet;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value;

use self::machine::Machine;
use crate::live::locked;

/// How long an extension's files and its activation may run.
pub(crate) const ACTIVATION: Duration = Duration::from_secs(2);

/// How long a piece of an extension's code may run once it is loaded, and how long a call
/// waits for its answer.
pub(crate) const CALL: Duration = Duration::from_secs(10);

/// The most memory a VM's values take: an allocation past it throws in the extension.
const MEMORY: usize = 256 * 1024 * 1024;

/// The deepest an extension's calls nest, in bytes of stack: past it, the call throws.
const STACK: usize = 1024 * 1024;

/// The stack of a VM's thread, well above what its engine may use of it.
const THREAD_STACK: usize = 8 * 1024 * 1024;

/// How long a VM told to stop has to end, and how long past its limit an activation is waited
/// for: only a host operation that blocks takes that long.
const PATIENCE: Duration = Duration::from_secs(5);

/// What an extension's code threw: its message, and its stack when it had one.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct Thrown {
    pub message: String,
    pub stack: String,
}

impl Thrown {
    fn of(message: impl Into<String>) -> Thrown {
        Thrown {
            message: message.into(),
            stack: String::new(),
        }
    }
}

/// Why a call into a VM gave no value.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum CallError {
    /// The extension's code threw, or rejected, with these words.
    Threw(String),
    /// No answer came in time: the call goes on, no longer waited for.
    NoAnswer,
    /// The VM ended before it answered.
    Unloaded,
}

/// How a VM ended, once it was loaded.
#[derive(Debug)]
pub(crate) enum End {
    /// It was told to stop.
    Stopped,
    /// Its code ran over its time, threw where nothing waited for an answer, or its engine
    /// failed.
    Failed(Thrown),
}

/// What an extension's code reaches of the server, one operation at a time. It lives on the
/// VM's thread, and is released there when the VM ends, however it ends.
pub(crate) trait Host: Send + 'static {
    /// Runs the operation `op` on its payload: its answer, or the words the extension's code
    /// is thrown.
    fn op(&mut self, vm: &Vm, op: &str, payload: Value) -> Result<Value, String>;

    /// Releases everything the VM started through this host: called once, as the VM ends.
    fn release(&mut self);
}

/// What the VM's thread is told.
enum Command {
    /// A call into the extension, the prelude's `call`: answered through `reply`, or not at
    /// all.
    Call {
        payload: Value,
        reply: Option<SyncSender<Result<Value, String>>>,
    },
    /// Anything else the prelude dispatches: a process's line, a fetch's answer.
    Dispatch {
        kind: &'static str,
        payload: Value,
    },
    Stop,
}

/// The limits the engine's interrupt handler reads, from the VM's thread, and the server
/// sets, from any.
struct Limits {
    started: Instant,
    /// The end of the piece that runs, in nanoseconds since `started`: 0 for none.
    deadline: AtomicU64,
    /// The piece that runs ran over its time.
    cut: AtomicBool,
    stop: AtomicBool,
}

impl Limits {
    fn begin(&self, limit: Duration) {
        let end = self.started.elapsed() + limit;
        let nanos = u64::try_from(end.as_nanos()).unwrap_or(u64::MAX);
        self.deadline.store(nanos.max(1), Ordering::SeqCst);
    }

    /// Ends the piece: whether it was cut off.
    fn end(&self) -> bool {
        self.deadline.store(0, Ordering::SeqCst);
        self.cut.load(Ordering::SeqCst)
    }

    /// Whether the code that runs must stop now: the engine asks as it runs.
    fn over(&self) -> bool {
        if self.stop.load(Ordering::Relaxed) {
            return true;
        }
        let deadline = self.deadline.load(Ordering::Relaxed);
        let now = u64::try_from(self.started.elapsed().as_nanos()).unwrap_or(u64::MAX);
        let over = deadline != 0 && now >= deadline;
        if over {
            self.cut.store(true, Ordering::SeqCst);
        }
        over
    }
}

struct Inner {
    name: String,
    commands: Sender<Command>,
    limits: Limits,
    /// Ends when the thread does: taken by the one stop that waits for it.
    ended: Mutex<Option<Receiver<()>>>,
    /// The events the extension listens to.
    listens: Mutex<BTreeSet<String>>,
    ids: AtomicU64,
}

/// A running VM, as the server holds it: a handle, cheap to clone, for any thread.
#[derive(Clone)]
pub(crate) struct Vm(Arc<Inner>);

impl Vm {
    /// Starts the VM of the extension `name` on a thread of its own, loads `graph`, its
    /// compiled files as the prelude's `activate` takes them, and calls its entry's default
    /// export: within 2 seconds, or it is cut off. `on_end` is called once, on the VM's thread,
    /// if a VM that loaded ends by itself.
    ///
    /// # Errors
    ///
    /// What the files or the activation threw, that they ran over their time, or that the
    /// engine failed: the VM is gone, with everything it started.
    pub(crate) fn start(
        name: &str,
        graph: Value,
        host: Box<dyn Host>,
        tasks: tokio::runtime::Handle,
        on_end: impl FnOnce(End) + Send + 'static,
    ) -> Result<Vm, Thrown> {
        let (commands, received) = mpsc::channel();
        let (done, ended) = mpsc::sync_channel::<()>(1);
        let (loaded, started) = mpsc::sync_channel(1);
        let vm = Vm(Arc::new(Inner {
            name: name.to_owned(),
            commands,
            limits: Limits {
                started: Instant::now(),
                deadline: AtomicU64::new(0),
                cut: AtomicBool::new(false),
                stop: AtomicBool::new(false),
            },
            ended: Mutex::new(Some(ended)),
            listens: Mutex::default(),
            ids: AtomicU64::new(0),
        }));
        let running = vm.clone();
        let thread = std::thread::Builder::new()
            .name(format!("vm:{name}"))
            .stack_size(THREAD_STACK);
        let spawned = thread.spawn(move || {
            let _tokio = tasks.enter();
            let load = Load { graph, loaded };
            run(&running, host, &received, load, Box::new(on_end));
            drop(done);
        });
        if let Err(error) = spawned {
            return Err(Thrown::of(format!("its VM could not start: {error}")));
        }
        let loaded = match started.recv_timeout(ACTIVATION + PATIENCE) {
            Ok(loaded) => loaded,
            // Only a host's operation that blocks holds a VM past its limit.
            Err(RecvTimeoutError::Timeout) => Err(over(ACTIVATION, "to load")),
            Err(RecvTimeoutError::Disconnected) => Err(Thrown::of("its VM ended without a word")),
        };
        if loaded.is_err() {
            vm.stop();
        }
        loaded.map(|()| vm)
    }

    /// The extension's name.
    pub(crate) fn name(&self) -> &str {
        &self.0.name
    }

    /// A number no other of this VM's has: a process's, a call's.
    pub(crate) fn next_id(&self) -> u64 {
        self.0.ids.fetch_add(1, Ordering::Relaxed) + 1
    }

    /// Calls into the extension, and waits for its answer, at most `limit`: from a blocking
    /// thread, never from a task. `payload` is the prelude's `call`, with its `what`.
    pub(crate) fn call(&self, payload: Value, limit: Duration) -> Result<Value, CallError> {
        let (reply, answer) = mpsc::sync_channel(1);
        let reply = Some(reply);
        if self
            .0
            .commands
            .send(Command::Call { payload, reply })
            .is_err()
        {
            return Err(CallError::Unloaded);
        }
        match answer.recv_timeout(limit) {
            Ok(Ok(value)) => Ok(value),
            Ok(Err(message)) => Err(CallError::Threw(message)),
            Err(RecvTimeoutError::Timeout) => Err(CallError::NoAnswer),
            Err(RecvTimeoutError::Disconnected) => Err(CallError::Unloaded),
        }
    }

    /// Calls into the extension without waiting: what it throws is printed under its name.
    pub(crate) fn tell(&self, payload: Value) {
        let reply = None;
        let _ = self.0.commands.send(Command::Call { payload, reply });
    }

    /// Hands the extension something it waits for: a process's line, a fetch's answer.
    pub(crate) fn dispatch(&self, kind: &'static str, payload: Value) {
        let _ = self.0.commands.send(Command::Dispatch { kind, payload });
    }

    /// Notes that the extension listens to an event.
    pub(crate) fn listen(&self, event: &str) {
        locked(&self.0.listens).insert(event.to_owned());
    }

    /// Whether the extension listens to an event.
    pub(crate) fn listens(&self, event: &str) -> bool {
        locked(&self.0.listens).contains(event)
    }

    /// Tells the VM to stop, whatever its code is doing, without waiting for it.
    pub(crate) fn halt(&self) {
        self.0.limits.stop.store(true, Ordering::SeqCst);
        let _ = self.0.commands.send(Command::Stop);
    }

    /// Stops the VM, whatever its code is doing, and waits for its thread to end: everything it
    /// started is released there. A VM already stopped is left alone.
    pub(crate) fn stop(&self) {
        self.halt();
        let ended = locked(&self.0.ended).take();
        let late =
            |ended: Receiver<()>| ended.recv_timeout(PATIENCE) == Err(RecvTimeoutError::Timeout);
        if ended.is_some_and(late) {
            let name = &self.0.name;
            eprintln!("uraeda: {name}: its VM did not stop in 5 s");
        }
    }
}

/// The words for a piece of code cut off at its limit.
fn over(limit: Duration, doing: &str) -> Thrown {
    Thrown::of(format!("took more than {} s {doing}", limit.as_secs()))
}

/// What a VM loads, and who waits to know it did.
struct Load {
    graph: Value,
    loaded: SyncSender<Result<(), Thrown>>,
}

/// The VM's thread, from its start to its end: nothing unwinds out of it.
fn run(
    vm: &Vm,
    host: Box<dyn Host>,
    commands: &Receiver<Command>,
    load: Load,
    on_end: Box<dyn FnOnce(End) + Send>,
) {
    let host = Rc::new(RefCell::new(host));
    let mut loaded = Some(load.loaded);
    let graph = load.graph;
    let work = AssertUnwindSafe(|| match Machine::start(vm, &host) {
        Ok(mut machine) => machine.run(commands, &graph, &mut loaded),
        Err(thrown) => End::Failed(thrown),
    });
    let end = catch_unwind(work).unwrap_or_else(|panic| {
        let words = panic_words(panic.as_ref());
        End::Failed(Thrown::of(format!("its VM failed: {words}")))
    });
    // After the engine is gone, whatever ended it: a host that panics here ends nothing else.
    let released = catch_unwind(AssertUnwindSafe(|| host.borrow_mut().release()));
    if released.is_err() {
        eprintln!(
            "uraeda: {}: releasing what its VM started failed",
            vm.name()
        );
    }
    match (loaded, end) {
        // It ended while it loaded: whoever started it is told why.
        (Some(loaded), End::Failed(thrown)) => drop(loaded.send(Err(thrown))),
        (Some(loaded), End::Stopped) => {
            let unloaded = Thrown::of("it was unloaded while it loaded");
            drop(loaded.send(Err(unloaded)));
        }
        (None, end) => on_end(end),
    }
}

/// What a panic said.
fn panic_words(panic: &(dyn Any + Send)) -> String {
    let text = panic.downcast_ref::<&str>().map(|text| (*text).to_owned());
    let text = text.or_else(|| panic.downcast_ref::<String>().cloned());
    text.unwrap_or_else(|| "it panicked".to_owned())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    /// A host whose every operation panics, as a bug of the server's under an extension would.
    struct Panics(Arc<AtomicBool>);

    impl Host for Panics {
        fn op(&mut self, _: &Vm, op: &str, _: Value) -> Result<Value, String> {
            panic!("the host's `{op}` is broken");
        }

        fn release(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }

    fn graph(code: &str) -> Value {
        json!({ "entry": "server.ts", "files": { "server.ts": { "code": code, "resolved": {} } } })
    }

    // The extensions decision: a broken extension never stops Uraeda. A panic under an
    // extension's code, the engine's or the server's own, ends that VM alone, with its words:
    // it never unwinds into the thread that started the VM.
    #[test]
    fn a_panic_under_an_extensions_code_ends_its_vm_alone_and_says_why() {
        let tokio = tokio::runtime::Runtime::new().unwrap();
        let released = Arc::new(AtomicBool::new(false));
        let host = Box::new(Panics(released.clone()));
        let code = "__exports.default = (api) => api.log('hello');";

        let started = Vm::start("panics", graph(code), host, tokio.handle().clone(), |_| {});

        let thrown = started.err().expect("the VM did not load");
        assert_eq!(thrown.message, "its VM failed: the host's `log` is broken");
        assert!(
            released.load(Ordering::SeqCst),
            "what it started is released"
        );
    }
}
