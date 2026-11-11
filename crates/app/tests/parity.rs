//! The screens' parity list, `app/screens/parity.toml`: every page of the React UI's route table
//! has a screen in the app, or a line saying why it went; and what the old screens did that the
//! new ones do not is listed, each with its fate.
//!
//! A Rust test, as `keys.rs` is: a test under `nsh test` reads no file the app is not granted, and
//! this one reads the old UI's route table, the list, and the screens' sources. What a page shows
//! once opened is `app/screens/shell/places.test.tsx`'s: it opens every page a screen gives a place,
//! `definePlace("<page>", ..)`, and fails on one that does not mount. This test checks that each
//! old page maps to such a page, and never to `missing`, the page that draws "Nothing here".

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

/// The list: the old pages, then what the old screens did that the new ones do not.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct List {
    routes: BTreeMap<String, Route>,
    #[serde(default)]
    left: Vec<Left>,
}

/// An old page: its paths, and the new page and screen that draw it, or why it went.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Route {
    path: String,
    page: Option<String>,
    screen: Option<String>,
    dropped: Option<String>,
}

/// Something an old screen did that its new screen does not do, or did not until this list.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Left {
    what: String,
    old: String,
    why: String,
    fate: Fate,
    /// Where it is now: the screen it came back to, or what replaced it.
    now: Option<String>,
    /// What bringing it back needs, for one left.
    needs: Option<String>,
    /// Whether a person will miss it, for one left.
    missed: Option<String>,
}

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
enum Fate {
    BroughtBack,
    Left,
    Replaced,
}

/// The page that draws "Nothing here", which no old page but its own maps to.
const NOTHING_HERE: &str = "missing";

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// TASK 61: the React UI goes. The keys of `[routes]` are then the frozen list of its pages: drop
/// this function, and the test's two checks that read it ("has no line", "is no page").
fn old_pages() -> BTreeSet<String> {
    let table = fs::read_to_string(root().join("packages/web/src/routeTable.ts")).unwrap();
    let start = table
        .find("export type Route =")
        .expect("the old route table's type");
    let union = &table[start..start + table[start..].find(";\n\n").unwrap()];
    union
        .split("page: \"")
        .skip(1)
        .map(|rest| rest[..rest.find('"').unwrap()].to_owned())
        .collect()
}

/// The pages a screen gives a place, from each `definePlace("<page>", ..)` under `app/`.
fn placed_pages() -> BTreeSet<String> {
    let mut files = Vec::new();
    sources(&root().join("app"), &mut files);
    files
        .iter()
        .flat_map(|path| {
            let text = fs::read_to_string(path).unwrap();
            let calls = text.split("definePlace(").skip(1).filter_map(|rest| {
                let rest = rest.trim_start().strip_prefix('"')?;
                Some(rest[..rest.find('"')?].to_owned())
            });
            calls.collect::<Vec<_>>()
        })
        .collect()
}

/// The TSX sources under `dir`, less what Native Shell generates.
fn sources(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        if path.is_dir() {
            if !name.starts_with('.') && name != "node_modules" {
                sources(&path, files);
            }
        } else if name.ends_with(".tsx") || name.ends_with(".ts") {
            files.push(path);
        }
    }
}

/// What is wrong with one old page's line.
fn route_problems(old: &str, route: &Route, placed: &BTreeSet<String>) -> Vec<String> {
    let mut found = Vec::new();
    if route.path.trim().is_empty() {
        found.push(format!("`{old}` names no path"));
    }
    match (&route.page, &route.dropped) {
        (Some(page), None) => {
            if !placed.contains(page) {
                found.push(format!(
                    "`{old}` maps to `{page}`, which no screen gives a place"
                ));
            }
            if page == NOTHING_HERE && old != NOTHING_HERE {
                found.push(format!(
                    "`{old}` maps to `{page}`, which draws \"Nothing here\""
                ));
            }
            match &route.screen {
                Some(screen) if root().join(screen).is_dir() => {}
                Some(screen) => found.push(format!("`{old}`'s screen `{screen}` is no folder")),
                None => found.push(format!("`{old}` names no screen")),
            }
        }
        (None, Some(why)) if !why.trim().is_empty() => {}
        (None, Some(_)) => found.push(format!("`{old}` is dropped without why")),
        _ => found.push(format!(
            "`{old}` needs a `page` or a `dropped`, one of them"
        )),
    }
    found
}

/// What is wrong with one line of what the old screens did.
fn left_problems(left: &Left) -> Vec<String> {
    let mut found = Vec::new();
    let blank = |text: &str| text.trim().is_empty();
    if blank(&left.what) || blank(&left.old) || blank(&left.why) {
        found.push(format!(
            "`{}` needs its what, old screen, and why",
            left.what
        ));
    }
    let said = |field: &Option<String>| field.as_deref().is_some_and(|text| !blank(text));
    if left.fate == Fate::Left && !(said(&left.needs) && said(&left.missed)) {
        found.push(format!(
            "`{}` is left: say what it needs, and who misses it",
            left.what
        ));
    }
    if left.fate != Fate::Left && !said(&left.now) {
        found.push(format!("`{}`: say where it is now", left.what));
    }
    found
}

#[test]
fn every_old_route_is_mapped_or_dropped() {
    let text = fs::read_to_string(root().join("app/screens/parity.toml")).unwrap();
    let list: List = toml_edit::de::from_str(&text).expect("parity.toml reads");
    let old = old_pages();
    assert!(
        old.contains("home"),
        "the old route table was not read: {old:?}"
    );
    let placed = placed_pages();
    let listed: BTreeSet<String> = list.routes.keys().cloned().collect();
    let missing = old
        .difference(&listed)
        .map(|page| format!("`{page}` of the React UI has no line: map it, or drop it with why"));
    let stale = listed
        .difference(&old)
        .map(|page| format!("`{page}` is no page of the React UI: remove its line"));
    let mut found: Vec<String> = missing.chain(stale).collect();
    for (page, route) in &list.routes {
        found.extend(route_problems(page, route, &placed));
    }
    for left in &list.left {
        found.extend(left_problems(left));
    }
    assert!(found.is_empty(), "parity.toml:\n{}", found.join("\n"));
}
