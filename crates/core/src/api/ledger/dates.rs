//! The date of each decision's last change, kept by the default branch's tip it was read at, for
//! the life of the process: a tip names its whole history, so what was read at it never changes,
//! and a tip that moved on from it reads only the commits since.

use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};

use crate::git::{Git, ObjectId};

type Dates = Arc<BTreeMap<String, String>>;

/// The dates last read, by the folder git shares between the working trees and the folder read,
/// with the tip they were read at.
type Kept = HashMap<(PathBuf, String), (ObjectId, Dates)>;

static KEPT: Mutex<Option<Kept>> = Mutex::new(None);

/// The date of the last commit of `branch` touching each file under `dir`, as `YYYY-MM-DD`, by
/// path from the top level. Read whole the first time, then, once the branch's tip moved on from
/// the tip it was read at, from the commits between them alone; read whole again when the tip
/// moved anywhere else, like a reset.
pub(super) fn last_changes(git: &Git, branch: &str, dir: &str) -> Dates {
    let Some(tip) = git.tip(branch) else {
        return Dates::default();
    };
    let key = (git.common_dir(), dir.to_string());
    let before = KEPT
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()
        .and_then(|kept| kept.get(&key).cloned());
    let dates = match before {
        Some((at, dates)) if at == tip => return dates,
        Some((at, dates)) if git.is_ancestor(at, tip) => git
            .last_changes(&format!("{at}..{tip}"), dir)
            .map(|newer| Arc::new(merged(&dates, newer))),
        _ => git.last_changes(&tip.to_string(), dir).map(Arc::new),
    };
    // A read that failed is read again next time.
    let Ok(dates) = dates else {
        return Dates::default();
    };
    KEPT.lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get_or_insert_with(HashMap::new)
        .insert(key, (tip, Arc::clone(&dates)));
    dates
}

/// The dates of `older`, each replaced by the one of `newer` when it is later.
fn merged(
    older: &BTreeMap<String, String>,
    newer: BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let mut dates = older.clone();
    for (path, date) in newer {
        let kept = dates.entry(path).or_default();
        if date > *kept {
            *kept = date;
        }
    }
    dates
}
