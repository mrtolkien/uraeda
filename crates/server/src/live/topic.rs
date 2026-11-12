//! One record, as its subscribers hold it: its value, the numbered changes that made it, and the
//! one task that reads it again and sends what changed, at a pace.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, Weak};
use std::time::Duration;

use serde_json::Value;
use tokio::time::Instant;
use uraeda_protocol::{Op, Part, Path, apply, diff, get};

use super::bus::Engine;
use super::fault::Fault;
use super::registry::{Reader, blocking};
use super::subscription::Subscriber;
use super::{Key, locked};

/// The pace: a record's changes are sent at most once per frame of a 60 Hz display, and it is
/// read again at most that often.
pub(super) const PACE: Duration = Duration::from_millis(16);

/// How many changes of a record are kept: a subscriber further behind gets the whole value.
const KEPT_CHANGES: usize = 1_000;

/// How long a record nobody reads is kept, for a client that comes back with a `resume`.
pub(super) const KEPT_IDLE: Duration = Duration::from_secs(60);

/// What a subscriber is sent next.
pub(super) enum News {
    /// Nothing yet: it is told again when there is.
    Nothing,
    /// The whole value.
    Whole(Arc<Whole>),
    /// The changes it misses, the first numbered `first`.
    Changes { first: u64, changes: Vec<Vec<Op>> },
    /// The read failed: the subscription is over.
    Ended(Fault),
}

/// A record's whole value as of one change, as every subscriber that needs it is sent it: its JSON
/// is written, and compressed when long, once for all of them. The value is the record's own,
/// shared, not a copy: a large record is held once beside its written part.
pub(super) struct Whole {
    pub seq: u64,
    pub value: Arc<Value>,
    part: OnceLock<Part>,
}

impl Whole {
    /// The value as it is sent, written the first time it is asked for. Compressing a long value
    /// takes milliseconds: a connection asks for it on a blocking thread (`Connection::next_frame`).
    pub(super) fn part(&self) -> &Part {
        self.part.get_or_init(|| Part::of(self.value.as_ref()))
    }

    /// Whether the value was written already.
    pub(super) fn written(&self) -> bool {
        self.part.get().is_some()
    }
}

/// A text that grew: where, from which length, and by what.
pub(super) struct Append {
    pub path: Path,
    pub at: usize,
    pub text: String,
}

/// What an append does to a value.
#[derive(PartialEq, Eq)]
enum Fit {
    /// The text was `at` long, and grew.
    Grew,
    /// The text already holds it: a read brought it first.
    Held,
    /// The text is not there, or is another: only a read tells what it is.
    Apart,
}

impl Append {
    /// Grows the text at its path, unless the value already holds the new text or has another.
    fn onto(&self, value: &mut Value) -> Fit {
        match self.fit(value) {
            Fit::Grew => self.grow(value),
            other => other,
        }
    }

    /// What the append would do to the value, which it leaves as it is: `Grew` where it would grow.
    fn fit(&self, value: &Value) -> Fit {
        let Some(Value::String(held)) = get(value, &self.path) else {
            return Fit::Apart;
        };
        if held.len() == self.at {
            return Fit::Grew;
        }
        match held.get(self.at..) {
            Some(rest) if rest.starts_with(&self.text) => Fit::Held,
            _ => Fit::Apart,
        }
    }

    fn grow(&self, value: &mut Value) -> Fit {
        match apply(value, &[self.op()]) {
            Ok(()) => Fit::Grew,
            Err(_) => Fit::Apart,
        }
    }

    fn op(&self) -> Op {
        Op::Append {
            path: self.path.clone(),
            text: self.text.clone(),
        }
    }
}

/// What the task does once the pace lets it.
enum Step {
    /// Read the record again.
    Read,
    /// The appends waiting were sent.
    Sent,
    /// Nothing to do, or nobody to do it for: the task ends.
    Rest,
}

/// One record of the engine: a name and arguments, read for whoever subscribes.
pub(super) struct Topic {
    reader: Reader,
    key: Key,
    args: Value,
    engine: Weak<Engine>,
    state: Mutex<State>,
}

struct State {
    /// The value, with every operation of `log` and `pending` applied: none before the first read.
    value: Option<Arc<Value>>,
    /// The value as the subscribers that need it whole are sent it, until it changes.
    whole: Option<Arc<Whole>>,
    /// The number of the last change sent.
    seq: u64,
    /// The last changes sent, the newest last: the change `seq` is its last one.
    log: VecDeque<Vec<Op>>,
    /// The operations applied to the value and not sent yet: the next change.
    pending: Vec<Op>,
    /// How many times the record was said to have changed.
    said: u64,
    /// `said` as the latest read began: the record is read again while more was said since.
    began: u64,
    /// `said` as the latest read that ended began: the value holds every change said before.
    read: u64,
    /// The appends applied since the read in flight began, which its result may lack.
    during: Option<Vec<Append>>,
    /// Whether the task runs.
    driving: bool,
    /// When the task may next read or send.
    next_at: Instant,
    subscribers: Vec<Subscriber>,
    /// How many times the last subscriber left.
    rests: u64,
    /// Why the record's read failed: its subscriptions are over.
    ended: Option<Fault>,
}

