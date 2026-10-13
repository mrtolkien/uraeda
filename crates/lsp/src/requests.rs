//! The custom `uraeda/*` requests: reads the standard requests do not cover, answered from the open
//! text when the file is open, else from disk.

use std::path::PathBuf;

use lsp_server::{ErrorCode, ResponseError};
use lsp_types::Uri;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uraeda_core::actions::{answer, review};
use uraeda_core::api::{self, ApiError};
use uraeda_core::check::{self, Field};
use uraeda_core::files::document;
use uraeda_core::files::items::{CommentItem, Items, TierChoice, items};
use uraeda_core::files::review::Verdict as Outcome;
use uraeda_core::gates::{Gate, awaits_human, gate_of};
use uraeda_core::workspace::{FileKind, folder_slug};

use crate::documents::Documents;

/// The params of a request about one file.
#[derive(Deserialize)]
pub(crate) struct FileParams {
    pub uri: Uri,
}

/// `uraeda/fields`.
pub(crate) const FIELDS: &str = "uraeda/fields";

/// `uraeda/fields { uri }`: the file's frontmatter fields, with their lines, values, and allowed
/// values.
pub(crate) fn fields(documents: &Documents, params: FileParams) -> Vec<Field> {
    fields_of(documents, &params.uri)
}

/// The fields of a file under `specs/`: from its open text, else from disk; none elsewhere.
pub(crate) fn fields_of(documents: &Documents, uri: &Uri) -> Vec<Field> {
    let Some(path) = documents.path(uri).filter(|path| documents.in_specs(path)) else {
        return Vec::new();
    };
    match documents.text(uri) {
        Some(text) => check::fields(&documents.root, &path, text),
        None => check::fields_on_disk(&documents.root, &path),
    }
}

/// `uraeda/items`.
pub(crate) const ITEMS: &str = "uraeda/items";
/// `uraeda/comments`.
pub(crate) const COMMENTS: &str = "uraeda/comments";
/// `uraeda/verdict`.
pub(crate) const VERDICT: &str = "uraeda/verdict";
/// `uraeda/waiting`.
pub(crate) const WAITING: &str = "uraeda/waiting";

/// A place to jump to: a question of a round, or a comment of a pending review.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Item {
    /// `question` or `comment`.
    pub kind: &'static str,
    /// `Q1.A`, or `C2`.
    pub label: String,
    /// 1-based, like the lines of workflow files.
    pub line: u32,
    pub end_line: u32,
}

/// A comment of a pending review.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Comment {
    pub number: u32,
    /// The reviewed file's lines it is about, absent for a general comment.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_line: Option<u32>,
    pub text: String,
}

/// What the verdict window shows: the commits a verdict makes, and what it changes.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Verdict {
    /// `spec.md`.
    pub file: String,
    /// `review` for a spec, a plan, or an assessment; `round` for a round of questions.
    pub kind: &'static str,
    /// The subject of the commit approving, or submitting the answers.
    pub approve: String,
    /// The subject of the commit requesting changes, for a review.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_changes: Option<String>,
    /// The pending review's comments.
    pub comments: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_review: Option<bool>,
    /// The risk tiers an approval may pick, each with the plan review it gives by default: a
    /// spec's only.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tiers: Vec<TierChoice>,
    /// The questions that need an answer and have none.
    pub blank: Vec<String>,
    /// Whether the file is `awaiting-human`.
    pub waiting: bool,
}

/// A file waiting for the human.
#[derive(Serialize)]
pub(crate) struct Waiting {
    /// The feature's slug.
    pub feature: String,
    pub file: String,
    /// Absolute, in the checkout that has it.
    pub path: String,
    /// The line of its block, 1-based.
    pub line: u32,
    /// The block's first line.
    pub text: String,
}

/// A workflow file under `specs/`: its path, name, kind, and its folder from the root.
pub(crate) struct WorkflowFile {
    pub path: PathBuf,
    pub name: String,
    pub kind: FileKind,
    /// From the root: `specs/2026-10-13-nvim-plugin`.
    pub dir: String,
}

