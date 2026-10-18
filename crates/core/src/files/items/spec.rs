//! The items of a spec: its parts, its block, the answers to the last review, the decisions it
//! lists, its stories and their scenarios and mockups, its edge cases, criteria, architecture, and
//! principles, and the risk tiers an approval may pick.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::document::Span;
use crate::files::stories::StoryTarget;

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    pub number: u32,
    pub block: u32,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    /// `US2`.
    pub id: String,
    pub title: String,
    /// `P1`.
    pub priority: String,
    pub heading_block: u32,
    /// Its top-level blocks after the heading.
    pub blocks: Vec<u32>,
    /// Its "Why this priority" paragraph.
    pub why: Option<u32>,
    /// Its first paragraph holding only a story link, or a link to an HTML mockup.
    pub mockup: Option<u32>,
    /// The list after its paragraph "Key scenarios:".
    pub key: Vec<Scenario>,
    /// The list after its paragraph "More scenarios:", which the page folds.
    pub more: Vec<Scenario>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Criterion {
    /// `SC-001`.
    pub id: String,
    /// The few words in parentheses after its id, `two clicks`.
    pub measure: Option<String>,
    /// The item's spans after its id and its measure, and the `: ` or `): ` ending them, its marks
    /// kept.
    pub sentence: Vec<Span>,
    pub block: u32,
}

/// An answer of `## Your review` to a comment of the last review:
/// `- **C2** (undo too short): done. The undo stays 5 seconds.`
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewAnswer {
    /// The comment's number in the last review file.
    pub number: u32,
    /// The comment in a few words, from the parentheses.
    pub summary: String,
    /// `done` or `declined`.
    pub verdict: String,
    /// Its list item.
    pub block: u32,
}

/// An item of `## Decisions`: a decision the spec creates, changes, or removes.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedDecision {
    /// `new`, `changed`, or `removed`.
    pub kind: String,
    /// The decision file's stem, `task-storage`.
    pub name: String,
    /// Its link's text, or a removed decision's bold title.
    pub title: String,
    /// Its list item.
    pub block: u32,
}

/// A level-2 section of a spec, in file order.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecPart {
    pub title: String,
    /// Its heading's anchor, `user-stories`.
    pub anchor: String,
    /// Its heading's block.
    pub heading: u32,
    /// Its top-level blocks after the heading, deeper headings included, up to the next level-1
    /// or level-2 heading.
    pub blocks: Vec<u32>,
}

/// A row of the `## Edge cases` table.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeCase {
    /// Its first cell's text, lowercased: `high`, `normal`, or `niche` when it is valid.
    pub importance: String,
    /// Its row's block.
    pub row: u32,
}

/// A principle of the `## Constitution check` table: a header cell, and the cell below it.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Principle {
    /// The header cell's text, `I. Humans in control`.
    pub label: String,
    /// Whether the cell below holds ✅.
    pub ok: bool,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecItems {
    pub stories: Vec<Story>,
    pub criteria: Vec<Criterion>,
    /// The frontmatter's `risk-tier` and `plan-review`, which an approval may change.
    pub risk_tier: Option<String>,
    pub plan_review: Option<bool>,
    /// The risk tiers an approval may pick, from the least risk to the most.
    pub tiers: Vec<TierChoice>,
    /// The story and HTML mockups the stories link, in file order.
    pub mockups: Vec<MockupLink>,
    /// The block: the first top-level callout before the first level-2 heading.
    pub block: Option<u32>,
    /// The block's time, the number before "minutes" in its first paragraph.
    pub minutes: Option<u32>,
    /// The block's first list item starting "You approve".
    pub approve: Option<u32>,
    /// The items of `## Your review`.
    pub answers: Vec<ReviewAnswer>,
    /// The items of `## Decisions`, each decision once; not the "Relied on" table.
    pub decisions: Vec<ListedDecision>,
    /// Each level-2 section, in file order.
    pub parts: Vec<SpecPart>,
    /// The rows of the `## Edge cases` table, its header aside.
    pub edges: Vec<EdgeCase>,
    /// The bold-led list items of `## Architecture` before its paragraph "Tradeoffs:".
    pub units: Vec<u32>,
    /// The list items of `## Architecture` after its paragraph "Tradeoffs:".
    pub tradeoffs: Vec<u32>,
    /// The principles of the `## Constitution check` table.
    pub principles: Vec<Principle>,
}

/// A link of a spec's story to an HTML file under `mockups/`, or to a story.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockupLink {
    /// `mockups/repeat.html`, from the spec's folder, or a story's stories file, from the
    /// repository's top level.
    pub path: String,
    /// The link's text.
    pub label: String,
    /// The selectable block holding the link: its list item, row, or paragraph.
    pub block: u32,
    /// The story it names, when it is a story link.
    pub story: Option<StoryTarget>,
}

/// A risk tier an approval may pick, and whether the plan then waits for the human's review,
/// unless the human says otherwise.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TierChoice {
    pub value: String,
    pub plan_review: bool,
}
