//! A round of questions on the default branch, the inbox's triage `specs/INBOX-TRIAGE.md` or the
//! decisions check `specs/DECISIONS-CHECK.md`: read and answered on the default branch, with the
//! rules of a feature's round of questions.

use std::path::Path;

use crate::actions::answer;
use crate::actions::default_round::{self, DefaultRound};
use crate::actions::place::Place;
use crate::api::{Result, on_default, open, reach_default, refused, write_lock};
use crate::decisions::Candidate;
use crate::decisions::candidates;
use crate::files::document;
use crate::files::frontmatter;
use crate::files::items::{Items, round};
use crate::files::stories::story_links;
use crate::git::{Git, ObjectId};
use crate::today;
use crate::view::{FileView, VersionView};
use crate::workspace::FileKind;

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

/// The round's view, as a round of questions: `committed` is its text at the default branch's
/// tip, `tip`.
fn view(
    round: DefaultRound,
    text: String,
    committed: Option<String>,
    tip: Option<ObjectId>,
    candidates: Vec<Candidate>,
) -> FileView {
    let status = frontmatter::parse(&text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let kind = crate::view::kind_name(Some(FileKind::Clarifications));
    FileView {
        id: round.id().to_string(),
        folder: String::new(),
        name: answer::name_of(round.path()).to_string(),
        path: round.path().to_string(),
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
        candidates,
        answered: None,
    }
}

/// The round's view once `text` was written in the default branch's checkout.
fn written(place: &Place, round: DefaultRound, text: String) -> Result<FileView> {
    let git = Git::open(&place.root)?;
    let tip = git.head();
    let committed = tip
        .and_then(|tip| git.read_file(tip, round.path()).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok());
    let found = candidates_of(round, || candidates::read(&place.root));
    Ok(view(round, text, committed, tip, found))
}

/// The candidates of the round, none for a round that has none.
fn candidates_of(round: DefaultRound, read: impl FnOnce() -> Vec<Candidate>) -> Vec<Candidate> {
    match round {
        DefaultRound::DecisionsCheck => read(),
        DefaultRound::Triage => Vec::new(),
    }
}

/// The round on the default branch, from the checkout that has it, else from its tip, without
/// creating a worktree; none without one.
pub fn read_round(repo: &Path, round: DefaultRound) -> Result<Option<FileView>> {
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, round.path());
    let tip = workspace
        .default_branch
        .as_deref()
        .and_then(|default| git.tip(default));
    let found = candidates_of(round, || candidates::on_default(&git, &workspace));
    Ok(text.map(|text| view(round, text, committed, tip, found)))
}

/// Saves one answer of the round, from the letters picked and a comment, over the answer last
/// read, `previous`, in the round read with the hash `base`: a round changed elsewhere since is
/// refused, so the hash of the text written covers only what the page saw.
pub fn save_round_answer(
    repo: &Path,
    round: DefaultRound,
    question: &str,
    letters: &[String],
    comment: &str,
    previous: &str,
    base: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    default_round::ensure_unchanged(&place, round, base)?;
    let saved = answer::save(&place, round.path(), question, letters, comment, previous)?;
    written(&place, round, saved.text)
}

/// Saves the round's notes, over the notes last read, `previous`, in the round read with the hash
/// `base`, as an answer is.
pub fn save_round_notes(
    repo: &Path,
    round: DefaultRound,
    notes: &str,
    previous: &str,
    base: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    default_round::ensure_unchanged(&place, round, base)?;
    let saved = answer::save_notes(&place, round.path(), notes, previous)?;
    written(&place, round, saved.text)
}

/// Submits the round, every question answered, and commits it with the round's own subject.
/// Refused when it changed since it was read with the hash `previous`.
pub fn submit_round(repo: &Path, round: DefaultRound, previous: &str) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    default_round::submit(&place, round, previous, today::today())?;
    committed(&place, round)
}

/// Commits the answered round again, after a hook refused its submit.
pub fn retry_round(repo: &Path, round: DefaultRound) -> Result<FileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    default_round::retry(&place, round)?;
    committed(&place, round)
}

/// The round's view once committed.
fn committed(place: &Place, round: DefaultRound) -> Result<FileView> {
    let text = std::fs::read_to_string(place.root.join(round.path()))
        .map_err(|error| refused(error.to_string()))?;
    written(place, round, text)
}

/// The round with the id `id`, refused when there is none: the id comes from a page or a message.
pub fn default_round(id: &str) -> Result<DefaultRound> {
    DefaultRound::from_id(id).ok_or_else(|| refused(format!("no round {id} on the default branch")))
}
