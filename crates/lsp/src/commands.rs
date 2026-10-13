//! The `workspace/executeCommand` commands: every action that writes another file or commits,
//! each through the core's `api`, run on the server's worker. Each answers with the files it wrote
//! and the one to open, absolute.

use std::path::{Path, PathBuf};

use lsp_server::ResponseError;
use lsp_types::Uri;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uraeda_core::actions::review::review_name;
use uraeda_core::api::{self, ApiError};
use uraeda_core::files::document::hash;
use uraeda_core::files::{frontmatter, priorities};
use uraeda_core::view::FileView;
use uraeda_core::workspace::FileKind;

use crate::documents::Documents;
use crate::requests::{WorkflowFile, api_error, refused, workflow_file};

/// Every command the server runs.
pub(crate) const COMMANDS: [&str; 8] = [
    "uraeda.draft",
    "uraeda.start",
    "uraeda.comment",
    "uraeda.editComment",
    "uraeda.approve",
    "uraeda.requestChanges",
    "uraeda.submit",
    "uraeda.commit",
];

const NOT_WORKFLOW: &str = "This file is not a Uraeda workflow file.";
const NOT_AN_ENTRY: &str = "This line is not a priorities entry.";

/// What a command did: the file to open, and the files it wrote, to reload.
#[derive(Serialize, Default)]
pub(crate) struct Outcome {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opened: Option<String>,
    pub written: Vec<String>,
}

/// A command done: its outcome, and the message its progress ends with.
pub(crate) struct Done {
    pub outcome: Outcome,
    pub message: Option<String>,
}

impl From<Outcome> for Done {
    fn from(outcome: Outcome) -> Done {
        Done {
            outcome,
            message: None,
        }
    }
}

#[derive(Deserialize)]
pub(crate) struct FileArgs {
    uri: Uri,
}

