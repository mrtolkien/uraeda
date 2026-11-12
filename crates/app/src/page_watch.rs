//! How the app knows an extension's page broke, whichever way it runs: in the Linux view
//! (`extension_view/channel.rs`) or in a browser's frame (`app/extensions/host.web.tsx`). Both
//! hand what the page posts to one [`Watch`], and tick it twice a second; it says when the page
//! is drawn, when it broke and how, and when to ping it. Neither host is told a page's errors by
//! its engine, so the page says them itself, and the host watches it answer:
//!
//! - **A throw as it loads**: the build's entry catches it, and posts `problem`.
//! - **A throw as it draws, or in an effect or a listener**: `uraeda/page`'s boundary catches it,
//!   and posts `problem`.
//! - **A call that never ends**: on Linux, NSH cuts it off after 2 seconds, and the page goes
//!   on. A ping answered late says how long the page was held.
//! - **A page that stopped**, out of memory, never started, or, in a browser, looping without
//!   end, which nothing cuts off there: its pings go unanswered.
//!
//! Times are milliseconds on the host's own steady clock, given at each call: the state machine
//! reads no clock, which a browser's WebAssembly has not.

use std::collections::VecDeque;

use nsh_core::prelude::*;
use serde_json::Value;

/// How long a page's engine has to start, from its load.
const START: f64 = 10_000.0;

/// How often the host pings a running page, in milliseconds.
#[cfg_attr(
    not(all(target_os = "linux", feature = "host")),
    allow(dead_code, reason = "the Linux view's")
)]
pub(crate) const PING_MS: u64 = 500;

/// A ping answered later than this says the page held its engine: under NSH's cut-off of 2
/// seconds, with a ping every half second, a call cut off is always answered after 1.5.
const LATE: f64 = 1200.0;

/// A page that answers no ping for this long has stopped: its engine is gone, or held for good.
const STOPPED: f64 = 5000.0;

/// What a page's boundary catches of a call NSH cut off: QuickJS's interruption.
const CUT_OFF: &str = "InternalError: interrupted";

/// What the host knows of the page running now. Each load starts it again.
#[derive(Default)]
pub(crate) struct Watch {
    /// The page's version, its package's build.
    #[cfg_attr(
        not(all(target_os = "linux", feature = "host")),
        allow(dead_code, reason = "the Linux view's")
    )]
    version: u64,
    loaded_at: Option<f64>,
    started: bool,
    /// The page's code ran to its end: a problem after it is no longer one of its load.
    loaded: bool,
    /// The pings sent and not answered, by number, oldest first, with when they were sent.
    pings: VecDeque<(u64, f64)>,
    next_ping: u64,
    /// The page is gone for good: it threw as it loaded, or stopped. Nothing is watched then.
    over: bool,
}

/// What the host does after a message of the page or a tick.
#[derive(Debug, Default, PartialEq)]
pub(crate) struct Heard {
    /// Send the page `show`: its code ran whole.
    pub show: bool,
    /// The page drew its part, and declared these.
    pub ready: Option<Value>,
    /// Tell the app the page's problem: its kind, as `app/extensions/host.tsx` reads it, and why.
    pub problem: Option<(&'static str, String)>,
    /// Send the page this ping.
    pub ping: Option<u64>,
}

impl Watch {
    /// A page of `version` loads, at `now`: what was known of the one before goes.
    pub(crate) fn loading(&mut self, version: u64, now: f64) {
        *self = Watch {
            version,
            loaded_at: Some(now),
            ..Watch::default()
        };
    }

