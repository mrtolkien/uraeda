//! The records and the actions: what declares one, and the catalog of every one declared, which
//! the client's types are made from.

use serde::Serialize;
use serde::de::DeserializeOwned;
use ts_rs::TS;

use crate::devices::{Devices, DevicesRename, DevicesRevoke};
use crate::typescript::Types;

/// What crosses the protocol: read from JSON, written as JSON, and typed for the client.
pub trait Wire: Serialize + DeserializeOwned + TS + Send + 'static {}

impl<T: Serialize + DeserializeOwned + TS + Send + 'static> Wire for T {}

/// A record: what a client subscribes to, by a name and arguments, and gets the value of, whole
/// once, then as changes.
pub trait Record: 'static {
    /// The name a `sub` gives.
    const NAME: &'static str;
    /// What picks one record of that name: `()`, sent as `null`, when there is only one.
    type Args: Wire;
    /// Its whole value.
    type Value: Wire;
}

/// An action: what a client calls, by a name, with an input, and gets the output of.
pub trait Action: 'static {
    /// The name a `call` gives.
    const NAME: &'static str;
    /// What it is called with: `()`, sent as `null`, when it takes nothing.
    type Input: Wire;
    /// What a `result` answers.
    type Output: Wire;
}

/// A record or an action of the catalog: its name, and its two types as the client names them.
pub(crate) struct Entry {
    pub name: &'static str,
    pub takes: String,
    pub gives: String,
}

/// The records and the actions declared, with the types they and the messages use.
pub struct Catalog {
    pub(crate) records: Vec<Entry>,
    pub(crate) actions: Vec<Entry>,
    pub(crate) types: Types,
}

impl Default for Catalog {
    fn default() -> Self {
        Self::new()
    }
}

impl Catalog {
    /// A catalog with the messages' types, and no record or action yet.
    #[must_use]
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
            actions: Vec::new(),
            types: Types::of_messages(),
        }
    }

    /// Adds a record.
    ///
    /// # Panics
    ///
    /// When a record of that name is there already, or a type of it has the name of another type.
    #[must_use]
    pub fn record<R: Record>(mut self) -> Self {
        let entry = self.entry::<R::Args, R::Value>(R::NAME);
        add("record", &mut self.records, entry);
        self
    }

    /// Adds an action.
    ///
    /// # Panics
    ///
    /// When an action of that name is there already, or a type of it has the name of another type.
    #[must_use]
    pub fn action<A: Action>(mut self) -> Self {
        let entry = self.entry::<A::Input, A::Output>(A::NAME);
        add("action", &mut self.actions, entry);
        self
    }

    /// The records' names, as declared.
    pub fn records(&self) -> impl Iterator<Item = &'static str> {
        self.records.iter().map(|entry| entry.name)
    }

    /// The actions' names, as declared.
    pub fn actions(&self) -> impl Iterator<Item = &'static str> {
        self.actions.iter().map(|entry| entry.name)
    }

    fn entry<Takes: Wire, Gives: Wire>(&mut self, name: &'static str) -> Entry {
        Entry {
            name,
            takes: self.types.add::<Takes>(),
            gives: self.types.add::<Gives>(),
        }
    }
}

fn add(kind: &str, entries: &mut Vec<Entry>, entry: Entry) {
    let name = entry.name;
    assert!(
        entries.iter().all(|held| held.name != name),
        "the {kind} `{name}` is declared twice"
    );
    entries.push(entry);
}

/// Every record and action of the protocol. A domain adds one line for each of its own.
#[must_use]
pub fn catalog() -> Catalog {
    Catalog::new()
        .record::<Devices>()
        .action::<DevicesRename>()
        .action::<DevicesRevoke>()
}
