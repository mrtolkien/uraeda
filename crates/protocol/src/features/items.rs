//! What the core reads in a workflow file besides its document: the items of a round of
//! questions, a plan, a review, and the rulings.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::document::Span;
use super::spec_items::{DataModelItems, SpecItems};

/// The items of a file, by its kind: at most one field is set.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Items {
    pub clarifications: Option<RoundItems>,
    pub spec: Option<SpecItems>,
    pub plan: Option<PlanItems>,
    pub data_model: Option<DataModelItems>,
    pub review: Option<ReviewItems>,
    pub rulings: Option<Vec<Ruling>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RoundItems {
    pub status: Option<String>,
    /// The `> [!IMPORTANT]` block, or its `> [!NOTE]` record.
    pub block: Option<u32>,
    /// The block's verdict, from its item starting "Verdict: ".
    pub verdict: Option<RoundVerdict>,
    /// The parts of the round's context section, in file order.
    pub context: Vec<ContextPart>,
    pub questions: Vec<QuestionItem>,
    /// The groups of the points settled without the human: the `## Check these` section, then
    /// `## Settled without the human`, up to the `**Notes:**` line.
    pub settled_groups: Vec<SettledGroup>,
    /// The settled points that start in bold, which take comments, the points to check included.
    pub settled_points: Vec<SettledPoint>,
    /// The free notes, trimmed, without the comments on settled points.
    pub notes: Option<String>,
    pub notes_line: Option<u32>,
    /// The comments on settled points, written at the end of the notes.
    pub settled_comments: Vec<SettledComment>,
}

/// The block's item starting "Verdict: ", then one of the three phrases.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RoundVerdict {
    pub kind: VerdictKind,
    /// Its list item's block.
    pub item: u32,
    /// The item's spans after the phrase and its following ":" or ",", trimmed, the first letter
    /// capitalised.
    pub text: Vec<Span>,
}

/// The verdict of a round's block, by its phrase.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum VerdictKind {
    /// "worth building as proposed".
    AsProposed,
    /// "worth building, with changes".
    WithChanges,
    /// "not as proposed".
    NotAsProposed,
}

/// A part of a round's context: a `###` sub-heading and its blocks.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ContextPart {
    /// Its heading's block, or none for the triage's one free part.
    pub heading: Option<u32>,
    /// Its heading's text, empty without a heading.
    pub title: String,
    /// Its top-level blocks.
    pub blocks: Vec<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct QuestionItem {
    /// `Q2`, or `Q2.B`.
    pub id: String,
    pub parent: Option<String>,
    /// The parent's option a follow-up depends on.
    pub parent_letter: Option<String>,
    pub title: String,
    pub start_line: u32,
    pub end_line: u32,
    pub heading_block: u32,
    /// Its context: the blocks between its heading and its answer, options and "Why it matters"
    /// aside.
    pub context: Vec<u32>,
    /// Its paragraph starting "Why it matters".
    pub why: Option<u32>,
    /// Its "Why it matters" paragraph's spans without the lead, which its pane's title says, nor the
    /// ":", "." or "—" after it, its first letter capitalised: empty without the paragraph.
    pub why_text: Vec<Span>,
    /// Its first paragraph starting "Example:", left out of its context.
    pub example: Option<u32>,
    /// Its example's spans without "Example:", its first letter capitalised: empty without one.
    pub example_text: Vec<Span>,
    pub options: Vec<Choice>,
    pub answer: String,
    /// The answer split as the UI composes it.
    pub letters: Vec<String>,
    pub comment: String,
    /// `yes` or `no`: whether it needs an answer, from its parent's letters.
    pub applies: String,
    /// Whether the round asks it now: it may apply, and a follow-up's parent has an answer.
    pub asked: bool,
    /// The line of its `**Answer:**` marker, or 0.
    pub answer_line: u32,
}

/// An option of a question.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    pub letter: String,
    pub recommended: bool,
    /// The option's text, without its letter.
    pub summary: Vec<Span>,
    /// The item blocks of its `[pro]` and `[con]` bullets.
    pub pros: Vec<u32>,
    pub cons: Vec<u32>,
    /// Its "Why recommended" item.
    pub why: Option<u32>,
    /// Its other nested blocks.
    pub other: Vec<u32>,
    /// Its item block.
    pub block: u32,
}

/// A group of the points settled without the human: the `## Check these` section, or
/// `## Settled without the human`, and its blocks.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledGroup {
    /// Its `##` heading's block.
    pub heading: u32,
    /// Its kind, from its heading.
    pub kind: SettledKind,
    /// Its top-level blocks, before any sub-heading and the `**Notes:**` line.
    pub blocks: Vec<u32>,
    /// How many points it holds: the items of its lists that start in bold, as `settled_points`
    /// gives them.
    pub points: u32,
}

/// The kind of a settled group: `## Check these`, the points the human may object to, or
/// `## Settled without the human`, the others.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum SettledKind {
    Check,
    Settled,
}

/// A point settled without the human, by its bold start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledPoint {
    /// Its list item's block.
    pub block: u32,
    /// Its bold start, trimmed.
    pub subject: String,
}

/// A comment on a settled point: a bullet of the notes, `- **<subject>**: <text>`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettledComment {
    /// 1-based, in the notes' order.
    pub number: u32,
    pub subject: String,
    /// The block of the first settled point with that subject.
    pub point: u32,
    /// Its text, without the bullet, the subject, or the indentation.
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PlanItems {
    /// Its lead paragraphs, "**Goal:**" and the like, before its first `##`.
    pub lead: Vec<PlanLead>,
    pub tasks: Vec<TaskItem>,
}

/// A plan's lead paragraph: a top-level paragraph before the first `##` whose first span is bold
/// text ending in ":", such as "**Goal:**".
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PlanLead {
    /// The bold text without its colon: `Goal`, `Architecture`, `Spec`.
    pub label: String,
    /// The paragraph's block.
    pub block: u32,
    /// The paragraph's spans without the bold label and the space after it, which its pane's title
    /// says: empty for a label alone.
    pub text: Vec<Span>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub number: u32,
    pub title: String,
    pub heading_block: u32,
    pub steps: Vec<StepItem>,
    pub done: u32,
    pub total: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct StepItem {
    pub block: u32,
    pub checked: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReviewItems {
    pub verdict: String,
    pub commit: String,
    pub summary: Option<String>,
    pub comments: Vec<CommentItem>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CommentItem {
    pub number: u32,
    /// The lines it points to, 0 for a general comment.
    pub start_line: u32,
    pub end_line: u32,
    pub heading: Option<String>,
    pub general: bool,
    /// The decision whose file the lines are of, `specs/decisions/<name>.md`, not the reviewed
    /// file's.
    pub decision: Option<String>,
    /// Whether the lines are of a part the branch removed from the decision, at the merge base.
    pub removed: bool,
    pub quote: Vec<String>,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Ruling {
    /// `R1`.
    pub id: String,
    pub title: String,
    pub heading_block: u32,
    pub blocks: Vec<u32>,
}
