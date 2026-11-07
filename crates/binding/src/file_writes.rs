//! The writes of a feature's workflow files: answers, notes, comments on settled points, and reviews.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::actions::review::DecisionTarget;
use uraeda_core::api;
use uraeda_core::api::undo;
use uraeda_core::view::{CommitView, FileView};

use super::undo::recording;
use super::{Job, job};

/// Saves an answer from the letters picked and a comment, over the answer last read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_answer(
    repo: String,
    folder: String,
    question: String,
    letters: Vec<String>,
    comment: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::save_answer(
            Path::new(&repo),
            &folder,
            &question,
            &letters,
            &comment,
            &previous,
        )
    })
}

/// Saves the notes on the settled points, over the notes last read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_notes(
    repo: String,
    folder: String,
    notes: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || api::save_notes(Path::new(&repo), &folder, &notes, &previous))
}

/// Adds a comment on the settled point starting with `subject`, at the end of the notes.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn add_settled_comment(
    repo: String,
    folder: String,
    subject: String,
    text: String,
) -> AsyncTask<Job<FileView>> {
    job(move || api::add_settled_comment(Path::new(&repo), &folder, &subject, &text))
}

/// Writes comment `number` on the settled point `subject` over its text last read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn edit_settled_comment(
    repo: String,
    folder: String,
    number: u32,
    subject: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::edit_settled_comment(
            Path::new(&repo),
            &folder,
            number,
            &subject,
            &text,
            &previous,
        )
    })
}

/// Removes comment `number` on the settled point `subject`, over its text last read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn remove_settled_comment(
    repo: String,
    folder: String,
    number: u32,
    subject: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || api::remove_settled_comment(Path::new(&repo), &folder, number, &subject, &previous))
}

/// Submits the latest round of questions, and commits it; refused when `name`, the round
/// answered, is another.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn submit_answers(
    repo: String,
    folder: String,
    name: Option<String>,
    resumes: Option<bool>,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::submit_answers(
            Path::new(&repo),
            &folder,
            name.as_deref(),
            resumes.unwrap_or(false),
        )
    })
}

/// Commits again what a hook refused to commit: a submitted round, or a verdict.
#[napi(ts_return_type = "Promise<CommitView>")]
pub fn retry_commit(repo: String, folder: String, name: String) -> AsyncTask<Job<CommitView>> {
    job(move || api::retry_commit(Path::new(&repo), &folder, &name))
}

/// The lines a comment is on, from `start` to `end`, the line `start` alone without `end`.
#[napi(object)]
pub struct CommentLines {
    pub start: u32,
    pub end: Option<u32>,
}

/// Comments on lines of a file as committed, on lines of the decision `decision` names for a
/// spec, or on the whole file without lines.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn add_comment(
    repo: String,
    folder: String,
    file: String,
    lines: Option<CommentLines>,
    text: String,
    decision: Option<DecisionTarget>,
    undo: Option<String>,
) -> AsyncTask<Job<FileView>> {
    let lines = lines.map(|lines| (lines.start, lines.end.unwrap_or(lines.start)));
    recording(
        repo,
        undo,
        {
            let (folder, file) = (folder.clone(), file.clone());
            move |repo: &Path| undo::review(repo, &folder, &file)
        },
        move |repo: &Path| api::add_comment(repo, &folder, &file, lines, &text, decision),
    )
}

/// Replaces the text of a pending comment.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn edit_comment(
    repo: String,
    folder: String,
    file: String,
    number: u32,
    text: String,
    undo: Option<String>,
) -> AsyncTask<Job<FileView>> {
    recording(
        repo,
        undo,
        {
            let (folder, file) = (folder.clone(), file.clone());
            move |repo: &Path| undo::review(repo, &folder, &file)
        },
        move |repo: &Path| api::edit_comment(repo, &folder, &file, number, &text),
    )
}

/// Removes a pending comment.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn remove_comment(
    repo: String,
    folder: String,
    file: String,
    number: u32,
    undo: Option<String>,
) -> AsyncTask<Job<FileView>> {
    recording(
        repo,
        undo,
        {
            let (folder, file) = (folder.clone(), file.clone());
            move |repo: &Path| undo::review(repo, &folder, &file)
        },
        move |repo: &Path| api::remove_comment(repo, &folder, &file, number),
    )
}

/// Deletes the pending review of a file.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn start_over(
    repo: String,
    folder: String,
    file: String,
    undo: Option<String>,
) -> AsyncTask<Job<FileView>> {
    recording(
        repo,
        undo,
        {
            let (folder, file) = (folder.clone(), file.clone());
            move |repo: &Path| undo::review(repo, &folder, &file)
        },
        move |repo: &Path| api::start_over(repo, &folder, &file),
    )
}

/// Approves a spec or a plan, and commits it.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn approve(
    repo: String,
    folder: String,
    file: String,
    summary: Option<String>,
    risk_tier: Option<String>,
    plan_review: Option<bool>,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::approve(
            Path::new(&repo),
            &folder,
            &file,
            summary.as_deref(),
            risk_tier,
            plan_review,
        )
    })
}

/// Requests changes on a spec or a plan, and commits it.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn request_changes(
    repo: String,
    folder: String,
    file: String,
    summary: Option<String>,
) -> AsyncTask<Job<FileView>> {
    job(move || api::request_changes(Path::new(&repo), &folder, &file, summary.as_deref()))
}
