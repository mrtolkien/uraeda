//! The structured view of a workflow file by its kind: questions and their options, user stories
//! and their scenarios, plan tasks and their steps, review comments, rulings. Each points into the
//! file's document tree by block id, so the UI draws the blocks and acts on the items.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::clarifications::{self, Applicability};
use super::document::{Block, BlockKind, Document, ItemMarker, Span, plain};
use super::{frontmatter, review};
use crate::workspace::FileKind;

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
    /// The blocks of the points settled without the human.
    pub settled: Vec<u32>,
    pub notes: Option<String>,
    pub notes_line: Option<u32>,
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

/// The top-level blocks of the level-2 section titled `title`.
fn named_section(doc: &Document, title: &str) -> Vec<u32> {
    headings(doc)
        .into_iter()
        .find(|(_, level, text)| *level == 2 && text == title)
        .map(|(index, _, _)| section(doc, index, 2))
        .unwrap_or_default()
}

/// The first strong span of an item, when the item's text starts with it.
fn leading_strong(block: &Block) -> Option<&str> {
    block
        .spans
        .first()
        .filter(|span| span.strong)
        .map(|span| span.text.as_str())
}

fn round(text: &str, doc: &Document) -> RoundItems {
    let status = frontmatter::parse(text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let first_section = doc
        .blocks
        .iter()
        .find(|b| b.kind == BlockKind::Heading && b.level == Some(2))
        .map_or(u32::MAX, |b| b.start_line);
    let block = doc
        .blocks
        .iter()
        .find(|b| {
            b.parent.is_none() && b.kind == BlockKind::Callout && b.start_line < first_section
        })
        .map(|b| b.id);
    let parsed = clarifications::parse(text);
    let all_headings = headings(doc);
    let mut questions = Vec::new();
    for (position, (index, level, title)) in all_headings.iter().enumerate() {
        let Some((id, parent, question_title)) = clarifications::question_heading(*level, title)
        else {
            continue;
        };
        let heading = &doc.blocks[*index];
        // A question ends at the next heading of level 3 or above: a follow-up is its own.
        let end_index = all_headings[position + 1..]
            .iter()
            .find(|(_, l, _)| *l <= 3)
            .map_or(doc.blocks.len(), |(i, _, _)| *i);
        let end_line = doc.blocks[*index..end_index]
            .iter()
            .map(|b| b.end_line)
            .max()
            .unwrap_or(heading.end_line);
        let found = parsed.iter().find(|q| q.id == id);
        let answer = found.map(|q| q.answer.clone()).unwrap_or_default();
        let answer_line = found.map_or(0, |q| q.answer_line as u32);
        let letters: Vec<char> = found.map(|q| q.options.clone()).unwrap_or_default();
        let (picked, comment) = clarifications::split_answer(&answer, &letters);
        let applies = match found.map(|q| q.applies(&parsed)) {
            Some(Applicability::No) => "no",
            Some(Applicability::Unclear) => "unclear",
            _ => "yes",
        };
        let mut context = Vec::new();
        let mut options = Vec::new();
        for block in &doc.blocks[*index + 1..end_index] {
            if block.parent.is_some() || block.kind == BlockKind::Heading {
                continue;
            }
            if answer_line > 0 && block.start_line >= answer_line {
                continue;
            }
            let choices = choices(doc, block);
            if choices.is_empty() {
                context.push(block.id);
            } else {
                options.extend(choices);
            }
        }
        questions.push(QuestionItem {
            id,
            parent: parent.as_ref().map(|(p, _)| p.clone()),
            parent_letter: parent.map(|(_, letter)| letter.to_string()),
            title: question_title,
            start_line: heading.start_line,
            end_line,
            heading_block: heading.id,
            context,
            options,
            answer,
            letters: picked,
            comment,
            applies: applies.to_string(),
            answer_line,
        });
    }
    let notes = clarifications::notes(text);
    RoundItems {
        status,
        block,
        context: named_section(doc, "Context"),
        questions,
        settled: named_section(doc, "Settled without the human"),
        notes: notes.as_ref().map(|(_, notes)| notes.clone()),
        notes_line: notes.map(|(line, _)| line as u32),
    }
}

/// The options of a list whose items are `- **A. ...**`, or nothing for any other block.
fn choices(doc: &Document, list: &Block) -> Vec<Choice> {
    if list.kind != BlockKind::List {
        return Vec::new();
    }
    let mut choices = Vec::new();
    for item in doc.children(list.id) {
        let Some((letter, recommended, rest)) =
            leading_strong(item).and_then(clarifications::option_heading)
        else {
            return Vec::new();
        };
        let mut summary = item.spans.clone();
        summary[0].text = rest.to_string();
        if summary[0].text.is_empty() {
            summary.remove(0);
        }
        let mut choice = Choice {
            letter: letter.to_string(),
            recommended,
            summary,
            pros: Vec::new(),
            cons: Vec::new(),
            why: None,
            other: Vec::new(),
            block: item.id,
        };
        for child in doc.children(item.id) {
            if child.kind != BlockKind::List {
                choice.other.push(child.id);
                continue;
            }
            for bullet in doc.children(child.id) {
                match bullet.marker {
                    Some(ItemMarker::Pro) => choice.pros.push(bullet.id),
                    Some(ItemMarker::Con) => choice.cons.push(bullet.id),
                    _ if plain(&bullet.spans).starts_with("Why recommended") => {
                        choice.why = Some(bullet.id);
                    }
                    _ => choice.other.push(bullet.id),
                }
            }
        }
        choices.push(choice);
    }
    choices
}

/// `Task 3: The repeat menu`, a plan's level-2 heading, as its number and title.
pub(crate) fn task_heading(text: &str) -> Option<(u32, String)> {
    let (number, title) = text.strip_prefix("Task ")?.split_once(':')?;
    Some((number.trim().parse().ok()?, title.trim().to_string()))
}

/// The tasks of a plan, `## Task N: title`, with their checkbox steps.
fn tasks(doc: &Document) -> Vec<TaskItem> {
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
