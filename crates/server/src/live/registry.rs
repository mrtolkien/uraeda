//! The handlers: what reads each record, and what runs each action.

use std::collections::HashMap;
use std::sync::{Arc, PoisonError, RwLock};

use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use uraeda_protocol::{Action, ErrorCode, Record};

use super::bus::Bus;
use super::fault::Fault;
use super::{Identity, Key};
use crate::shared::Shared;

/// A record's read, on its arguments as JSON.
type Read = Arc<dyn Fn(&Shared, Value) -> Result<Value, Fault> + Send + Sync>;

/// An action's run, on its input as JSON.
pub(super) type Run = Arc<dyn Fn(&Call, Value) -> Result<Value, Fault> + Send + Sync>;

/// What serves a record: how its arguments name one, and its read.
#[derive(Clone)]
pub(super) struct Reader {
    /// The record's name, as declared.
    pub name: &'static str,
    /// The key of the arguments a client sent, and the arguments as the record's type writes
    /// them, or why they are not the record's.
    pub keyed: fn(Value) -> Result<(Key, Value), Fault>,
    /// Reads the record of those arguments.
    pub read: Read,
}

/// What an action's run gets besides its input: the server's shared state, the bus to say what
/// it changed, and who called.
pub struct Call {
    pub(super) shared: Shared,
    pub(super) bus: Bus,
    pub(super) caller: Arc<Identity>,
}

impl Call {
    /// The state the server's domains share.
    pub fn shared(&self) -> &Shared {
        &self.shared
    }

    /// The bus: an action says there what it changed, before it returns.
    pub fn bus(&self) -> &Bus {
        &self.bus
    }

    /// Who called: the identity sign-in checked for the connection.
    pub fn caller(&self) -> &Identity {
        &self.caller
    }
}

#[derive(Default)]
struct Handlers {
    records: HashMap<&'static str, Reader>,
    actions: HashMap<&'static str, Run>,
}

/// The handlers of the server's records and actions. A domain registers its own as it mounts:
/// see [the module's documentation](super).
#[derive(Clone, Default)]
pub struct Registry(Arc<RwLock<Handlers>>);

impl Registry {
    /// Registers what reads a record: a plain function from the record's arguments to its value,
    /// run on a blocking thread, at most once at a time for one record. It gets no caller: a
    /// record's value is the same for everyone who reads it.
    ///
    /// # Panics
    ///
    /// When the record already has a handler.
    pub fn record<R: Record>(
        &self,
        read: impl Fn(&Shared, R::Args) -> Result<R::Value, Fault> + Send + Sync + 'static,
    ) {
        let read: Read = Arc::new(move |shared, args| {
            typed(ErrorCode::BadArgs, args, |args| read(shared, args))
        });
        let reader = Reader {
            name: R::NAME,
            keyed: keyed::<R>,
            read,
        };
        let held = self.write().records.insert(R::NAME, reader);
        assert!(held.is_none(), "the record `{}` has two handlers", R::NAME);
    }

    /// Registers what runs an action: a plain function from the action's input to its output,
    /// run on a blocking thread. Calls run at the same time, a client's own too: an action that
    /// needs an order keeps it itself.
    ///
    /// # Panics
    ///
    /// When the action already has a handler.
    pub fn action<A: Action>(
        &self,
        run: impl Fn(&Call, A::Input) -> Result<A::Output, Fault> + Send + Sync + 'static,
    ) {
        let run: Run = Arc::new(move |call, input| {
            typed(ErrorCode::BadInput, input, |input| run(call, input))
        });
        let held = self.write().actions.insert(A::NAME, run);
        assert!(held.is_none(), "the action `{}` has two handlers", A::NAME);
    }

    /// The names of the records that have a handler, sorted.
    pub fn records(&self) -> Vec<&'static str> {
        sorted(self.read().records.keys())
    }

    /// The names of the actions that have a handler, sorted.
    pub fn actions(&self) -> Vec<&'static str> {
        sorted(self.read().actions.keys())
    }

    /// What serves the record of a name.
    pub(super) fn reader(&self, name: &str) -> Result<Reader, Fault> {
        let unknown = || Fault::new(ErrorCode::UnknownRecord, format!("no record is `{name}`"));
        self.read().records.get(name).cloned().ok_or_else(unknown)
    }

    /// What runs the action of a name.
    pub(super) fn runner(&self, name: &str) -> Result<Run, Fault> {
        let unknown = || Fault::new(ErrorCode::UnknownAction, format!("no action is `{name}`"));
        self.read().actions.get(name).cloned().ok_or_else(unknown)
    }

    /// Forgets every handler, as the server stops: a handler may hold the bus, which holds them.
    pub(super) fn clear(&self) {
        *self.write() = Handlers::default();
    }

    fn read(&self) -> std::sync::RwLockReadGuard<'_, Handlers> {
        self.0.read().unwrap_or_else(PoisonError::into_inner)
    }

    fn write(&self) -> std::sync::RwLockWriteGuard<'_, Handlers> {
        self.0.write().unwrap_or_else(PoisonError::into_inner)
    }
}

fn sorted<'a>(names: impl Iterator<Item = &'a &'static str>) -> Vec<&'static str> {
    let mut names: Vec<_> = names.copied().collect();
    names.sort_unstable();
    names
}

/// The key of a record's arguments as a client sent them, with the arguments as the record's own
/// type writes them: whatever fields a client adds or leaves to their defaults, the same record
/// has the same key.
fn keyed<R: Record>(args: Value) -> Result<(Key, Value), Fault> {
    let bad = |error: serde_json::Error| Fault::new(ErrorCode::BadArgs, error.to_string());
    let args: R::Args = serde_json::from_value(args).map_err(bad)?;
    Key::of(&args).map_err(bad)
}

/// Runs a typed handler on JSON: `bad` is the code for a JSON that is not its input.
fn typed<In: DeserializeOwned, Out: Serialize>(
    bad: ErrorCode,
    input: Value,
    run: impl FnOnce(In) -> Result<Out, Fault>,
) -> Result<Value, Fault> {
    let input =
        serde_json::from_value(input).map_err(|error| Fault::new(bad, error.to_string()))?;
    let output = run(input)?;
    serde_json::to_value(output).map_err(|error| Fault::internal(error.to_string()))
}

/// Runs a handler on a blocking thread, where it may read files, run git, and wait. A failure of
/// the server is logged here, and a handler that panics fails its own read or call only.
pub(super) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Fault> + Send + 'static,
) -> Result<T, Fault> {
    let done = tokio::task::spawn_blocking(work).await;
    let result = done.unwrap_or_else(|_| Err(Fault::internal("a handler panicked")));
    if let Err(fault) = &result
        && fault.code() == ErrorCode::Internal
    {
        eprintln!("uraeda: the server failed: {}", fault.message());
    }
    result
}