pub(crate) fn workflow_file(documents: &Documents, uri: &Uri) -> Option<WorkflowFile> {
    let path = documents
        .path(uri)
        .filter(|path| documents.in_specs(path))?;
    let name = path.file_name()?.to_string_lossy().into_owned();
    let (kind, _) = FileKind::of(&name)?;
    let dir = path
        .parent()?
        .strip_prefix(&documents.root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    Some(WorkflowFile {
        path,
        name,
        kind,
        dir,
    })
}

impl WorkflowFile {
    fn items(&self, documents: &Documents) -> Option<Items> {
        let text = documents.read(&self.path)?;
        Some(items(&self.name, &text, &document::parse(&text, &self.dir)))
    }

    /// The comments of its pending review, from the review's open text, else from disk.
    pub fn pending_comments(&self, documents: &Documents) -> Vec<CommentItem> {
        if gate_of(&self.name) != Some(Gate::Review) {
            return Vec::new();
        }
        let review = WorkflowFile {
            path: self.path.with_file_name(review::review_name(&self.name)),
            name: review::review_name(&self.name),
            kind: FileKind::Review,
            dir: self.dir.clone(),
        };
        review
            .items(documents)
            .and_then(|items| items.review)
            .filter(|review| review.verdict == "pending")
            .map(|review| review.comments)
            .unwrap_or_default()
    }
}

/// `uraeda/items { uri }`: the questions of a round, or the comments of a pending review on lines,
/// in file order.
pub(crate) fn items_of(documents: &Documents, params: FileParams) -> Vec<Item> {
    let Some(file) = workflow_file(documents, &params.uri) else {
        return Vec::new();
    };
    if file.kind == FileKind::Clarifications {
        let questions = file
            .items(documents)
            .and_then(|items| items.clarifications)
            .map(|round| round.questions)
            .unwrap_or_default();
        return questions
            .into_iter()
            .map(|question| Item {
                kind: "question",
                label: question.id,
                line: question.start_line,
                end_line: question.end_line,
            })
            .collect();
    }
    let mut comments: Vec<Item> = file
        .pending_comments(documents)
        .into_iter()
        .filter(|comment| !comment.general)
        .map(|comment| Item {
            kind: "comment",
            label: format!("C{}", comment.number),
            line: comment.start_line,
            end_line: comment.end_line,
        })
        .collect();
    comments.sort_by_key(|comment| (comment.line, comment.end_line));
    comments
}

/// `uraeda/comments { uri }`: the comments of the file's pending review, by number.
pub(crate) fn comments(documents: &Documents, params: FileParams) -> Vec<Comment> {
    let Some(file) = workflow_file(documents, &params.uri) else {
        return Vec::new();
    };
    file.pending_comments(documents)
        .into_iter()
        .map(|comment| Comment {
            number: comment.number,
            line: (!comment.general).then_some(comment.start_line),
            end_line: (!comment.general).then_some(comment.end_line),
            text: comment.text,
        })
        .collect()
}

/// `uraeda/verdict { uri }`: the verdict a spec, a plan, an assessment, or a round of questions
/// would get, with the subjects of the commits it makes, from the core.
pub(crate) fn verdict(documents: &Documents, params: FileParams) -> Result<Verdict, ResponseError> {
    let file = workflow_file(documents, &params.uri)
        .ok_or_else(|| refused("This file is not a Uraeda workflow file."))?;
    let round = match gate_of(&file.name) {
        Some(Gate::Round(round)) => Some(round),
        Some(Gate::Review) => None,
        None => {
            return Err(refused(
                "Only a spec, a plan, an assessment, or a round of questions gets a verdict.",
            ));
        }
    };
    let review_kind = round.is_none();
    let text = documents
        .read(&file.path)
        .ok_or_else(|| refused(format!("{}: no such file", file.name)))?;
    let folder = file.dir.rsplit('/').next().unwrap_or_default();
    let slug = folder_slug(folder).unwrap_or(folder);
    let waiting = awaits_human(&text);
    let spec = items(&file.name, &text, &document::parse(&text, &file.dir)).spec;
    Ok(Verdict {
        approve: match round {
            Some(round) => answer::subject(slug, round),
            None => review::subject(slug, &file.name, Outcome::Approved),
        },
        request_changes: review_kind
            .then(|| review::subject(slug, &file.name, Outcome::ChangesRequested)),
        comments: u32::try_from(file.pending_comments(documents).len()).unwrap_or(u32::MAX),
        risk_tier: spec.as_ref().and_then(|spec| spec.risk_tier.clone()),
        plan_review: spec.as_ref().and_then(|spec| spec.plan_review),
        tiers: spec.map(|spec| spec.tiers).unwrap_or_default(),
        blank: if round.is_some() {
            answer::blank(&text)
        } else {
            Vec::new()
        },
        kind: if round.is_some() { "round" } else { "review" },
        file: file.name,
        waiting,
    })
}

/// `uraeda/waiting {}`: every file waiting for the human, in every checkout.
pub(crate) fn waiting(documents: &Documents) -> Result<Vec<Waiting>, ResponseError> {
    let waiting = api::waiting(&documents.root).map_err(api_error)?;
    Ok(waiting
        .into_iter()
        .map(|file| Waiting {
            feature: file.feature,
            file: file.file,
            path: file.path,
            line: file.line,
            text: file.text,
        })
        .collect())
}

/// A request refused, with the core's code `refused` in `data`.
pub(crate) fn refused(message: impl Into<String>) -> ResponseError {
    ResponseError {
        code: ErrorCode::RequestFailed as i32,
        message: message.into(),
        data: Some(json!({ "code": "refused" })),
    }
}

/// An error of the core, with its code in `data`, and a hook's whole output.
pub(crate) fn api_error(error: ApiError) -> ResponseError {
    let data = match error.output {
        Some(output) => json!({ "code": error.code, "output": output }),
        None => json!({ "code": error.code }),
    };
    ResponseError {
        code: ErrorCode::RequestFailed as i32,
        message: error.message,
        data: Some(data),
    }
}
