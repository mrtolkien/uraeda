//! The structured view of a workflow file by its kind: questions and their options, user stories
//! and their scenarios, plan tasks and their steps, review comments, rulings. Each points into the
//! file's document tree by block id, so the UI draws the blocks and acts on the items.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::document::{BlockKind, Document, ItemMarker, Span, plain};
use super::{frontmatter, review};
use crate::workspace::FileKind;

mod round;

use round::round;
pub(crate) use round::settled_points;

/// An option of a question.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
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

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
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
    /// Its context: the blocks between its heading and its answer, options aside.
    pub context: Vec<u32>,
    pub options: Vec<Choice>,
    pub answer: String,
    /// The answer split as the UI composes it.
    pub letters: Vec<String>,
    pub comment: String,
    /// `yes`, `no`, or `unclear`: whether it needs an answer, from its parent's.
    pub applies: String,
    /// Whether the round asks it now: it may apply, and a follow-up's parent has an answer.
    pub asked: bool,
    /// The line of its `**Answer:**` marker, or 0.
    pub answer_line: u32,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundItems {
    pub status: Option<String>,
    /// The `> [!IMPORTANT]` block, or its `> [!NOTE]` record.
    pub block: Option<u32>,
    /// The blocks of the round's context section.
    pub context: Vec<u32>,
    pub questions: Vec<QuestionItem>,
    /// The blocks of the points settled without the human, up to the `**Notes:**` line.
    pub settled: Vec<u32>,
    /// The settled points that start in bold, which take comments.
    pub settled_points: Vec<SettledPoint>,
    /// The free notes, trimmed, without the comments on settled points.
    pub notes: Option<String>,
    pub notes_line: Option<u32>,
    /// The comments on settled points, written at the end of the notes.
    pub settled_comments: Vec<SettledComment>,
}

/// A point settled without the human, by its bold start.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettledPoint {
    /// Its list item's block.
    pub block: u32,
    /// Its bold start, trimmed.
    pub subject: String,
}

/// A comment on a settled point: a bullet of the notes, `- **<subject>**: <text>`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
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
    pub scenarios: Vec<Scenario>,
    /// The blocks the web UI folds: its scenarios' intro paragraph and their list, or none.
    pub details: Vec<u32>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Criterion {
    /// `SC-001`.
    pub id: String,
    pub block: u32,
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
    /// The blocks the web UI folds: the `## Details` heading and every top-level block after it,
    /// up to the next level-1 or level-2 heading, or none.
    pub details: Vec<u32>,
    /// The mockups the `## Mockups` section links, in its order.
    pub mockups: Vec<MockupLink>,
}