#[derive(Deserialize)]
struct DraftArgs {
    uri: Uri,
    /// 1-based.
    line: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommentArgs {
    uri: Uri,
    line: Option<u32>,
    end_line: Option<u32>,
    text: String,
}

#[derive(Deserialize)]
struct EditCommentArgs {
    uri: Uri,
    number: u32,
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApproveArgs {
    uri: Uri,
    summary: Option<String>,
    risk_tier: Option<String>,
    plan_review: Option<bool>,
}

#[derive(Deserialize)]
struct RequestChangesArgs {
    uri: Uri,
    summary: Option<String>,
}

/// The title of a command's progress: `Starting Codex runtime…`.
pub(crate) fn title(documents: &Documents, command: &str, args: &Value) -> String {
    let file = || {
        args.get("uri")
            .and_then(|uri| serde_json::from_value::<Uri>(uri.clone()).ok())
            .and_then(|uri| documents.path(&uri))
            .and_then(|path| Some(path.file_name()?.to_string_lossy().into_owned()))
            .unwrap_or_default()
    };
    match command {
        "uraeda.draft" => "Drafting…".to_string(),
        "uraeda.start" => {
            let name = args
                .get("uri")
                .and_then(|uri| serde_json::from_value::<Uri>(uri.clone()).ok())
                .and_then(|uri| relative(documents, &uri))
                .and_then(|path| api::read_text(&documents.root, &path).ok())
                .map(|draft| draft.title)
                .unwrap_or_else(file);
            format!("Starting {name}…")
        }
        "uraeda.comment" => format!("Commenting on {}…", file()),
        "uraeda.editComment" => format!("Editing a comment on {}…", file()),
        "uraeda.approve" => format!("Approving {}…", file()),
        "uraeda.requestChanges" => format!("Requesting changes on {}…", file()),
        "uraeda.submit" => format!("Submitting {}…", file()),
        _ => format!("Committing {}…", file()),
    }
}

/// Runs a command with its only argument.
pub(crate) fn run(
    documents: &Documents,
    command: &str,
    args: Value,
) -> Result<Done, ResponseError> {
    match command {
        "uraeda.draft" => draft(documents, parse(args)?).map(Done::from),
        "uraeda.start" => start(documents, parse(args)?),
        "uraeda.comment" => comment(documents, parse(args)?).map(Done::from),
        "uraeda.editComment" => edit_comment(documents, parse(args)?).map(Done::from),
        "uraeda.approve" => approve(documents, parse(args)?).map(Done::from),
        "uraeda.requestChanges" => request_changes(documents, parse(args)?).map(Done::from),
        "uraeda.submit" => submit(documents, parse(args)?).map(Done::from),
        "uraeda.commit" => commit(documents, parse(args)?).map(Done::from),
        command => Err(crate::server::error(
            lsp_server::ErrorCode::InvalidParams,
            format!("unknown command {command}"),
        )),
    }
}

fn parse<T: DeserializeOwned>(args: Value) -> Result<T, ResponseError> {
    serde_json::from_value(args).map_err(|error| {
        crate::server::error(lsp_server::ErrorCode::InvalidParams, error.to_string())
    })
}

fn core<T>(result: Result<T, ApiError>) -> Result<T, ResponseError> {
    result.map_err(api_error)
}

fn absolute(path: PathBuf) -> String {
    path.to_string_lossy().into_owned()
}

/// A file's path from the root, `specs/drafts/x.md`, for a file under `specs/`.
fn relative(documents: &Documents, uri: &Uri) -> Option<String> {
    let path = documents
        .path(uri)
        .filter(|path| documents.in_specs(path))?;
    let relative = path.strip_prefix(&documents.root).ok()?;
    Some(relative.to_string_lossy().replace('\\', "/"))
}

/// `uraeda.draft { uri, line }`: drafts the priorities entry whose lines hold `line`, over the open
/// text, or opens the draft it already links.
fn draft(documents: &Documents, args: DraftArgs) -> Result<Outcome, ResponseError> {
    let root = &documents.root;
    let text = (relative(documents, &args.uri).as_deref() == Some(priorities_path()))
        .then(|| documents.read(&root.join(priorities_path())))
        .flatten()
        .ok_or_else(|| refused(NOT_AN_ENTRY))?;
    let entry = priorities::read(&text, None)
        .sections
        .into_iter()
        .flat_map(|section| section.entries)
        .find(|entry| {
            // The entry's own lines: its first, and those its text wraps on, not its sub-items.
            let lines = (entry.lines.len() - entry.nested.len()) as u32;
            (entry.start_line..entry.start_line + lines).contains(&args.line)
        })
        .ok_or_else(|| refused(NOT_AN_ENTRY))?;
    let linked = core(api::priority_links(root, &text))?
        .into_iter()
        .find(|link| link.line == entry.start_line)
        .and_then(|link| link.draft);
    if let Some(linked) = linked {
        return Ok(Outcome {
            opened: Some(absolute(root.join(linked))),
            written: Vec::new(),
        });
    }
    let drafted = core(api::create_draft(root, &entry.id, &hash(&text)))?;
    let default = core(api::default_root(root))?;
    let opened = absolute(default.join(&drafted.path));
    Ok(Outcome {
        opened: Some(opened.clone()),
        written: vec![opened, absolute(default.join(priorities_path()))],
    })
}

fn priorities_path() -> &'static str {
    "specs/PRIORITIES.md"
}

/// `uraeda.start { uri }`: starts a draft or a backlog file as a feature, in its own worktree.
fn start(documents: &Documents, args: FileArgs) -> Result<Done, ResponseError> {
    const ONLY_DRAFTS: &str = "Only a draft or a backlog file can be started.";
    let root = &documents.root;
    let path = relative(documents, &args.uri).ok_or_else(|| refused(ONLY_DRAFTS))?;
    let rest = path
        .strip_prefix("specs/drafts/")
        .or_else(|| path.strip_prefix("specs/backlog/"))
        .ok_or_else(|| refused(ONLY_DRAFTS))?;
    // A file of a postponed feature's folder starts the folder.
    let draft = match rest.split_once('/') {
        Some((folder, _)) => format!("{}{folder}", &path[..path.len() - rest.len()]),
        None => path.clone(),
    };
    let started = core(api::start_feature(root, &draft, None))?;
    let worktree = PathBuf::from(core(api::work_dir(root, &started.folder))?);
    let default = core(api::default_root(root))?;
    let proposal = worktree
        .join("specs")
        .join(&started.folder)
        .join("proposal.md");
    Ok(Done {
        outcome: Outcome {
            opened: Some(absolute(proposal)),
            written: vec![
                absolute(default.join(priorities_path())),
                absolute(default.join(&path)),
            ],
        },
        message: Some(format!("Started {}", started.folder)),
    })
}

/// A file of a feature or a bug: its folder's name, and the file.
fn feature_file(documents: &Documents, uri: &Uri) -> Result<(String, WorkflowFile), ResponseError> {
    let file = workflow_file(documents, uri).ok_or_else(|| refused(NOT_WORKFLOW))?;
    let folder = file
        .dir
        .strip_prefix("specs/")
        .map(|rest| rest.strip_prefix("bugs/").unwrap_or(rest))
        .filter(|folder| !folder.is_empty() && !folder.contains('/'))
        .ok_or_else(|| refused(NOT_WORKFLOW))?
        .to_string();
    Ok((folder, file))
}

/// The text of a file: its open document's, else the disk's.
fn text(documents: &Documents, file: &WorkflowFile) -> Result<String, ResponseError> {
    documents
        .read(&file.path)
        .ok_or_else(|| refused(format!("{}: no such file", file.name)))
}

/// Refuses a file that is not `awaiting-human`.
fn waiting(text: &str, name: &str) -> Result<(), ResponseError> {
    let waiting =
        frontmatter::parse(text).is_ok_and(|front| front.text("status") == Some("awaiting-human"));
    if waiting {
        Ok(())
    } else {
        Err(refused(format!("{name} is not waiting for a review.")))
    }
}

/// The absolute paths of files of a feature, in the checkout that has its branch, from the file
/// a write returned.
fn in_checkout(
    documents: &Documents,
    folder: &str,
    view: &FileView,
    names: &[String],
) -> Result<Vec<String>, ResponseError> {
    let checkout = PathBuf::from(core(api::work_dir(&documents.root, folder))?);
    let dir = Path::new(&view.path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    Ok(names
        .iter()
        .map(|name| absolute(checkout.join(&dir).join(name)))
        .collect())
}

/// `uraeda/canComment`.
pub(crate) const CAN_COMMENT: &str = "uraeda/canComment";

/// `uraeda/canComment { uri }`: `null` when `uraeda.comment` would take a comment on the file,
/// else its refusal, so an editor asks before it opens a window for the text. Writes nothing.
pub(crate) fn can_comment(documents: &Documents, params: FileArgs) -> Result<(), ResponseError> {
    commentable(documents, &params.uri).map(|_| ())
}

/// The folder and the file of `uri`, when it waits for a review and its open text is the
/// committed one, which a comment's lines point at; else the refusal.
fn commentable(documents: &Documents, uri: &Uri) -> Result<(String, WorkflowFile), ResponseError> {
    let (folder, file) = feature_file(documents, uri)?;
    let text = text(documents, &file)?;
    waiting(&text, &file.name)?;
    let view = core(api::read_file(&documents.root, &folder, &file.name))?;
    let committed = view.committed.as_ref().unwrap_or(&view.current);
    if committed.text != text {
        return Err(refused(format!(
            "{} differs from its last commit: comments point at the committed version. \
             Commit or undo the change first.",
            file.name
        )));
    }
    Ok((folder, file))
}

/// `uraeda.comment { uri, line?, endLine?, text }`: adds a comment to the pending review, on lines
/// of the committed file, which the open text must be.
fn comment(documents: &Documents, args: CommentArgs) -> Result<Outcome, ResponseError> {
    let (folder, file) = commentable(documents, &args.uri)?;
    let lines = args.line.map(|line| (line, args.end_line.unwrap_or(line)));
    let view = core(api::add_comment(
        &documents.root,
        &folder,
        &file.name,
        lines,
        &args.text,
    ))?;
    Ok(Outcome {
        opened: None,
        written: in_checkout(documents, &folder, &view, &[review_name(&file.name)])?,
    })
}

/// `uraeda.editComment { uri, number, text }`: replaces a pending comment's text, or removes the
/// comment when `text` is blank.
fn edit_comment(documents: &Documents, args: EditCommentArgs) -> Result<Outcome, ResponseError> {
    let (folder, file) = feature_file(documents, &args.uri)?;
    let root = &documents.root;
    let view = if args.text.trim().is_empty() {
        core(api::remove_comment(root, &folder, &file.name, args.number))?
    } else {
        core(api::edit_comment(
            root,
            &folder,
            &file.name,
            args.number,
            &args.text,
        ))?
    };
    Ok(Outcome {
        opened: None,
        written: in_checkout(documents, &folder, &view, &[review_name(&file.name)])?,
    })
}

/// `uraeda.approve { uri, summary?, riskTier?, planReview? }`: approves and commits.
fn approve(documents: &Documents, args: ApproveArgs) -> Result<Outcome, ResponseError> {
    let (folder, file) = feature_file(documents, &args.uri)?;
    waiting(&text(documents, &file)?, &file.name)?;
    let view = core(api::approve(
        &documents.root,
        &folder,
        &file.name,
        args.summary.as_deref(),
        args.risk_tier,
        args.plan_review,
    ))?;
    let names = [file.name.clone(), review_name(&file.name)];
    Ok(Outcome {
        opened: None,
        written: in_checkout(documents, &folder, &view, &names)?,
    })
}

/// `uraeda.requestChanges { uri, summary? }`: requests changes and commits, refused on a review
/// without comments.
fn request_changes(
    documents: &Documents,
    args: RequestChangesArgs,
) -> Result<Outcome, ResponseError> {
    let (folder, file) = feature_file(documents, &args.uri)?;
    waiting(&text(documents, &file)?, &file.name)?;
    if file.pending_comments(documents).is_empty() {
        return Err(refused("Requesting changes needs at least one comment."));
    }
    let view = core(api::request_changes(
        &documents.root,
        &folder,
        &file.name,
        args.summary.as_deref(),
    ))?;
    let names = [file.name.clone(), review_name(&file.name)];
    Ok(Outcome {
        opened: None,
        written: in_checkout(documents, &folder, &view, &names)?,
    })
}

/// `uraeda.submit { uri }`: submits the answers of the round in the buffer, and commits them, when
/// it waits for answers and is the feature's latest round, the one the core submits.
fn submit(documents: &Documents, args: FileArgs) -> Result<Outcome, ResponseError> {
    let (folder, file) = feature_file(documents, &args.uri)?;
    if file.kind != FileKind::Clarifications {
        return Err(refused("Only a round of questions is submitted."));
    }
    let front = frontmatter::parse(&text(documents, &file)?);
    if !front.is_ok_and(|front| front.text("status") == Some("awaiting-human")) {
        return Err(refused(format!(
            "{} is not waiting for answers.",
            file.name
        )));
    }
    if let Some(latest) = latest_round(&file).filter(|latest| *latest != file.name) {
        return Err(refused(format!(
            "{} is not the latest round: {latest} is.",
            file.name
        )));
    }
    let view = core(api::submit_answers(&documents.root, &folder))?;
    Ok(Outcome {
        opened: None,
        written: in_checkout(documents, &folder, &view, std::slice::from_ref(&view.name))?,
    })
}

/// The name of the last round of questions in the folder of `file`, on disk.
fn latest_round(file: &WorkflowFile) -> Option<String> {
    std::fs::read_dir(file.path.parent()?)
        .ok()?
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter_map(|name| match FileKind::of(&name) {
            Some((FileKind::Clarifications, Some(round))) => Some((round, name)),
            _ => None,
        })
        .max()
        .map(|(_, name)| name)
}

/// `uraeda.commit { uri }`: commits a draft, a backlog file, or a proposal, with the priorities
/// when they changed, or the priorities alone.
fn commit(documents: &Documents, args: FileArgs) -> Result<Outcome, ResponseError> {
    const ONLY: &str =
        "Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.";
    let root = &documents.root;
    let path = relative(documents, &args.uri).ok_or_else(|| refused(ONLY))?;
    if path == priorities_path() {
        core(api::commit_priorities(root))?;
    } else if path.starts_with("specs/drafts/")
        || path.starts_with("specs/backlog/")
        || workflow_file(documents, &args.uri).is_some_and(|file| file.kind == FileKind::Proposal)
    {
        core(api::commit_text(root, &path))?;
    } else {
        return Err(refused(ONLY));
    }
    Ok(Outcome::default())
}
