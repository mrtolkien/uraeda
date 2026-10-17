//! The problems found in workflow files.

use serde::Serialize;

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
}