impl Topic {
    /// A record nobody has read yet. Its changes are numbered from `seq`.
    pub(super) fn new(
        engine: &Arc<Engine>,
        reader: Reader,
        key: Key,
        args: Value,
        seq: u64,
    ) -> Arc<Topic> {
        let state = State {
            value: None,
            whole: None,
            seq,
            log: VecDeque::new(),
            pending: Vec::new(),
            said: 1,
            began: 0,
            read: 0,
            during: None,
            driving: false,
            next_at: Instant::now(),
            subscribers: Vec::new(),
            rests: 0,
            ended: None,
        };
        Arc::new(Topic {
            reader,
            key,
            args,
            engine: Arc::downgrade(engine),
            state: Mutex::new(state),
        })
    }

    /// The record's name, and its key among the records of that name.
    pub(super) fn id(&self) -> (&'static str, Key) {
        (self.reader.name, self.key.clone())
    }

    /// The record's arguments, as its type writes them.
    pub(super) fn args(&self) -> &Value {
        &self.args
    }

    /// Adds a subscriber, and gives what it needs: how many changes were said so far. It gets the
    /// whole value only once a read holds them all.
    pub(super) fn join(self: &Arc<Self>, subscriber: Subscriber) -> u64 {
        let mut state = self.lock();
        subscriber.tell();
        state.subscribers.push(subscriber);
        self.wake(&mut state);
        state.said
    }

    /// Removes a subscriber. A record its last one left is read no more, and forgotten after a
    /// while.
    pub(super) fn leave(self: &Arc<Self>, subscriber: &Subscriber) {
        let mut state = self.lock();
        let before = state.subscribers.len();
        state.subscribers.retain(|held| !held.is(subscriber));
        if state.subscribers.is_empty() && before > 0 {
            state.rests += 1;
            let rests = state.rests;
            drop(state);
            if let Some(engine) = self.engine.upgrade() {
                engine.forget_later(self.clone(), rests);
            }
        }
    }

    /// Whether nobody subscribed since the last subscriber left for the `rests`th time, and the
    /// number of the last change, which no later record of this key may use again.
    pub(super) fn rests(&self, rests: Option<u64>) -> Option<u64> {
        let state = self.lock();
        let still = rests.is_none_or(|rests| state.rests == rests && state.subscribers.is_empty());
        still.then_some(state.seq)
    }

    /// The record changed: it is read again, for its subscribers now, or for the next one.
    pub(super) fn changed(self: &Arc<Self>) {
        let mut state = self.lock();
        state.said += 1;
        self.wake(&mut state);
    }

    /// A text of the record grew: the value grows without a read, unless it already holds the
    /// text, or cannot take it, and then only a read tells.
    pub(super) fn append(self: &Arc<Self>, append: Append) {
        let mut state = self.lock();
        let State { value, whole, .. } = &mut *state;
        let fit = match value {
            Some(value) => match append.fit(value) {
                // The whole value as sent goes first: the value then grows in place, and is
                // copied only while a subscriber's send still holds it.
                Fit::Grew => {
                    *whole = None;
                    append.grow(Arc::make_mut(value))
                }
                other => other,
            },
            None => Fit::Apart,
        };
        match fit {
            Fit::Grew => state.grew(append),
            Fit::Held => {}
            Fit::Apart => state.said += 1,
        }
        self.wake(&mut state);
    }

    /// What a subscriber gets next: `sent` is the number of the last change it holds, or none
    /// when it holds no value, and `need` what `join` gave it.
    pub(super) fn news(&self, sent: Option<u64>, need: u64) -> News {
        let mut state = self.lock();
        if let Some(fault) = &state.ended {
            return News::Ended(fault.clone());
        }
        match sent.and_then(|sent| state.since(sent)) {
            Some(changes) if changes.is_empty() => News::Nothing,
            Some(changes) => News::Changes {
                first: state.seq + 1 - changes.len() as u64,
                changes,
            },
            None => state.whole(need),
        }
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        locked(&self.state)
    }

    /// Starts the task when there is something to read or to send, and somebody to send it to.
    fn wake(self: &Arc<Self>, state: &mut State) {
        let work = state.said > state.began || !state.pending.is_empty();
        if state.driving || !work || state.subscribers.is_empty() || state.ended.is_some() {
            return;
        }
        if let Some(engine) = self.engine.upgrade() {
            state.driving = true;
            engine.runtime.spawn(self.clone().drive());
        }
    }

