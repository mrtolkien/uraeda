//! The client's TypeScript types, written from the Rust types: `app/store/protocol.d.ts`.

use std::any::TypeId;
use std::collections::{BTreeMap, HashSet};
use std::fmt::Write as _;

use ts_rs::{Config, TS, TypeVisitor};

use crate::message::{ClientMessage, PROTOCOL, ServerMessage};
use crate::registry::{Catalog, Entry};

/// The named types met from the types added, each with its declaration.
pub(crate) struct Types {
    config: Config,
    seen: HashSet<TypeId>,
    /// Each declaration, with its documentation, by the type's name.
    declared: BTreeMap<String, String>,
}

impl Types {
    /// The types of the messages.
    pub fn of_messages() -> Self {
        let mut types = Self {
            // A number of JSON is a `number` in a client, whatever its size in Rust.
            config: Config::new().with_large_int("number"),
            seen: HashSet::new(),
            declared: BTreeMap::new(),
        };
        types.add::<ClientMessage>();
        types.add::<ServerMessage>();
        types
    }

    /// Adds a type and every type it uses, and gives the name the client reads it by.
    pub fn add<T: TS + 'static + ?Sized>(&mut self) -> String {
        self.visit::<T>();
        T::name(&self.config)
    }
}

impl TypeVisitor for Types {
    fn visit<T: TS + 'static + ?Sized>(&mut self) {
        if !self.seen.insert(TypeId::of::<T>()) {
            return;
        }
        // A type with a file to go to is one with a name and a declaration.
        if T::output_path().is_some() {
            let name = T::ident(&self.config);
            let text = format!(
                "{}export {}",
                T::docs().unwrap_or_default(),
                T::decl(&self.config)
            );
            let held = self
                .declared
                .entry(name.clone())
                .or_insert_with(|| text.clone());
            assert!(
                *held == text,
                "two types of the protocol are named `{name}`: rename one"
            );
        }
        T::visit_generics(self);
        T::visit_dependencies(self);
    }
}

/// The TypeScript types of the protocol's version, messages, records, and actions.
#[must_use]
pub fn typescript(catalog: &Catalog) -> String {
    let mut text = format!(
        "// The protocol between Uraeda's server and its clients, as a client reads it.\n\
         // Written by `vp run protocol:types` from `crates/protocol/`: never by hand.\n\n\
         /** The protocol's version, which a client's `hello` gives. */\n\
         export type Protocol = {PROTOCOL};\n"
    );
    for declaration in catalog.types.declared.values() {
        let _ = write!(text, "\n{declaration}\n");
    }
    let records = "Every record, by the name a `sub` gives: its arguments, and its whole value.";
    table(
        &mut text,
        records,
        "Records",
        ["args", "value"],
        &catalog.records,
    );
    let actions = "Every action, by the name a `call` gives: its input, and its output.";
    table(
        &mut text,
        actions,
        "Actions",
        ["input", "output"],
        &catalog.actions,
    );
    text
}

/// A type with one field for each record or action, by its name.
fn table(text: &mut String, docs: &str, name: &str, fields: [&str; 2], entries: &[Entry]) {
    let _ = writeln!(text, "\n/** {docs} */\nexport type {name} = {{");
    let mut entries: Vec<_> = entries.iter().collect();
    entries.sort_by_key(|entry| entry.name);
    for Entry { name, takes, gives } in entries {
        // A name with a dot, as an action's, is a field only in quotes.
        let key = if name.chars().all(char::is_alphanumeric) {
            (*name).to_owned()
        } else {
            format!("\"{name}\"")
        };
        let [first, second] = fields;
        let _ = writeln!(text, "  {key}: {{ {first}: {takes}; {second}: {gives} }};");
    }
    text.push_str("};\n");
}
