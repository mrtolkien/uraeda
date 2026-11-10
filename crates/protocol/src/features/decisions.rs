//! The decisions, compared and read: a decision's change on a branch, the candidates of a
//! decisions check, and the constitution and the decisions of the default branch.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::ItemArgs;
use super::document::{Document, LineRange};
use crate::registry::Record;
use crate::shared::ProblemView;
use crate::shared::RepositoryArgs;

/// The constitution and the decisions of the default branch, kept live.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Ledger {
    /// The constitution: none without `specs/CONSTITUTION.md`.
    pub constitution: Option<Constitution>,
    /// The decisions, by file name: none without `specs/decisions/`.
    pub decisions: Vec<Decision>,
    /// Every problem `ura check` finds in the decisions.
    pub problems: Vec<ProblemView>,
    /// The status of `DECISIONS-CHECK.md`: none when there is no check.
    pub decisions_check: Option<String>,
}

impl Record for Ledger {
    const NAME: &'static str = "Ledger";
    type Args = RepositoryArgs;
    type Value = Self;
}

/// A decision as a feature's branch has it, by `<folder>/<name>`. Its value is `null` when the
/// branch has no such decision, and when no feature has that folder.
impl Record for BranchDecision {
    const NAME: &'static str = "BranchDecision";
    type Args = ItemArgs;
    type Value = Option<Self>;
}

/// The change of one decision, from its version at the merge base to the branch's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DecisionChange {
    /// The file's name, without `.md`.
    pub name: String,
    /// Its `# ` heading, from the branch's version when it has one.
    pub title: String,
    /// `new`, `changed`, or `removed`.
    pub kind: String,
    /// Whether the spec's `## Decisions` lists it.
    pub listed: bool,
    /// Whether both versions could be read.
    pub compared: bool,
    /// The title and the frontmatter fields whose value differs, for a changed decision.
    pub fields: Vec<FieldChange>,
    pub sections: Vec<SectionChange>,
}

/// A field of a decision that differs between two versions: its `title`, or a frontmatter key.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub name: String,
    /// Its value in the merge base's version, `None` when it had none.
    pub before: Option<String>,
    /// Its value in the branch's version, `None` when it has none.
    pub after: Option<String>,
}

/// A section of a decision: the intent before the first `##`, titled `""`, then each `##`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SectionChange {
    pub title: String,
    pub parts: Vec<PartChange>,
}

/// A paragraph or a list item of a decision, compared.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PartChange {
    /// `kept`, `changed`, `added`, or `removed`.
    pub kind: String,
    /// A list item's strength, as `Strength::as_str` names it.
    pub strength: Option<String>,
    /// Its lines in the merge base's version, from the file's first line.
    pub before: Option<LineRange>,
    /// Its lines in the branch's version, from the file's first line.
    pub after: Option<LineRange>,
    /// The part's words. For a rule, the words before its check.
    pub runs: Vec<Run>,
    /// For a rule, the words of its check, from "Checked by"; empty for any other part.
    pub check: Vec<Run>,
}

/// Words of a part, joined with single spaces, all `kept`, `added`, or `removed`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub kind: String,
    pub text: String,
}

/// The candidate of one option of a question of a decisions check.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
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

/// A decision as a feature's branch has it, and its change against the merge base of the branch
/// and the default branch.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BranchDecision {
    /// The file's name, without `.md`.
    pub name: String,
    /// The feature's folder.
    pub folder: String,
    pub change: DecisionChange,
    /// The branch's version of the file.
    pub document: Document,
}

/// `specs/CONSTITUTION.md`: its title, its version line's fields when it has them, and its
/// principles, the `### <number>. <title>` headings.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Constitution {
    pub title: String,
    /// From `**Version**: 1.3.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-14`.
    pub version: Option<String>,
    pub ratified: Option<String>,
    pub amended: Option<String>,
    pub principles: Vec<Principle>,
    pub document: Document,
}

/// A principle of the constitution.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Principle {
    /// Its Roman numeral, like `IV`.
    pub number: String,
    /// Its numeral in lower case, like `iv`, for its address.
    pub slug: String,
    pub title: String,
    /// The ids of its heading and of the top-level blocks under it, up to the next heading of its
    /// level or above, in the constitution's document.
    pub blocks: Vec<u32>,
}

/// A decision of `specs/decisions/`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Decision {
    /// Its file name without `.md`, like `ui-behaviour`.
    pub name: String,
    /// Its H1, else, or when it is unreadable, its name.
    pub title: String,
    /// Its frontmatter's fields, when they are text.
    pub status: Option<String>,
    pub approved_by: Option<String>,
    /// A Lucide icon name, like `git-branch`.
    pub icon: Option<String>,
    /// The first sentence of its first paragraph, when one comes before its first section.
    pub summary: Option<String>,
    /// The date of the last commit of the default branch touching it, `YYYY-MM-DD`.
    pub changed: Option<String>,
    /// Its file as read, frontmatter included: what a preview shows.
    pub text: String,
    pub document: Document,
    /// The kept parts of its `## Rules` section, each with its strength and its check; empty for
    /// an unreadable file or one without the section.
    pub rules: Vec<PartChange>,
    /// The first problem `ura check` finds in it.
    pub problem: Option<String>,
    /// Whether it cannot be parsed, like a frontmatter that is not valid YAML: its title is then its
    /// name, and nothing else read from it stands.
    pub unreadable: bool,
}
