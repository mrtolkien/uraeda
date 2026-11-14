//! The sync's decisions, made on the desktop from three lists: the desktop's files, the phone's,
//! and the phone's record of both at its last sync, its base. The phone carries the plan out, and
//! records each file's new hash once its action is done.
//!
//! - Changed on one side since the base: the change travels.
//! - Deleted on one side, unchanged on the other: the deletion travels, into `.trash/` there.
//! - Deleted on one side, changed on the other: the change wins, and the file comes back.
//! - Changed on both: the desktop's version keeps the name, and the phone's is kept beside it as
//!   `name (conflict phone 2026-11-14 1630).md`, on both sides.
//! - A rename is a deletion and a new file.
//! - What the phone may not write, git's files and the plugin's: the desktop's version wins. The
//!   phone's change to git's files is kept in `inbox/`, `name (phone edit 2026-11-14 1630).md`.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::manifest::Manifest;
use crate::paths;

/// One thing for the phone to do.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "do", rename_all = "kebab-case")]
pub enum Action {
    /// Download the desktop's file, and record `hash`.
    Pull { path: String, hash: String },
    /// Upload the phone's file, which the desktop writes only while its own is still `expect`,
    /// none for no file; then record `hash`.
    Push {
        path: String,
        hash: String,
        expect: Option<String>,
    },
    /// Copy the phone's file to `to`, on the phone and on the desktop, where no file `to` is; then
    /// record `hash` for `to`. A `Pull` or a `Trash` of `path` follows.
    Copy {
        path: String,
        to: String,
        hash: String,
    },
    /// Move the phone's file to its `.trash/`, and forget it.
    Trash { path: String },
    /// Ask the desktop to move its file to `.trash/` while it is still `expect`, and forget it.
    TrashRemote { path: String, expect: String },
    /// Forget a file deleted on both sides.
    Forget { path: String },
}

/// The plan for every path of the three lists. `stamp` names the conflicts' copies, the phone's
/// local time, `2026-11-14 1630`. Paths that do not sync are left out.
pub fn plan(desktop: &Manifest, phone: &Manifest, base: &Manifest, stamp: &str) -> Vec<Action> {
    let all: BTreeSet<&String> = desktop
        .keys()
        .chain(phone.keys())
        .chain(base.keys())
        .collect();
    let mut taken: BTreeSet<String> = desktop.keys().chain(phone.keys()).cloned().collect();
    let mut out = Vec::new();
    for path in all {
        if paths::clean(path).as_deref() != Some(path.as_str()) || !paths::is_synced(path) {
            continue;
        }
        let (d, p, b) = (desktop.get(path), phone.get(path), base.get(path));
        let writable = paths::is_writable(path);
        let pull = |hash: &String| Action::Pull {
            path: path.clone(),
            hash: hash.clone(),
        };
        let mut keep_phone = |to_inbox: bool, out: &mut Vec<Action>| {
            let to = copy_name(path, stamp, to_inbox, &taken);
            taken.insert(to.clone());
            out.push(Action::Copy {
                path: path.clone(),
                to,
                hash: p.cloned().unwrap_or_default(),
            });
        };
        match (d, p) {
            (Some(d), Some(p)) if d == p => {}
            (None, None) => out.push(Action::Forget { path: path.clone() }),
            (Some(d), None) => {
                if writable && b == Some(d) {
                    out.push(Action::TrashRemote {
                        path: path.clone(),
                        expect: d.clone(),
                    });
                } else {
                    out.push(pull(d));
                }
            }
            (None, Some(p)) => {
                if b == Some(p) || paths::is_plugin_file(path) {
                    out.push(Action::Trash { path: path.clone() });
                } else if writable {
                    out.push(Action::Push {
                        path: path.clone(),
                        hash: p.clone(),
                        expect: None,
                    });
                } else {
                    keep_phone(true, &mut out);
                    out.push(Action::Trash { path: path.clone() });
                }
            }
            (Some(d), Some(p)) => {
                if b == Some(p) || paths::is_plugin_file(path) {
                    out.push(pull(d));
                } else if writable && b == Some(d) {
                    out.push(Action::Push {
                        path: path.clone(),
                        hash: p.clone(),
                        expect: Some(d.clone()),
                    });
                } else {
                    keep_phone(!writable, &mut out);
                    out.push(pull(d));
                }
            }
        }
    }
    out
}

/// The name of the phone's copy: beside the file, `a (conflict phone 2026-11-14 1630).md`, or in
/// `inbox/` for git's files, `a (phone edit 2026-11-14 1630).md`, numbered when taken.
fn copy_name(path: &str, stamp: &str, to_inbox: bool, taken: &BTreeSet<String>) -> String {
    let (dir, name) = match path.rsplit_once('/') {
        Some((dir, name)) if !to_inbox => (format!("{dir}/"), name),
        Some((_, name)) => ("inbox/".to_string(), name),
        None if to_inbox => ("inbox/".to_string(), path),
        None => (String::new(), path),
    };
    let (stem, ext) = match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => (stem, format!(".{ext}")),
        _ => (name, String::new()),
    };
    let what = if to_inbox {
        "phone edit"
    } else {
        "conflict phone"
    };
    let stamp: String = stamp
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || " -".contains(*c))
        .take(20)
        .collect();
    let mut n = 1;
    loop {
        let count = if n == 1 {
            String::new()
        } else {
            format!(" {n}")
        };
        let candidate = format!("{dir}{stem} ({what} {stamp}{count}){ext}");
        if !taken.contains(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

#[cfg(test)]
#[path = "plan_tests.rs"]
mod tests;