    /// The record's one task: while there is work, it waits for the pace, then reads the record
    /// again when it was said to have changed, or sends the appends that wait.
    async fn drive(self: Arc<Self>) {
        loop {
            let at = self.lock().next_at;
            tokio::time::sleep_until(at).await;
            // In a statement of its own: the lock is not held while the record is read.
            let step = self.lock().begin();
            match step {
                Step::Rest => return,
                Step::Sent => {}
                Step::Read => {
                    let read = self.read().await;
                    if !self.finish(read) {
                        return;
                    }
                }
            }
        }
    }

    /// Reads the record, on a blocking thread.
    async fn read(&self) -> Result<Value, Fault> {
        let shared = self.engine.upgrade().and_then(|engine| engine.shared());
        let Some(shared) = shared else {
            return Err(Fault::refused("the server is stopping"));
        };
        let (read, args) = (self.reader.read.clone(), self.args.clone());
        blocking(move || read(&shared, args)).await
    }

    /// Takes a read's result: the change from the value held is sent, or, when the read failed,
    /// the record's subscriptions end. Gives whether the record goes on.
    fn finish(self: &Arc<Self>, read: Result<Value, Fault>) -> bool {
        let mut state = self.lock();
        match read {
            Ok(value) => {
                state.take(value);
                true
            }
            Err(fault) => {
                state.end(fault);
                drop(state);
                if let Some(engine) = self.engine.upgrade() {
                    engine.forget(self, None);
                }
                false
            }
        }
    }
}

impl State {
    /// The changes after the one numbered `sent`, when the log still has them all.
    fn since(&self, sent: u64) -> Option<Vec<Vec<Op>>> {
        self.value.as_ref()?;
        let behind = usize::try_from(self.seq.checked_sub(sent)?).ok()?;
        let from = self.log.len().checked_sub(behind)?;
        Some(self.log.iter().skip(from).cloned().collect())
    }

    /// The whole value, once it holds every change said before the subscriber came and nothing
    /// applied to it waits to be sent.
    fn whole(&mut self, need: u64) -> News {
        match &self.value {
            Some(value) if self.read >= need && self.pending.is_empty() => {
                let seq = self.seq;
                let whole = self.whole.get_or_insert_with(|| {
                    Arc::new(Whole {
                        seq,
                        value: Arc::clone(value),
                        part: OnceLock::new(),
                    })
                });
                News::Whole(whole.clone())
            }
            _ => News::Nothing,
        }
    }

    /// An append was applied: it joins the next change, and what the read in flight may lack.
    fn grew(&mut self, append: Append) {
        match self.pending.last_mut() {
            Some(Op::Append { path, text }) if *path == append.path => text.push_str(&append.text),
            _ => self.pending.push(append.op()),
        }
        if let Some(during) = &mut self.during {
            during.push(append);
        }
    }

    /// What the task does now that the pace lets it.
    fn begin(&mut self) -> Step {
        if self.subscribers.is_empty() || self.ended.is_some() {
            self.driving = false;
            return Step::Rest;
        }
        if self.said > self.began {
            self.began = self.said;
            self.during = Some(Vec::new());
            return Step::Read;
        }
        if self.send() {
            return Step::Sent;
        }
        self.driving = false;
        Step::Rest
    }

    /// Takes the value a read gave. The appends applied during the read are applied to it too,
    /// where it lacks them: a read never takes back a text that was said.
    fn take(&mut self, mut value: Value) {
        for append in self.during.take().unwrap_or_default() {
            if append.onto(&mut value) == Fit::Apart {
                self.said += 1;
            }
        }
        if let Some(held) = &self.value {
            self.pending.extend(diff(held, &value));
        }
        if !self.pending.is_empty() || self.value.is_none() {
            self.whole = None;
        }
        self.value = Some(Arc::new(value));
        self.read = self.began;
        self.next_at = Instant::now() + PACE;
        if !self.send() {
            self.tell();
        }
    }

    /// Sends what waits as the next change, when something does.
    fn send(&mut self) -> bool {
        if self.pending.is_empty() {
            return false;
        }
        self.seq += 1;
        self.log.push_back(std::mem::take(&mut self.pending));
        if self.log.len() > KEPT_CHANGES {
            self.log.pop_front();
        }
        self.next_at = Instant::now() + PACE;
        self.tell();
        true
    }

    /// Ends the record: its read failed, and each subscriber is told why.
    fn end(&mut self, fault: Fault) {
        self.ended = Some(fault);
        self.driving = false;
        self.tell();
        self.subscribers.clear();
    }

    /// Tells every subscriber there is news.
    fn tell(&self) {
        self.subscribers.iter().for_each(Subscriber::tell);
    }
}
