//! The host's side of a page's channel: what the page posts and calls, and how the host knows the
//! page broke. NSH's GTK view tells its host nothing of a page's errors, and the app's runner
//! keeps the process's log, so the page says them itself, and the host watches it answer:
//!
//! - **A throw as it loads**: the build's entry catches it, and posts `problem`.
//! - **A throw as it draws, or in an effect or a listener**: `uraeda/page`'s boundary catches it,
//!   and posts `problem`.
//! - **A call that never ends**: NSH cuts it off after 2 seconds, and the page goes on. The host
//!   pings the page twice a second: a ping answered late says how long the page was held.
//! - **A page that stopped**, out of memory or never started: its pings go unanswered.
//!
//! The handlers run on the page engine's thread, and tell the app through the component's
//! events, which any thread may emit. The rest runs on the main thread.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use nsh_engine::{HostChannel, HostReply};
use nsh_platform_linux::ComponentContext;
use serde_json::{Value, json};
use uraeda_protocol::PAGE_HOST;

/// How long a page's engine has to start, from its load.
const START: Duration = Duration::from_secs(10);

/// How often the host pings a running page.
pub(super) const PING: Duration = Duration::from_millis(500);

/// A ping answered later than this says the page held its engine: under NSH's cut-off of 2
/// seconds, with a ping every half second, a call cut off is always answered after 1.5.
const LATE: Duration = Duration::from_millis(1200);

/// A page that answers no ping for this long has stopped: its engine is gone.
const STOPPED: Duration = Duration::from_secs(5);

/// What a page's boundary catches of a call NSH cut off: QuickJS's interruption.
const CUT_OFF: &str = "InternalError: interrupted";

/// The messages the app answers for the page, with what NSH's channel names them.
const ANSWERED: [&str; 3] = ["record", "call", "navigate"];

/// What the host knows of the page running now. Each load starts it again.
#[derive(Default)]
pub(super) struct Live {
    /// The page's version, its package's build.
    version: u64,
    loaded_at: Option<Instant>,
    started: bool,
    /// The page's code ran to its end: a problem after it is no longer one of its load.
    loaded: bool,
    /// The pings sent and not answered, by number, oldest first.
    pings: VecDeque<(u64, Instant)>,
    next_ping: u64,
    /// The page is gone for good: it threw as it loaded, or stopped. Nothing is watched then.
    over: bool,
    /// The page's calls, waiting for the app's answer, by the number given to the app.
    replies: HashMap<u64, HostReply>,
    next_call: u64,
}

/// What the page's handlers and the component share.
#[derive(Clone)]
pub(super) struct Channel {
    live: Arc<Mutex<Live>>,
    context: ComponentContext,
    host: HostChannel,
}

impl Channel {
    /// Answers the page's channel of `host`, telling the app through `context`.
    pub(super) fn answer(host: HostChannel, context: ComponentContext) -> Channel {
        let channel = Channel {
            live: Arc::default(),
            context,
            host,
        };
        for name in PAGE_HOST {
            let handler = channel.clone();
            channel
                .host
                .handle(name, move |call| handler.heard(name, call));
        }
        channel
    }

    fn live(&self) -> MutexGuard<'_, Live> {
        self.live.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// A page of `version` loads: what was known of the one before goes, with its calls.
    pub(super) fn loading(&self, version: u64) {
        *self.live() = Live {
            version,
            loaded_at: Some(Instant::now()),
            ..Live::default()
        };
    }

    /// Tells the app a problem of the page, `kind` as `uraeda/extensions/host.tsx` reads it.
    pub(super) fn problem(&self, kind: &str, message: &str) {
        let version = self.live().version;
        let problem = json!({ "kind": kind, "message": message, "version": version });
        self.context.emit("problem", problem);
    }

    /// One message of the page, on its engine's thread.
    fn heard(&self, name: &str, mut call: nsh_engine::HostCall) {
        let data = call.take_data();
        match name {
            "start" => self.live().started = true,
            "loaded" => {
                self.live().loaded = true;
                let _ = self.host.send("show", Value::Null);
            }
            "ready" => {
                let version = self.live().version;
                let ready = json!({ "declarations": data, "version": version });
                self.context.emit("ready", ready);
            }
            "problem" => {
                let loading = {
                    let mut live = self.live();
                    live.over |= !live.loaded;
                    !live.loaded
                };
                let message = data["message"].as_str().unwrap_or("it threw");
                if message == CUT_OFF {
                    self.problem("slow", "it ran for 2 s without stopping, and was cut off");
                } else {
                    self.problem(if loading { "load" } else { "threw" }, message);
                }
            }
            "alive" => self.alive(data.as_u64()),
            _ if ANSWERED.contains(&name) => {
                let id = if call.is_post() {
                    Value::Null
                } else {
                    let mut live = self.live();
                    let id = live.next_call;
                    live.next_call += 1;
                    if let Some(reply) = call.into_reply() {
                        live.replies.insert(id, reply);
                    }
                    Value::from(id)
                };
                let message = json!({ "id": id, "name": name, "data": data });
                self.context.emit("message", message);
                return;
            }
            _ => {}
        }
        if !call.is_post() {
            call.resolve(Value::Null);
        }
    }

    /// The page answered the ping `number`, and every one before it: one answered late says the
    /// page held its engine that long.
    fn alive(&self, number: Option<u64>) {
        let Some(number) = number else { return };
        let mut late = None;
        {
            let mut live = self.live();
            while live.pings.front().is_some_and(|(sent, _)| *sent <= number) {
                let (_, at) = live.pings.pop_front().expect("a ping, checked above");
                late = late.or(Some(at.elapsed()).filter(|held| *held > LATE));
            }
        }
        if let Some(held) = late {
            let seconds = held.as_secs_f64();
            let message = format!("it kept the app waiting for {seconds:.1} s");
            self.problem("slow", &message);
        }
    }

    /// The app's answer to the page's call `id`.
    pub(super) fn reply(&self, id: u64, answer: Result<Value, String>) {
        let reply = self.live().replies.remove(&id);
        if let Some(reply) = reply {
            reply.reply(answer);
        }
    }

    /// Sends the page an event of the app.
    pub(super) fn send(&self, name: &str, data: Value) {
        let _ = self.host.send(name, data);
    }

    /// Watches the page, on the main thread: pings it, and names it when it stopped.
    pub(super) fn watch(&self) {
        let stopped = {
            let mut live = self.live();
            let Some(loaded_at) = live.loaded_at.filter(|_| !live.over) else {
                return;
            };
            let waited = live.pings.front().map(|(_, at)| at.elapsed());
            if !live.started && loaded_at.elapsed() > START {
                Some(format!(
                    "its engine did not start within {} s",
                    START.as_secs()
                ))
            } else if waited.is_some_and(|waited| waited > STOPPED) {
                Some(format!("it answered nothing for {} s", STOPPED.as_secs()))
            } else {
                if live.started {
                    let number = live.next_ping;
                    live.next_ping += 1;
                    live.pings.push_back((number, Instant::now()));
                    drop(live);
                    self.send("ping", Value::from(number));
                }
                None
            }
        };
        if let Some(message) = stopped {
            self.live().over = true;
            self.problem("stopped", &message);
        }
    }
}
