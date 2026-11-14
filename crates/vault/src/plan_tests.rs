//! Every case of the plan: each side unchanged, changed, added, or deleted since the base, for a
//! note, git's file, and the plugin's.

use super::*;

const STAMP: &str = "2026-11-14 1630";

fn list(entries: &[(&str, &str)]) -> Manifest {
    entries
        .iter()
        .map(|(p, h)| ((*p).to_string(), (*h).to_string()))
        .collect()
}

/// The plan for one path: desktop, phone, base, each a hash or none.
fn one(path: &str, d: Option<&str>, p: Option<&str>, b: Option<&str>) -> Vec<Action> {
    let of = |h: Option<&str>| h.map_or_else(Manifest::new, |h| list(&[(path, h)]));
    plan(&of(d), &of(p), &of(b), STAMP)
}

fn pull(path: &str, hash: &str) -> Action {
    Action::Pull {
        path: path.into(),
        hash: hash.into(),
    }
}

fn trash(path: &str) -> Action {
    Action::Trash { path: path.into() }
}

const NOTE: &str = "inbox/a.md";
const GIT: &str = "projects/todo/specs/spec.md";
const PLUGIN: &str = ".obsidian/plugins/uraeda/main.js";

#[test]
fn the_same_on_both_sides_is_nothing() {
    assert_eq!(one(NOTE, Some("1"), Some("1"), None), []);
    assert_eq!(one(NOTE, Some("1"), Some("1"), Some("0")), []);
}

#[test]
fn a_change_on_one_side_travels() {
    assert_eq!(
        one(NOTE, Some("2"), Some("1"), Some("1")),
        [pull(NOTE, "2")]
    );
    assert_eq!(
        one(NOTE, Some("1"), Some("2"), Some("1")),
        [Action::Push {
            path: NOTE.into(),
            hash: "2".into(),
            expect: Some("1".into()),
        }]
    );
}

#[test]
fn a_new_file_travels() {
    assert_eq!(one(NOTE, Some("1"), None, None), [pull(NOTE, "1")]);
    assert_eq!(
        one(NOTE, None, Some("1"), None),
        [Action::Push {
            path: NOTE.into(),
            hash: "1".into(),
            expect: None,
        }]
    );
}

#[test]
fn a_deletion_travels_when_the_other_side_kept_the_file() {
    assert_eq!(
        one(NOTE, Some("1"), None, Some("1")),
        [Action::TrashRemote {
            path: NOTE.into(),
            expect: "1".into(),
        }]
    );
    assert_eq!(one(NOTE, None, Some("1"), Some("1")), [trash(NOTE)]);
    assert_eq!(
        one(NOTE, None, None, Some("1")),
        [Action::Forget { path: NOTE.into() }]
    );
}

#[test]
fn a_change_wins_over_a_deletion() {
    assert_eq!(one(NOTE, Some("2"), None, Some("1")), [pull(NOTE, "2")]);
    assert_eq!(
        one(NOTE, None, Some("2"), Some("1")),
        [Action::Push {
            path: NOTE.into(),
            hash: "2".into(),
            expect: None,
        }]
    );
}

#[test]
fn a_change_on_both_sides_keeps_both() {
    let copy = Action::Copy {
        path: NOTE.into(),
        to: "inbox/a (conflict phone 2026-11-14 1630).md".into(),
        hash: "3".into(),
    };
    assert_eq!(
        one(NOTE, Some("2"), Some("3"), Some("1")),
        [copy.clone(), pull(NOTE, "2")]
    );
    // Two files of the same name made apart, before any sync.
    assert_eq!(
        one(NOTE, Some("2"), Some("3"), None),
        [copy, pull(NOTE, "2")]
    );
}

#[test]
fn the_copy_takes_a_free_name() {
    let taken = "inbox/a (conflict phone 2026-11-14 1630).md";
    let desktop = list(&[(NOTE, "2"), (taken, "9")]);
    let phone = list(&[(NOTE, "3"), (taken, "9")]);
    let base = list(&[(NOTE, "1"), (taken, "9")]);
    assert_eq!(
        plan(&desktop, &phone, &base, STAMP)[0],
        Action::Copy {
            path: NOTE.into(),
            to: "inbox/a (conflict phone 2026-11-14 1630 2).md".into(),
            hash: "3".into(),
        }
    );
}

#[test]
fn git_files_are_the_desktops() {
    let to = "inbox/spec (phone edit 2026-11-14 1630).md".to_string();
    // The phone changed one: its version goes to the inbox, the desktop's comes back.
    assert_eq!(
        one(GIT, Some("1"), Some("2"), Some("1")),
        [
            Action::Copy {
                path: GIT.into(),
                to: to.clone(),
                hash: "2".into(),
            },
            pull(GIT, "1")
        ]
    );
    // Deleted on the phone: it comes back.
    assert_eq!(one(GIT, Some("1"), None, Some("1")), [pull(GIT, "1")]);
    // Made on the phone: it goes to the inbox.
    assert_eq!(
        one(GIT, None, Some("2"), None),
        [
            Action::Copy {
                path: GIT.into(),
                to,
                hash: "2".into(),
            },
            trash(GIT)
        ]
    );
    // Gone from the desktop, a feature merged: it goes from the phone too.
    assert_eq!(one(GIT, None, Some("1"), Some("1")), [trash(GIT)]);
}

#[test]
fn the_plugin_is_the_desktops() {
    assert_eq!(
        one(PLUGIN, Some("2"), Some("3"), Some("1")),
        [pull(PLUGIN, "2")]
    );
    assert_eq!(one(PLUGIN, Some("1"), None, Some("1")), [pull(PLUGIN, "1")]);
    assert_eq!(one(PLUGIN, None, Some("1"), None), [trash(PLUGIN)]);
}

#[test]
fn what_does_not_sync_is_left_out() {
    for path in [".obsidian/app.json", "../x.md", ".trash/a.md", "a//b.md"] {
        assert_eq!(one(path, None, Some("1"), None), [], "{path}");
    }
}
