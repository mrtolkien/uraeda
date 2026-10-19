//! `names.*`: feature and change folders are `YYYY-MM-DD-<slug>` with a real date, rounds have two
//! digits, a change's folder holds only a change's files, and `specs/bugs/` is no longer used.

use std::fs;
use std::path::Path;

use crate::decisions::option_folder;
use crate::workspace::{FileKind, Problem, Severity, folder_slug};

fn name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Whether a folder holds a feature's or a change's files: a dated folder, or a postponed feature in
/// `drafts/` or `backlog/`.
pub(super) fn is_workflow_folder(dir: &Path) -> bool {
    let parent = dir.parent().map(name).unwrap_or_default();
    folder_slug(&name(dir)).is_some() || parent == "drafts" || parent == "backlog"
}

/// Checks the names of the folders directly inside `specs/` and `specs/changes/`.
pub(super) fn check_folder_names(root: &Path, dir: &Path, problems: &mut Vec<Problem>) {
    let here = name(dir);
    let parent = dir.parent().map(name).unwrap_or_default();
    let fixed: &[&str] = if here == "specs" {
        &[
            "drafts",
            "backlog",
            "decisions",
            "decisions-check",
            "changes",
            "done",
        ]
    } else if here == "changes" && parent == "specs" {
        &[]
    } else {
        return;
    };
    let mut folders: Vec<String> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
        .map(|entry| name(&entry.path()))
        .filter(|folder| !folder.starts_with('.'))
        .collect();
    folders.sort();
    for folder in folders {
        if fixed.contains(&folder.as_str()) || folder_slug(&folder).is_some() {
            continue;
        }
        if here == "specs" && folder == "bugs" {
            problems.push(Problem {
                file: super::relative(root, &dir.join(&folder)),
                line: None,
                rule: "names.bugs".into(),
                message: "specs/bugs/ is no longer used: bugs are changes. Move its folders to \
                          specs/changes/, and delete it if empty."
                    .into(),
                severity: Severity::Error,
            });
            continue;
        }
        problems.push(Problem {
            file: super::relative(root, &dir.join(&folder)),
            line: None,
            rule: "names.folder".into(),
            message: format!(
                "\"{folder}\" is not a feature folder: YYYY-MM-DD-<slug>, with a real date"
            ),
            severity: Severity::Error,
        });
    }
}

/// Whether a folder is the decisions check's, `specs/decisions-check/`.
fn is_check_folder(dir: &Path) -> bool {
    name(dir) == "decisions-check" && dir.parent().map(name).as_deref() == Some("specs")
}

/// Whether a folder holds the candidates of one option, `specs/decisions-check/q<N>-<letter>/`.
pub(super) fn is_candidate_folder(dir: &Path) -> bool {
    dir.parent().is_some_and(is_check_folder) && option_folder(&name(dir)).is_some()
}

/// Checks the entries of the decisions check's folder: only folders named `q<N>-<letter>`, each
/// holding decisions, never the constitution ("only a human amends the constitution").
pub(super) fn check_candidates(root: &Path, dir: &Path, problems: &mut Vec<Problem>) {
    let (check, option) = (is_check_folder(dir), is_candidate_folder(dir));
    if !check && !option {
        return;
    }
    let mut entries: Vec<(String, bool)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| {
            let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
            (name(&entry.path()), is_dir)
        })
        .filter(|(entry, _)| !entry.starts_with('.'))
        .collect();
    entries.sort();
    for (entry, is_dir) in entries {
        let message = if check && !(is_dir && option_folder(&entry).is_some()) {
            "the decisions check holds only folders named q<N>-<letter>, like q1-a"
        } else if option && entry == "CONSTITUTION.md" {
            "a check never changes the constitution: only a human amends it"
        } else if option && (is_dir || !entry.ends_with(".md")) {
            "a candidate is a decision: a Markdown file named after its topic"
        } else {
            continue;
        };
        problems.push(Problem {
            file: super::relative(root, &dir.join(&entry)),
            line: None,
            rule: "names.candidate".into(),
            message: message.into(),
            severity: Severity::Error,
        });
    }
}

/// Whether a change's folder, `specs/changes/<folder>/`, holds an entry of this name: its proposal,
/// its rounds, its rulings, and its `images/`, `mockups/`, and `screenshots/` folders. The one home
/// of the rule, for `ura check` and for `ura start --change`.
pub(crate) fn change_holds(entry: &str, is_dir: bool) -> bool {
    if is_dir {
        entry == "images" || entry == "mockups" || entry == "screenshots"
    } else {
        entry == "proposal.md"
            || entry == "rulings.md"
            || (entry.starts_with("clarifications-") && entry.ends_with(".md"))
    }
}

/// Whether a folder is a change's: a dated folder in `specs/changes/`.
fn is_change_folder(dir: &Path) -> bool {
    let parent = dir.parent();
    parent.map(name).as_deref() == Some("changes")
        && parent.and_then(Path::parent).map(name).as_deref() == Some("specs")
        && folder_slug(&name(dir)).is_some()
}

/// The problem of an entry of a change's folder that has no place in it.
fn change_file_problem(root: &Path, dir: &Path, entry: &str) -> Problem {
    Problem {
        file: super::relative(root, &dir.join(entry)),
        line: None,
        rule: "names.change-file".into(),
        message: format!(
            "\"{entry}\" has no place in a change: its folder holds proposal.md, \
             clarifications-NN.md, rulings.md, images/, mockups/, and screenshots/."
        ),
        severity: Severity::Error,
    }
}

/// Checks that a change's folder, `specs/changes/<folder>/`, holds only what `change_holds` allows.
pub(super) fn check_change_files(root: &Path, dir: &Path, problems: &mut Vec<Problem>) {
    if !is_change_folder(dir) {
        return;
    }
    let mut entries: Vec<(String, bool)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| {
            let is_dir = entry.file_type().is_ok_and(|t| t.is_dir());
            (name(&entry.path()), is_dir)
        })
        .filter(|(entry, _)| !entry.starts_with('.'))
        .collect();
    entries.sort();
    for (entry, is_dir) in entries {
        if !change_holds(&entry, is_dir) {
            problems.push(change_file_problem(root, dir, &entry));
        }
    }
}

/// Checks one file, as `check_change_files` checks it within its folder: a file directly in a
/// change's folder that the folder does not hold.
pub(super) fn check_change_file(root: &Path, path: &Path, problems: &mut Vec<Problem>) {
    let (Some(dir), entry) = (path.parent(), name(path)) else {
        return;
    };
    if is_change_folder(dir) && !entry.starts_with('.') && !change_holds(&entry, false) {
        problems.push(change_file_problem(root, dir, &entry));
    }
}

/// Checks that discovery and clarifications rounds have two digits.
pub(super) fn check_rounds(root: &Path, dir: &Path, names: &[String], problems: &mut Vec<Problem>) {
    for file in names {
        for prefix in ["discovery-", "clarifications-"] {
            let Some(round) = file
                .strip_prefix(prefix)
                .and_then(|r| r.strip_suffix(".md"))
            else {
                continue;
            };
            if FileKind::of(file).is_some() {
                continue;
            }
            let expected = match round.parse::<u32>() {
                Ok(number) => format!("{prefix}{number:02}.md"),
                Err(_) => format!("{prefix}01.md"),
            };
            problems.push(Problem {
                file: super::relative(root, &dir.join(file)),
                line: None,
                rule: "names.round".into(),
                message: format!("rounds have two digits: {expected}"),
                severity: Severity::Error,
            });
        }
    }
}
