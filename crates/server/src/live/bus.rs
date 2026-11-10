//! The bus: where a domain says what changed, and the records the engine holds for it.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use tokio::runtime::Handle;
use uraeda_protocol::Record;

use super::fault::Fault;
use super::registry::Registry;
use super::subscription::Subscriber;
use super::topic::{Append, KEPT_IDLE, Topic};
use super::{Key, locked};
use crate::shared::Shared;

/// Where a domain says that a record changed. It can be called from any thread, a watcher's or a
/// handler's, and never waits: the engine reads and sends on its own tasks.
///
/// A record is named by its type and its arguments, the ones a client subscribes with. Nothing
/// happens for a record nobody holds.
#[derive(Clone)]
pub struct Bus(pub(super) Arc<Engine>);

impl Bus {
    /// A record changed: the engine reads it again, and sends each subscriber the change from
    /// the value it holds. Several calls within the pace are one read, of the latest value.
    pub fn changed<R: Record>(&self, args: &R::Args) {
        if let Some(topic) = self.0.found::<R>(args) {
            topic.changed();
        }
    }

    /// Every record of this name changed, whatever its arguments: each one somebody holds is
    /// read again.
    pub fn changed_all<R: Record>(&self) {
        let named = |topic: &&Arc<Topic>| topic.id().0 == R::NAME;
        let topics: Vec<_> = locked(&self.0.topics)
            .values()
            .filter(named)
            .cloned()
            .collect();
        topics.iter().for_each(Topic::changed);
    }

    /// Every record of this name whose arguments `of` accepts changed, as each record of one
    /// repository: each one somebody holds is read again.
    pub fn changed_where<R: Record>(&self, of: impl Fn(&R::Args) -> bool) {
        let chosen = |topic: &&Arc<Topic>| {
            let args = serde_json::from_value::<R::Args>(topic.args().clone());
            topic.id().0 == R::NAME && args.is_ok_and(|args| of(&args))
        };
        let topics: Vec<_> = locked(&self.0.topics)
            .values()
            .filter(chosen)
            .cloned()
            .collect();
        topics.iter().for_each(Topic::changed);
    }

    /// A text of a record grew, with no read: the text at `path` was `at` bytes long, and `text`
    /// came after it. Store the text first, then say it here.
    ///
    /// `at` makes a late or a repeated call harmless: a value that already holds the text, as
    /// after a read, is left as it is, and one that does not fit is read again.
    pub fn append<R: Record>(&self, args: &R::Args, path: &[&str], at: usize, text: &str) {
        if text.is_empty() {
            return;
        }
        if let Some(topic) = self.0.found::<R>(args) {
            topic.append(Append {
                path: path.iter().map(|&step| step.to_owned()).collect(),
                at,
                text: text.to_owned(),
            });
        }
    }
}

/// The engine's state: the handlers, and each record somebody holds, or held a moment ago.
pub(super) struct Engine {
    pub registry: Registry,
    /// The server's runtime: the bus is also called from threads outside it.
    pub runtime: Handle,
    /// The server's shared state, for the handlers: none once the server stopped.
    shared: Mutex<Option<Shared>>,
    topics: Mutex<HashMap<(&'static str, Key), Arc<Topic>>>,
    /// The number a new record's changes start from: above every number a forgotten record
    /// used, so a `resume` never takes a new record's changes for the ones it missed.
    floor: AtomicU64,
}

impl Engine {
    /// The engine of a server, on the runtime it starts in.
    pub(super) fn start(shared: &Shared, registry: Registry) -> Arc<Engine> {
        Arc::new(Engine {
            registry,
            runtime: Handle::current(),
            shared: Mutex::new(Some(shared.clone())),
            topics: Mutex::default(),
            floor: AtomicU64::new(0),
        })
    }

    /// The server's shared state, until the server stops.
    pub(super) fn shared(&self) -> Option<Shared> {
        locked(&self.shared).clone()
    }

    /// Subscribes to a record, by its name and its arguments as a client sent them: the record,
    /// held already or new, and what `Topic::join` gives.
    pub(super) fn join(
        self: &Arc<Self>,
        record: &str,
        args: Value,
        subscriber: Subscriber,
    ) -> Result<(Arc<Topic>, u64), Fault> {
        let reader = self.registry.reader(record)?;
        let (key, args) = (reader.keyed)(args)?;
        // Under the list's lock, so a record is not forgotten between its finding and its join.
        let mut topics = locked(&self.topics);
        let topic = topics.entry((reader.name, key.clone())).or_insert_with(|| {
            let seq = self.floor.load(Ordering::Relaxed);
            Topic::new(self, reader, key, args, seq)
        });
        let need = topic.join(subscriber);
        Ok((topic.clone(), need))
    }

    /// The record of these arguments, when somebody holds it.
    fn found<R: Record>(&self, args: &R::Args) -> Option<Arc<Topic>> {
        match Key::of(args) {
            Ok((key, _)) => locked(&self.topics).get(&(R::NAME, key)).cloned(),
            Err(error) => {
                eprintln!(
                    "uraeda: the arguments of `{}` are not JSON: {error}",
                    R::NAME
                );
                None
            }
        }
    }

    /// Forgets a record nobody subscribed to for a while after its last subscriber left.
    pub(super) fn forget_later(self: &Arc<Self>, topic: Arc<Topic>, rests: u64) {
        let engine = Arc::downgrade(self);
        self.runtime.spawn(async move {
            tokio::time::sleep(KEPT_IDLE).await;
            if let Some(engine) = engine.upgrade() {
                engine.forget(&topic, Some(rests));
            }
        });
    }

    /// Forgets a record: one whose read failed, or, with `rests`, one nobody subscribed to since
    /// its last subscriber left for the `rests`th time.
    pub(super) fn forget(&self, topic: &Arc<Topic>, rests: Option<u64>) {
        let mut topics = locked(&self.topics);
        let Some(seq) = topic.rests(rests) else {
            return;
        };
        let id = topic.id();
        if topics.get(&id).is_some_and(|held| Arc::ptr_eq(held, topic)) {
            topics.remove(&id);
            self.floor.fetch_max(seq + 1, Ordering::Relaxed);
        }
    }

    /// Lets go of everything, as the server stops: the handlers, the records, and the shared
    /// state, which holds the bus.
    pub(super) fn close(&self) {
        locked(&self.shared).take();
        locked(&self.topics).clear();
        self.registry.clear();
    }
}
