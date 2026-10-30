//! What a project lacks to be set up for Uraeda: the `specs/` folder, the constitution, and the
//! decisions the skill's [setting up a project](/skills/uraeda/references/projects.md#setting-up-a-project)
//! has the agent write, in its order. The files are read where the ledger reads them, from the
//! default branch, so every checkout lists the same items.

use std::path::Path;

use serde::Serialize;

use super::Result;
use super::ledger::{Texts, source};
use crate::git::Git;

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
    let (texts, _, _) = source(git, git.default_branch().as_deref());
    let mut items = Vec::new();
    if !has_specs {
        items.push(item("specs", "specs/ folder", "missing", true));
    }
    items.push(item(
        "constitution",
        "Constitution",
        constitution_state(&texts),
        true,
    ));
    for (key, file, name, required) in DECISIONS {
        let state = if texts.decisions.contains_key(file) {
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

fn constitution_state(texts: &Texts) -> &'static str {
    match &texts.constitution {
        None => "missing",
        Some(text) if is_template(text) => "template",
        Some(_) => "written",
    }
}

/// Whether a constitution is still the template: its `#` title, a `###` heading, a list item, or
/// its line holding `**Ratified**` has a bracketed placeholder. Fenced code is skipped.
fn is_template(text: &str) -> bool {
    let mut fenced = false;
    text.lines().any(|line| {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            fenced = !fenced;
            return false;
        }
        !fenced && checked_line(trimmed) && has_placeholder(trimmed)
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
}

/// Whether a line has a bracketed span, like `[Project]`, that is not a link (`[…](…)` or
/// `[…][…]`), an image, a callout (`[!…]`), or inside a code span.
fn has_placeholder(line: &str) -> bool {
    let bytes = line.as_bytes();
    let mut at = 0;
    let mut code = false;
    while at < bytes.len() {
        match bytes[at] {
            b'`' => code = !code,
            b'\\' => at += 1,
            b'[' if !code => {
                let Some(close) = closing(bytes, at) else {
                    return false;
                };
                if is_placeholder_span(bytes, at, close) {
                    return true;
                }
                at = close;
            }
            _ => {}
        }
        at += 1;
    }
    false
}

/// The index of the `]` closing the `[` at `open`, counting nested brackets.
fn closing(bytes: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0;
    for (index, byte) in bytes.iter().enumerate().skip(open) {
        match byte {
            b'[' => depth += 1,
            b']' => depth -= 1,
            _ => continue,
        }
        if depth == 0 {
            return Some(index);
        }
    }
    None
}

/// Whether the span from `open` to `close` is a placeholder: not an image, a callout, or a link.
fn is_placeholder_span(bytes: &[u8], open: usize, close: usize) -> bool {
    let image = open > 0 && bytes[open - 1] == b'!';
    let callout = bytes.get(open + 1) == Some(&b'!');
    let link = matches!(bytes.get(close + 1), Some(b'(' | b'['));
    !(image || callout || link)
}