    /// The version of the page loading, or last loaded.
    #[cfg_attr(
        not(all(target_os = "linux", feature = "host")),
        allow(dead_code, reason = "the Linux view's")
    )]
    pub(crate) fn version(&self) -> u64 {
        self.version
    }

    /// One message of the page, `start`, `loaded`, `ready`, `problem`, or `alive`, at `now`.
    pub(crate) fn heard(&mut self, name: &str, data: &Value, now: f64) -> Heard {
        let mut heard = Heard::default();
        match name {
            "start" => self.started = true,
            "loaded" => {
                self.loaded = true;
                heard.show = true;
            }
            "ready" => heard.ready = Some(data.clone()),
            "problem" => {
                let loading = !self.loaded;
                self.over |= loading;
                let message = data["message"].as_str().unwrap_or("it threw");
                heard.problem = Some(if message == CUT_OFF {
                    let said = "it ran for 2 s without stopping, and was cut off";
                    ("slow", said.to_owned())
                } else {
                    (if loading { "load" } else { "threw" }, message.to_owned())
                });
            }
            "alive" => heard.problem = self.alive(data.as_u64(), now),
            _ => {}
        }
        heard
    }

    /// The page answered the ping `number`, and every one before it: one answered late says the
    /// page held its engine that long.
    fn alive(&mut self, number: Option<u64>, now: f64) -> Option<(&'static str, String)> {
        let number = number?;
        let mut late = None;
        while let Some(&(sent, at)) = self.pings.front()
            && sent <= number
        {
            self.pings.pop_front();
            late = late.or(Some(now - at).filter(|held| *held > LATE));
        }
        let held = late? / 1000.0;
        Some(("slow", format!("it kept the app waiting for {held:.1} s")))
    }

    /// Watches the page at `now`, every [`PING_MS`]: a ping to send, or why it stopped.
    pub(crate) fn tick(&mut self, now: f64) -> Heard {
        let mut heard = Heard::default();
        let Some(loaded_at) = self.loaded_at.filter(|_| !self.over) else {
            return heard;
        };
        let waited = self.pings.front().map(|(_, at)| now - at);
        let stopped = if !self.started && now - loaded_at > START {
            Some(format!(
                "its engine did not start within {} s",
                START / 1000.0
            ))
        } else if waited.is_some_and(|waited| waited > STOPPED) {
            Some(format!("it answered nothing for {} s", STOPPED / 1000.0))
        } else {
            None
        };
        if let Some(message) = stopped {
            self.over = true;
            heard.problem = Some(("stopped", message));
        } else if self.started {
            let number = self.next_ping;
            self.next_ping += 1;
            self.pings.push_back((number, now));
            heard.ping = Some(number);
        }
        heard
    }
}

/// What a browser's frame does next, as [`PageWatch`] says it.
#[derive(JsObject)]
pub struct WatchSaid {
    /// Send the page `show`.
    pub show: bool,
    /// What the page declared, once it drew: none before.
    pub ready: Option<Value>,
    /// The page's problem's kind: `load`, `threw`, `slow`, or `stopped`.
    pub problem_kind: Option<String>,
    /// Why, in words.
    pub problem: Option<String>,
    /// The ping to send.
    pub ping: Option<f64>,
}

impl From<Heard> for WatchSaid {
    fn from(heard: Heard) -> WatchSaid {
        let (problem_kind, problem) = heard.problem.map_or((None, None), |(kind, why)| {
            (Some(kind.to_owned()), Some(why))
        });
        #[allow(
            clippy::cast_precision_loss,
            reason = "a ping's number counts half seconds"
        )]
        let ping = heard.ping.map(|number| number as f64);
        WatchSaid {
            show: heard.show,
            ready: heard.ready,
            problem_kind,
            problem,
            ping,
        }
    }
}

/// The watch of one page in a browser's frame, which the frame's host ticks every half second,
/// and hands what the page posts: the rules the Linux view follows.
#[class]
pub struct PageWatch {
    watch: Watch,
}

#[class]
impl PageWatch {
    /// A watch of no page yet.
    pub fn new() -> PageWatch {
        PageWatch {
            watch: Watch::default(),
        }
    }

    /// A page of `version` loads, at `now`, in milliseconds of the host's steady clock.
    pub fn loading(&mut self, version: f64, now: f64) {
        #[allow(
            clippy::cast_possible_truncation,
            clippy::cast_sign_loss,
            reason = "a build counts saves"
        )]
        self.watch.loading(version as u64, now);
    }

    /// The page posted `name`, with `data`, at `now`.
    pub fn heard(&mut self, name: String, data: Value, now: f64) -> WatchSaid {
        self.watch.heard(&name, &data, now).into()
    }

    /// Half a second passed: at `now`, a ping to send, or why the page stopped.
    pub fn tick(&mut self, now: f64) -> WatchSaid {
        self.watch.tick(now).into()
    }
}
