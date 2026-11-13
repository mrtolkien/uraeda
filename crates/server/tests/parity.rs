//! The parity list, `parity.toml`: every record, mutation, and route of the Node server is
//! either served by this server under a name it knows, or dropped on purpose, with why.
//!
//! The Node server is gone. The list's keys are its names, frozen as its code had them when it
//! went: this test read them from that code until then, and failed on a name without a line and
//! on a line of no name. What stays checked is each line's new name.

use crate::support;

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use uraeda_server::live::Registry;

/// `parity.toml`: for each kind, the old name, then its new name or `dropped: <why>`.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct List {
    records: BTreeMap<String, String>,
    actions: BTreeMap<String, String>,
    routes: BTreeMap<String, String>,
}

/// What a line's value starts with when the old name is not served.
const DROPPED: &str = "dropped: ";

/// The problems of one kind's lines: a new name this server does not serve, and a name dropped
/// without why.
fn problems(kind: &str, lines: &BTreeMap<String, String>, known: &BTreeSet<String>) -> Vec<String> {
    let unknown = lines.iter().filter_map(|(old, new)| {
        if let Some(why) = new.strip_prefix(DROPPED) {
            return why
                .trim()
                .is_empty()
                .then(|| format!("{kind} `{old}` is dropped without why"));
        }
        (!known.contains(new))
            .then(|| format!("{kind} `{old}` maps to `{new}`, which this server does not serve"))
    });
    unknown.collect()
}

#[tokio::test]
async fn every_old_record_mutation_and_route_is_mapped_or_dropped() {
    let text = include_str!("../parity.toml");
    let list: List = toml_edit::de::from_str(text).expect("parity.toml reads");
    let server = support::server().await;
    let registry = server.shared().get::<Registry>();
    let catalog = uraeda_protocol::catalog();
    let names = |declared: Vec<&str>, served: Vec<&str>| -> BTreeSet<String> {
        // A name both declared and served: the live test keeps the two lists equal.
        let served: BTreeSet<&str> = served.into_iter().collect();
        let both = declared.into_iter().filter(|name| served.contains(name));
        both.map(str::to_owned).collect()
    };
    let records = names(catalog.records().collect(), registry.records());
    let actions = names(catalog.actions().collect(), registry.actions());
    let routes = server.routes().into_iter().map(str::to_owned).collect();
    // The Node server's names, as many as its code held when it went (ruling R229).
    let counts = [list.records.len(), list.actions.len(), list.routes.len()];
    assert_eq!(counts, [46, 114, 29], "a line of the frozen list went");
    let mut found = problems("record", &list.records, &records);
    found.extend(problems("action", &list.actions, &actions));
    found.extend(problems("route", &list.routes, &routes));
    server.stop().await;
    assert!(found.is_empty(), "parity.toml:\n{}", found.join("\n"));
}
