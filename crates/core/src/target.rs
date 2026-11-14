//! What a command acts on: a path under `specs/`, or a name matching exactly one item, the same
//! way for every command (see `specs/decisions/cli.md`).

use std::path::{Component, Path, PathBuf};

use crate::steps::StepName;
use crate::workspace::{Feature, Workspace, branch_folder};

/// What the command is for, which decides the candidates and what waits for it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    /// A round of questions waiting for answers.
    Answers,
    /// A spec or a plan waiting for a review.
    Review,
    /// Any feature or change, to read it.
    Inspect,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Target {
    /// A feature or change, by its index in the workspace.
    Feature(usize),
    /// A file of a feature or change, by name.
    File(usize, String),
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum TargetError {
    #[error("{name} matches {} items: {}", .items.len(), .items.join(", "))]
    Several { name: String, items: Vec<String> },
    #[error("no feature or proposal named {0}")]
    NotFound(String),
    #[error("no feature or proposal at {0}")]
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
        Some(name) => by_name(workspace, name),
        None => waiting(workspace, purpose),
    }
}

fn by_path(
    workspace: &Workspace,
    cwd: &Path,
    target: &str,
    _purpose: Purpose,
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

fn by_name(workspace: &Workspace, name: &str) -> Result<Target, TargetError> {
    let items: Vec<(String, Target)> = workspace
        .features
        .iter()
        .enumerate()
        .map(|(index, feature)| (feature.folder.clone(), Target::Feature(index)))
        .collect();
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

/// Whether a feature or change waits at a gate for the human's action: a round of questions for
/// [`Purpose::Answers`], a spec or a plan for [`Purpose::Review`].
pub fn waits_for(feature: &Feature, purpose: Purpose) -> bool {
    let step = &feature.step;
    let file = step.file.as_deref().unwrap_or_default();
    step.name == StepName::HumanGate
        && match purpose {
            Purpose::Answers => file.starts_with("clarifications-"),
            Purpose::Review => ["spec.md", "plan.md"].contains(&file),
            Purpose::Inspect => false,
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
    let gate = |index: &usize| waits_for(&workspace.features[*index], purpose);
    let candidates: Vec<usize> = (0..workspace.features.len()).filter(gate).collect();
    match candidates.as_slice() {
        [index] => Ok(Target::Feature(*index)),
        [] => Err(TargetError::NothingWaits(match purpose {
            Purpose::Answers => "no round of questions waits for answers",
            Purpose::Review => "no spec or plan waits for a review",
            Purpose::Inspect => "name a feature or a change",
        })),
        several => Err(TargetError::SeveralWaiting(
            several
                .iter()
                .map(|index| workspace.features[*index].folder.clone())
                .collect(),
        )),
    }
}