/// A link of a spec's `## Mockups` section to a file under `mockups/`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockupLink {
    /// `mockups/repeat.html`, from the spec's folder.
    pub path: String,
    /// The link's text.
    pub label: String,
    /// The selectable block holding the link: its list item, row, or paragraph.
    pub block: u32,
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

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepItem {
    pub block: u32,
    pub checked: bool,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub number: u32,
    pub title: String,
    pub heading_block: u32,
    pub steps: Vec<StepItem>,
    pub done: u32,
    pub total: u32,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItems {
    pub tasks: Vec<TaskItem>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentItem {
    pub number: u32,
    /// The lines it points to, 0 for a general comment.
    pub start_line: u32,
    pub end_line: u32,
    pub heading: Option<String>,
    pub general: bool,
    pub quote: Vec<String>,
    pub text: String,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewItems {
    pub verdict: String,
    pub commit: String,
    pub summary: Option<String>,
    pub comments: Vec<CommentItem>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ruling {
    /// `R1`.
    pub id: String,
    pub title: String,
    pub heading_block: u32,
    pub blocks: Vec<u32>,
}

/// The items of a file, by its kind: at most one field is set.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Items {
    pub clarifications: Option<RoundItems>,
    pub spec: Option<SpecItems>,
    pub plan: Option<PlanItems>,
    pub review: Option<ReviewItems>,
    pub rulings: Option<Vec<Ruling>>,
}

/// The items of a workflow file, from its name, its text, and its document tree.
pub fn items(name: &str, text: &str, doc: &Document) -> Items {
    let mut items = Items::default();
    match FileKind::of(name).map(|(kind, _)| kind) {
        Some(FileKind::Clarifications) => items.clarifications = Some(round(text, doc)),
        Some(FileKind::Spec) => {
            let front = frontmatter::parse(text).ok();
            let mut spec = super::spec::items(doc);
            spec.risk_tier = front
                .as_ref()
                .and_then(|f| f.text("risk-tier").map(String::from));
            spec.plan_review = front.and_then(|f| match f.get("plan-review") {
                Some(frontmatter::Value::Bool(value)) => Some(*value),
                _ => None,
            });
            spec.tiers = super::spec::tier_choices(spec.risk_tier.as_deref(), spec.plan_review);
            items.spec = Some(spec);
        }
        Some(FileKind::Plan) => items.plan = Some(PlanItems { tasks: tasks(doc) }),
        Some(FileKind::Review) => items.review = review_items(text),
        Some(FileKind::Rulings) => items.rulings = Some(super::rulings::items(doc)),
        _ => {}
    }
    items
}

/// The heading blocks of a document, as (index in blocks, level, text).
pub(crate) fn headings(doc: &Document) -> Vec<(usize, u32, String)> {
    doc.blocks
        .iter()
        .enumerate()
        .filter(|(_, b)| b.kind == BlockKind::Heading)
        .map(|(i, b)| (i, b.level.unwrap_or(1), plain(&b.spans)))
        .collect()
}

/// The top-level blocks after a heading, up to the next heading of `level` or above.
pub(crate) fn section(doc: &Document, heading: usize, level: u32) -> Vec<u32> {
    doc.blocks[heading + 1..]
        .iter()
        .take_while(|b| b.kind != BlockKind::Heading || b.level.unwrap_or(1) > level)
        .filter(|b| b.parent.is_none() && b.kind != BlockKind::Heading)
        .map(|b| b.id)
        .collect()
}

/// `Task 3: The repeat menu`, a plan's level-2 heading, as its number and title.
pub(crate) fn task_heading(text: &str) -> Option<(u32, String)> {
    let (number, title) = text.strip_prefix("Task ")?.split_once(':')?;
    Some((number.trim().parse().ok()?, title.trim().to_string()))
}

/// The tasks of a plan, `## Task N: title`, with their checkbox steps.
pub(crate) fn tasks(doc: &Document) -> Vec<TaskItem> {
    let all = headings(doc);
    let mut tasks = Vec::new();
    for (position, (index, level, title)) in all.iter().enumerate() {
        let Some((number, title)) = (*level == 2).then(|| task_heading(title)).flatten() else {
            continue;
        };
        let end = all[position + 1..]
            .iter()
            .find(|(_, l, _)| *l <= 2)
            .map_or(doc.blocks.len(), |(i, _, _)| *i);
        let steps: Vec<StepItem> = doc.blocks[*index + 1..end]
            .iter()
            .filter(|b| b.kind == BlockKind::Item && b.marker == Some(ItemMarker::Task))
            .map(|b| StepItem {
                block: b.id,
                checked: b.checked == Some(true),
            })
            .collect();
        tasks.push(TaskItem {
            number,
            title,
            heading_block: doc.blocks[*index].id,
            done: steps.iter().filter(|s| s.checked).count() as u32,
            total: steps.len() as u32,
            steps,
        });
    }
    tasks
}

fn review_items(text: &str) -> Option<ReviewItems> {
    let parsed = review::parse(text).ok()?;
    Some(ReviewItems {
        verdict: parsed.verdict.as_str().to_string(),
        commit: parsed.commit,
        summary: parsed.summary,
        comments: parsed
            .comments
            .into_iter()
            .map(|comment| {
                let (start, end, heading) = match comment.anchor {
                    review::Anchor::Lines(start, end, heading) => {
                        (start as u32, end as u32, Some(heading))
                    }
                    review::Anchor::General => (0, 0, None),
                };
                CommentItem {
                    number: comment.number,
                    start_line: start,
                    end_line: end,
                    general: heading.is_none(),
                    heading,
                    quote: comment.quote,
                    text: comment.text,
                }
            })
            .collect(),
    })
}
