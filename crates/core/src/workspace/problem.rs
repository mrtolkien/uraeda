//! The problems found in workflow files.

use serde::Serialize;

/// How much a problem matters: an error fails `ura check`, a warning does not.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Severity {
    #[default]
    Error,
    Warning,
}

/// A problem in a workflow file.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Problem {
    /// From the repository's top level.
    pub file: String,
    pub line: Option<usize>,
    /// A stable id, like `frontmatter.status`.
    pub rule: String,
    pub message: String,
    pub severity: Severity,
    /// Whether `ura check --fix` repairs it: a link to a file whose move git's history knows.
    /// Serialized only when true.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub fixable: bool,
}

/// The rules whose check results stop the workflow: a feature's problems. The step cannot be
/// found, the first four, or an answered round misses a human's answer, `answers.blank`. The
/// workspace's own problems, which set the step to `none`, block whatever this list holds.
///
/// The [Feature status](/specs/decisions/feature-status.md) decision: "A check result counts as a
/// feature's problem only when it stops the workflow. Anything else is a note"
/// A new rule is a note, left out of this list, unless the workflow cannot go on without a fix.
pub const BLOCKING: &[&str] = &[
    "frontmatter.status",
    "frontmatter.parse",
    "frontmatter.kind",
    "file.utf8",
    "answers.blank",
];

impl Problem {
    /// Whether it stops the workflow: a feature's problem rather than a note.
    pub fn blocks(&self) -> bool {
        BLOCKING.contains(&self.rule.as_str())
    }
}
