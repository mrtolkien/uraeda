//! What a command acts on: a path under `specs/`, or a name matching exactly one item, the same
//! way for every command (see `specs/decisions/cli.md`).

use std::path::{Component, Path, PathBuf};

use crate::steps::StepName;
use crate::workspace::{Workspace, branch_folder};

/// What the command is for, which decides the candidates and what waits for it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    /// A round of questions waiting for answers.
    Answers,
    /// A spec, plan, or assessment waiting for a review.
    Review,
    /// Any feature or bug, to read it.
    Inspect,
    /// A draft to start.
    Start,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Target {
    /// A feature or bug, by its index in the workspace.
    Feature(usize),
    /// A file of a feature or bug, by name.
    File(usize, String),
    /// A draft file or postponed folder, from the top level: `specs/drafts/x.md`.
    Draft(String),
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum TargetError {
    #[error("{name} matches {} items: {}", .items.len(), .items.join(", "))]
    Several { name: String, items: Vec<String> },
    #[error("no feature or draft named {0}")]
    NotFound(String),
    #[error("no feature or draft at {0}")]
    NoPath(String),
    #[error("several items wait: name one of {}", .0.join(", "))]
    SeveralWaiting(Vec<String>),
    #[error("{0}")]
    NothingWaits(&'static str),
}

/// A path joined to the current folder, with `.` and `..` resolved without reading the disk:
/// the file may exist only on another branch.
fn normalize(cwd: &Path, path: &str) -> PathBuf {
    let mut parts = PathBuf::new();
    for component in cwd.join(path).components() {
        match component {
            Component::ParentDir => {
                parts.pop();
            }
            Component::CurDir => {}
            other => parts.push(other),
        }
    }
    parts
}

fn looks_like_a_path(target: &str) -> bool {
    target.contains('/') || target.ends_with(".md") || target == "." || target == ".."
}

/// Resolves a command's target.
pub fn resolve(
    workspace: &Workspace,
    cwd: &Path,
    target: Option<&str>,
    purpose: Purpose,
) -> Result<Target, TargetError> {
    match target {
        Some(target) if looks_like_a_path(target) => by_path(workspace, cwd, target, purpose),
        Some(name) => by_name(workspace, name, purpose),
        None => waiting(workspace, purpose),
    }
}

fn by_path(
    workspace: &Workspace,
    cwd: &Path,
    target: &str,
    purpose: Purpose,
) -> Result<Target, TargetError> {
    let root = workspace
        .root
        .canonicalize()
        .unwrap_or(workspace.root.clone());
    let cwd = cwd.canonicalize().unwrap_or(cwd.to_path_buf());
    let absolute = normalize(&cwd, target);
    let relative = absolute
        .strip_prefix(&root)
        .map_err(|_| TargetError::NoPath(target.to_string()))?
        .to_string_lossy()
        .trim_end_matches('/')
        .to_string();
    if purpose == Purpose::Start {
        return workspace
            .drafts
            .iter()
            .find(|draft| {
                **draft == relative
                    || draft.strip_suffix("/proposal.md") == Some(relative.as_str())
                    || relative.strip_suffix("/proposal.md") == Some(draft.as_str())
            })
            .map(|draft| Target::Draft(draft.clone()))
            .ok_or_else(|| TargetError::NoPath(target.to_string()));
    }
    for (index, feature) in workspace.features.iter().enumerate() {
        if relative == feature.path && !feature.is_finished() {
            return Ok(Target::Feature(index));
        }
        if let Some(file) = feature.owns(&relative) {
            return Ok(Target::File(index, file.to_string()));
        }
    }
    Err(TargetError::NoPath(target.to_string()))
}

/// The folders drafts are written in, from the top level, on the default branch.
const DRAFT_FOLDERS: [&str; 2] = ["specs/drafts/", "specs/backlog/"];

/// Whether a path from the top level is under `specs/drafts/` or `specs/backlog/`: a draft, a
/// postponed folder, or a file of one, all written on the default branch.
pub fn is_draft(path: &str) -> bool {
    DRAFT_FOLDERS.iter().any(|folder| path.starts_with(folder))
}

/// The draft a path under `specs/drafts/` or `specs/backlog/` starts, from the top level: the
/// file itself, or the postponed folder that holds it. `None` for any other path.
pub fn draft_to_start(path: &str) -> Option<String> {
    let folder = DRAFT_FOLDERS
        .iter()
        .find(|folder| path.starts_with(*folder))?;
    let rest = &path[folder.len()..];
    match rest.split_once('/') {
        Some((postponed, _)) => Some(format!("{folder}{postponed}")),
        None if rest.is_empty() => None,
        None => Some(path.to_string()),
    }
}

/// A draft's name: its file's stem, or its postponed folder's name.
pub fn draft_name(draft: &str) -> &str {
    let last = draft.rsplit('/').next().unwrap_or(draft);
    last.strip_suffix(".md").unwrap_or(last)
}

fn by_name(workspace: &Workspace, name: &str, purpose: Purpose) -> Result<Target, TargetError> {
    let items: Vec<(String, Target)> = if purpose == Purpose::Start {
        workspace
            .drafts
            .iter()
            .map(|draft| (draft_name(draft).to_string(), Target::Draft(draft.clone())))
            .collect()
    } else {
        workspace
            .features
            .iter()
            .enumerate()
            .map(|(index, feature)| (feature.folder.clone(), Target::Feature(index)))
            .collect()
    };
    let exact: Vec<&(String, Target)> = items
        .iter()
        .filter(|(item, target)| {
            item == name
                || matches!(target, Target::Feature(index) if workspace.features[*index].slug == name)
        })
        .collect();
    let found = if exact.is_empty() {
        items
            .iter()
            .filter(|(item, _)| item.contains(name))
            .collect()
    } else {
        exact
    };
    match found.as_slice() {
        [] => Err(TargetError::NotFound(name.to_string())),
        [(_, target)] => Ok(target.clone()),
        several => Err(TargetError::Several {
            name: name.to_string(),
            items: several.iter().map(|(item, _)| item.clone()).collect(),
        }),
    }
}

fn waiting(workspace: &Workspace, purpose: Purpose) -> Result<Target, TargetError> {
    if let Some(index) = workspace
        .current_branch
        .as_deref()
        .and_then(branch_folder)
        .and_then(|(_, folder)| workspace.features.iter().position(|f| f.folder == folder))
    {
        return Ok(Target::Feature(index));
    }
    let gate = |index: &usize| {
        let step = &workspace.features[*index].step;
        let file = step.file.as_deref().unwrap_or_default();
        step.name == StepName::HumanGate
            && match purpose {
                Purpose::Answers => file.starts_with("clarifications-"),
                Purpose::Review => ["spec.md", "plan.md", "assessment.md"].contains(&file),
                _ => false,
            }
    };
    let candidates: Vec<usize> = (0..workspace.features.len()).filter(gate).collect();
    match candidates.as_slice() {
        [index] => Ok(Target::Feature(*index)),
        [] => Err(TargetError::NothingWaits(match purpose {
            Purpose::Answers => "no round of questions waits for answers",
            Purpose::Review => "no spec, plan, or assessment waits for a review",
            Purpose::Start => "name a draft: ura start <draft>",
            Purpose::Inspect => "name a feature or a bug",
        })),
        several => Err(TargetError::SeveralWaiting(
            several
                .iter()
                .map(|index| workspace.features[*index].folder.clone())
                .collect(),
        )),
    }
}
