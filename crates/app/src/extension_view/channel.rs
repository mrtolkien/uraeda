//! The host's side of a page's channel on Linux: what the page posts and calls, carried between
//! its engine and the app. How the host knows the page broke is `page_watch.rs`'s, which a
//! browser's frame follows too: this hands it what the page posts, and ticks it.
//!
//! The handlers run on the page engine's thread, and tell the app through the component's
//! events, which any thread may emit. The rest runs on the main thread.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use nsh_engine::{HostChannel, HostReply};
use nsh_platform_linux::ComponentContext;
use serde_json::{Value, json};
use uraeda_protocol::PAGE_HOST;

use crate::page_watch::{Heard, PING_MS, Watch};

/// How often the host pings a running page.
pub(super) const PING: Duration = Duration::from_millis(PING_MS);

/// The messages the app answers for the page, with what NSH's channel names them.
const ANSWERED: [&str; 3] = ["record", "call", "navigate"];

/// What the host knows of the page running now, and its calls. Each load starts the watch again.
#[derive(Default)]
pub(super) struct Live {
    watch: Watch,
    /// The page's calls, waiting for the app's answer, by the number given to the app.
    replies: HashMap<u64, HostReply>,
    /// The number of the next call, counted across loads: the app may answer a call of the page
    /// before after the next one asked, and its number must name no call of the new page.
    next_call: u64,
}

/// What the page's handlers and the component share.
#[derive(Clone)]
pub(super) struct Channel {
    live: Arc<Mutex<Live>>,
    /// Where the watch's clock starts.
    born: Instant,
    context: ComponentContext,
    host: HostChannel,
}

impl Channel {
    /// Answers the page's channel of `host`, telling the app through `context`.
    pub(super) fn answer(host: HostChannel, context: ComponentContext) -> Channel {
        let channel = Channel {
            live: Arc::default(),
            born: Instant::now(),
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

    /// Now, in milliseconds of the watch's clock.
    fn now(&self) -> f64 {
        self.born.elapsed().as_secs_f64() * 1000.0
    }

    /// A page of `version` loads: what was known of the one before goes, with its calls, whose
    /// numbers are not given again.
    pub(super) fn loading(&self, version: u64) {
        let now = self.now();
        let mut live = self.live();
        live.watch.loading(version, now);
        live.replies.clear();
    }

    /// Tells the app a problem of the page, `kind` as `uraeda/extensions/host.tsx` reads it.
    pub(super) fn problem(&self, kind: &str, message: &str) {
        let version = self.live().watch.version();
        let problem = json!({ "kind": kind, "message": message, "version": version });
        self.context.emit("problem", problem);
    }

    /// One message of the page, on its engine's thread.
    fn heard(&self, name: &str, mut call: nsh_engine::HostCall) {
        let data = call.take_data();
        if ANSWERED.contains(&name) {
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
        let now = self.now();
        let heard = self.live().watch.heard(name, &data, now);
        self.act(heard);
        if !call.is_post() {
            call.resolve(Value::Null);
        }
    }

    /// Does what the watch said.
    fn act(&self, heard: Heard) {
        if heard.show {
            let _ = self.host.send("show", Value::Null);
        }
        if let Some(declarations) = heard.ready {
            let version = self.live().watch.version();
            let ready = json!({ "declarations": declarations, "version": version });
            self.context.emit("ready", ready);
        }
        if let Some((kind, message)) = heard.problem {
            self.problem(kind, &message);
        }
        if let Some(number) = heard.ping {
            self.send("ping", Value::from(number));
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
        let now = self.now();
        let heard = self.live().watch.tick(now);
        self.act(heard);
    }
}
