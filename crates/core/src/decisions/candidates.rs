//! The candidates of a decisions check: the decision an option would leave, written as
//! `specs/decisions-check/q<N>-<letter>/<topic>.md`, each compared with the active decision of the
//! same name.

use std::fs;
use std::path::Path;

use serde::Serialize;

use super::{DecisionChange, compare};
use crate::git::{Git, ObjectId};

/// The folder of a check's candidates, from the top level.
pub const CHECK_DIR: &str = "specs/decisions-check";
const DECISIONS: &str = "specs/decisions";

/// The candidate of one option of a question of a decisions check.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    /// The question's folder part, like `q1`.
    pub question: String,
    /// The option's letter, lowercase, like `a`.
    pub option: String,
    /// The candidate against the active decision of the same name: a new decision when there is
    /// none.
    pub change: DecisionChange,
}

/// The question and the option letter of a candidate folder named `q<N>-<letter>`, like `q1-a`:
/// `("q1", "a")`. None for any other name.
pub fn option_folder(name: &str) -> Option<(&str, &str)> {
    let (question, option) = name.split_once('-')?;
    let digits = question.strip_prefix('q')?;
    let letter = option.len() == 1 && option.starts_with(|c: char| c.is_ascii_lowercase());
    (!digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) && letter)
        .then_some((question, option))
}

/// The folder a candidate's relative links resolve from, from the root: the `decisions/` folder
/// beside the check's, where the decision of the same name sits. None for a path that is no
/// candidate's.
pub fn links_folder(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();
    let [home @ .., check, option, _file] = parts.as_slice() else {
        return None;
    };
    (CHECK_DIR.ends_with(&format!("/{check}")) && option_folder(option).is_some()).then(|| {
        format!("{}/decisions", home.join("/"))
            .trim_start_matches('/')
            .to_string()
    })
}

/// A candidate's file, by folder name and file name, and its text.
struct Found {
    folder: String,
    file: String,
    text: String,
}

/// The candidates of the check in the checkout at `root`, ordered by question number, option, and
/// topic. A folder not named `q<N>-<letter>`, a file that is not Markdown, and the constitution are
/// no candidate: `ura check` reports them.
pub fn read(root: &Path) -> Vec<Candidate> {
    let read_dir = |dir: &Path| {
        let mut entries: Vec<_> = fs::read_dir(dir).into_iter().flatten().flatten().collect();
        entries.sort_by_key(|entry| entry.file_name());
        entries
    };
    let mut found = Vec::new();
    for folder in read_dir(&root.join(CHECK_DIR)) {
        let Ok(name) = folder.file_name().into_string() else {
            continue;
        };
        for file in read_dir(&folder.path()) {
            let (Ok(file_name), Ok(text)) = (
                file.file_name().into_string(),
                fs::read_to_string(file.path()),
            ) else {
                continue;
            };
            found.push(Found {
                folder: name.clone(),
                file: file_name,
                text,
            });
        }
    }
    build(found, |topic| {
        fs::read_to_string(root.join(DECISIONS).join(format!("{topic}.md"))).ok()
    })
}

/// The candidates of the check at the commit `tip`, as `read` reads them from a checkout.
pub fn read_at(git: &Git, tip: ObjectId) -> Vec<Candidate> {
    let prefix = format!("{CHECK_DIR}/");
    let found = git
        .list_files(tip, CHECK_DIR)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|path| {
            let (folder, file) = path.strip_prefix(&prefix)?.split_once('/')?;
            let text = String::from_utf8(git.read_file(tip, &path).ok().flatten()?).ok()?;
            Some(Found {
                folder: folder.to_string(),
                file: file.to_string(),
                text,
            })
        })
        .collect();
    build(found, |topic| {
        let bytes = git
            .read_file(tip, &format!("{DECISIONS}/{topic}.md"))
            .ok()
            .flatten()?;
        String::from_utf8(bytes).ok()
    })
}

fn build(found: Vec<Found>, active: impl Fn(&str) -> Option<String>) -> Vec<Candidate> {
    let mut candidates: Vec<Candidate> = found
        .into_iter()
        .filter_map(|found| {
            let (question, option) = option_folder(&found.folder)?;
            let topic = found.file.strip_suffix(".md")?;
            if topic == "CONSTITUTION" || topic.contains('/') {
                return None;
            }
            let before = active(topic);
            Some(Candidate {
                question: question.to_string(),
                option: option.to_string(),
                change: compare(topic, before.as_deref(), Some(&found.text)),
            })
        })
        .collect();
    let number = |candidate: &Candidate| candidate.question[1..].parse::<u64>().unwrap_or(0);
    candidates.sort_by(|a, b| {
        (number(a), &a.option, &a.change.name).cmp(&(number(b), &b.option, &b.change.name))
    });
    candidates
}
