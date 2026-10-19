//! The inbox's triage, `specs/INBOX-TRIAGE.md`: read and answered on the default branch, with the
//! rules of a feature's round of questions.

use std::path::Path;

use crate::actions::answer;
use crate::actions::inbox::{self, TRIAGE};
use crate::actions::place::Place;
use crate::api::{Result, on_default, open, reach_default, refused, write_lock};
use crate::files::document;
use crate::files::frontmatter;
use crate::files::items::{Items, round};
use crate::files::stories::story_links;
use crate::git::{Git, ObjectId};
use crate::today;
use crate::view::{FileView, VersionView};
use crate::workspace::FileKind;

/// The triage's id among workflow files: it has no feature folder.
pub const TRIAGE_ID: &str = "inbox-triage";

fn version(text: String) -> VersionView {
    let document = document::parse(&text, "specs");
    let items = Items {
        clarifications: Some(round(&text, &document)),
        ..Items::default()
    };
    let stories = story_links(&document);
    VersionView {
        text,
        document,
        items,
        stories,
    }
}

fn short(id: ObjectId) -> String {
    id.to_hex_with_len(7).to_string()
}

/// The triage's view, as a round of questions: `committed` is its text at the default branch's
/// tip, `tip`.
fn view(text: String, committed: Option<String>, tip: Option<ObjectId>) -> FileView {
    let status = frontmatter::parse(&text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let kind = crate::view::kind_name(Some(FileKind::Clarifications));
    FileView {
        id: TRIAGE_ID.to_string(),
        folder: String::new(),
        name: answer::name_of(TRIAGE).to_string(),
        path: TRIAGE.to_string(),
        kind,
        status,
        committed: committed
            .filter(|committed| *committed != text)
            .map(version),
        current: version(text),
        tip: tip.map(short),
        review: None,
        review_stale: false,
        takes_images: false,
        resumable: false,
        decision_changes: Vec::new(),
        answered: None,
    }
}

/// The triage's view once `text` was written in the default branch's checkout.
fn written(place: &Place, text: String) -> Result<FileView> {
    let git = Git::open(&place.root)?;
    let tip = git.head();
    let committed = tip
        .and_then(|tip| git.read_file(tip, TRIAGE).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok());
    Ok(view(text, committed, tip))
}

/// The triage on the default branch, from the checkout that has it, else from its tip, without
/// creating a worktree; none without one.
pub fn read_triage(repo: &Path) -> Result<Option<FileView>> {
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, TRIAGE);
    let tip = workspace
        .default_branch
        .as_deref()
        .and_then(|default| git.tip(default));
    Ok(text.map(|text| view(text, committed, tip)))
}

/// Saves one answer of the triage, from the letters picked and a comment, over the answer last
/// read, `previous`, in the triage read with the hash `base`: a triage changed elsewhere since is
/// refused, so the hash of the text written covers only what the page saw.
pub fn save_triage_answer(
    repo: &Path,
    question: &str,
    letters: &[String],
    comment: &str,
    previous: &str,
    base: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    inbox::ensure_triage(&place, base)?;
    let saved = answer::save(&place, TRIAGE, question, letters, comment, previous)?;
    written(&place, saved.text)
}

/// Saves the triage's notes, over the notes last read, `previous`, in the triage read with the
/// hash `base`, as an answer is.
pub fn save_triage_notes(repo: &Path, notes: &str, previous: &str, base: &str) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    inbox::ensure_triage(&place, base)?;
    let saved = answer::save_notes(&place, TRIAGE, notes, previous)?;
    written(&place, saved.text)
}

/// Submits the triage, every question answered, and commits it: `chore: answer the inbox triage`.
/// Refused when it changed since it was read with the hash `previous`.
pub fn submit_triage(repo: &Path, previous: &str) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    inbox::submit_triage(&place, previous, today::today())?;
    committed(&place)
}

/// Commits the answered triage again, after a hook refused its submit.
pub fn retry_triage(repo: &Path) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    inbox::retry_triage(&place)?;
    committed(&place)
}

/// The triage's view once committed.
fn committed(place: &Place) -> Result<FileView> {
    let text = std::fs::read_to_string(place.root.join(TRIAGE))
        .map_err(|error| refused(error.to_string()))?;
    written(place, text)
}
