//! The client's TypeScript types, made from the protocol's Rust types.

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uraeda_protocol::{Action, Catalog, Record, catalog, typescript};

/// A counter, the record of these tests.
#[derive(Serialize, Deserialize, TS)]
struct Counter {
    id: String,
    count: u64,
}

/// Which counter.
#[derive(Serialize, Deserialize, TS)]
struct CounterArgs {
    id: String,
}

impl Record for Counter {
    const NAME: &'static str = "Counter";
    type Args = CounterArgs;
    type Value = Self;
}

/// Adds to a counter.
#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
struct CounterAdd {
    id: String,
    how_much: u32,
}

impl Action for CounterAdd {
    const NAME: &'static str = "counter.add";
    type Input = Self;
    type Output = Counter;
}

// The break it catches: a record or an action the server has, which the client cannot name or
// reads with another shape.
#[test]
fn a_declared_record_and_action_are_typed_for_the_client() {
    let catalog = Catalog::new().record::<Counter>().action::<CounterAdd>();

    let types = typescript(&catalog);

    for line in [
        "  Counter: { args: CounterArgs; value: Counter };",
        "  \"counter.add\": { input: CounterAdd; output: Counter };",
        "export type Counter = { id: string, count: number, };",
        "export type CounterAdd = { id: string, howMuch: number, };",
    ] {
        assert!(types.contains(line), "`{line}` is missing from:\n{types}");
    }
    assert_eq!(catalog.records().collect::<Vec<_>>(), ["Counter"]);
    assert_eq!(catalog.actions().collect::<Vec<_>>(), ["counter.add"]);
}

// The break it catches: a message, a record, or an action changed in Rust, with the client still
// compiled against the old types.
#[test]
fn the_clients_types_are_fresh() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../app/store/protocol.d.ts");

    let written = std::fs::read_to_string(path).unwrap_or_default();

    assert!(
        written == typescript(&catalog()),
        "app/store/protocol.d.ts is stale: run `just protocol-types`, and commit the file"
    );
}
