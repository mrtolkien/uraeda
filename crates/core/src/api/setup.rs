//! What a project lacks to be set up for Uraeda: the `specs/` folder, the constitution, and the
//! decisions the skill's [setting up a project](/skills/uraeda/references/projects.md#setting-up-a-project)
//! has the agent write, in its order. The files are read where the ledger reads them, from the
//! default branch, so every checkout lists the same items.

use std::path::Path;

use serde::Serialize;

use super::Result;
use super::ledger::{checkout_of, lossy};
use crate::embedded::{has_placeholder_span, reference_labels};
use crate::git::Git;

const CONSTITUTION: &str = "specs/CONSTITUTION.md";
const DECISIONS_FOLDER: &str = "specs/decisions";

/// An item of the setup.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupItem {
    /// `specs`, `constitution`, `code-quality`, `testing`, or `preview`.
    pub key: String,
    /// What the human reads, like `Code-quality decision`.
    pub name: String,
    /// `missing`, `template` for a constitution still holding a placeholder, or `written`.
    pub state: String,
    /// Whether the project is set up only once it is written: the preview decision is not.
    pub required: bool,
}

/// The decisions of the setup, by key, file name, name, and whether each is required. A decision
/// counts as written once its file exists, whatever its status: the setup leaves it `proposed`.
const DECISIONS: [(&str, &str, &str, bool); 3] = [
    (
        "code-quality",
        "code-quality.md",
        "Code-quality decision",
        true,
    ),
    ("testing", "testing.md", "Testing decision", true),
    ("preview", "preview.md", "Preview decision", false),
];

fn item(key: &str, name: &str, state: &str, required: bool) -> SetupItem {
    SetupItem {
        key: key.to_string(),
        name: name.to_string(),
        state: state.to_string(),
        required,
    }
}

/// The setup's items, for a repository with `specs/`: every item while a required one is not
/// written, and none once the project is set up.
pub fn read_setup(repo: &Path) -> Result<Vec<SetupItem>> {
    let git = Git::discover(repo)?;
    Ok(setup_items(&git, true))
}

/// The setup's items, the `specs/` folder's only when `has_specs` is false: every item while a
/// required one is not written, and none once they all are.
pub(crate) fn setup_items(git: &Git, has_specs: bool) -> Vec<SetupItem> {
    let (constitution, written) = read_files(git);
    let mut items = Vec::new();
    if !has_specs {
        items.push(item("specs", "specs/ folder", "missing", true));
    }
    items.push(item(
        "constitution",
        "Constitution",
        constitution_state(constitution.as_deref()),
        true,
    ));
    for (key, file, name, required) in DECISIONS {
        let state = if written.contains(&file) {
            "written"
        } else {
            "missing"
        };
        items.push(item(key, name, state, required));
    }
    if items
        .iter()
        .all(|item| !item.required || item.state == "written")
    {
        return Vec::new();
    }
    items
}

/// The constitution's text, and which of the setup's decision files exist, read where the ledger
/// reads them: the default branch's checkout, this one without a default branch, else its tip.
/// The decisions are only looked up, not read, as the workspace reads them after every change.
fn read_files(git: &Git) -> (Option<String>, Vec<&'static str>) {
    let default = git.default_branch();
    let files = DECISIONS.map(|(_, file, _, _)| file);
    if let Some(root) = checkout_of(git, default.as_deref()) {
        let constitution = std::fs::read(root.join(CONSTITUTION)).ok().map(lossy);
        let written = files
            .into_iter()
            .filter(|file| root.join(DECISIONS_FOLDER).join(file).is_file())
            .collect();
        return (constitution, written);
    }
    let Some(tip) = default.as_deref().and_then(|default| git.tip(default)) else {
        return (None, Vec::new());
    };
    let constitution = git.read_file(tip, CONSTITUTION).ok().flatten().map(lossy);
    let written = files
        .into_iter()
        .filter(|file| {
            git.entry_id(tip, &format!("{DECISIONS_FOLDER}/{file}"))
                .is_some()
        })
        .collect();
    (constitution, written)
}

fn constitution_state(constitution: Option<&str>) -> &'static str {
    match constitution {
        None => "missing",
        Some(text) if is_template(text) => "template",
        Some(_) => "written",
    }
}

/// Whether a constitution is still the template: its `#` title, a `###` heading, a list item, or
/// its lines holding `**Ratified**` or `**Last Amended**` have a bracketed placeholder. Fenced code
/// is skipped, and so is a list item's task box, `[ ]` or `[x]`.
fn is_template(text: &str) -> bool {
    let labels = reference_labels(text);
    let mut fenced = false;
    text.lines().any(|line| {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            fenced = !fenced;
            return false;
        }
        !fenced && checked_line(trimmed) && has_placeholder_span(without_task_box(trimmed), &labels)
    })
}

/// Whether a line, without its indent, is one a placeholder makes the template: the title, a
/// principle's name, a rule, or the dates.
fn checked_line(line: &str) -> bool {
    let ordered = line.split_once(['.', ')']).is_some_and(|(number, rest)| {
        !number.is_empty()
            && number.bytes().all(|byte| byte.is_ascii_digit())
            && rest.starts_with(' ')
    });
    line.starts_with("# ")
        || line.starts_with("### ")
        || line.starts_with("- ")
        || line.starts_with("* ")
        || line.starts_with("+ ")
        || ordered
        || line.contains("**Ratified**")
        || line.contains("**Last Amended**")
}

/// A list item without its task box, `- [ ] ` or `- [x] `: other lines as they are.
fn without_task_box(line: &str) -> &str {
    for marker in ["- ", "* ", "+ "] {
        for task_box in ["[ ] ", "[x] ", "[X] "] {
            if let Some(rest) = line
                .strip_prefix(marker)
                .and_then(|rest| rest.strip_prefix(task_box))
            {
                return rest;
            }
        }
    }
    line
}
