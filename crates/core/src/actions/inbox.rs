//! Editing `INBOX.md` on the default branch: each edit written at once over the version it was
//! read at, as the priorities are, and the moves of notes into the priorities and drafts.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::files::inbox::{self, Inbox};
use crate::files::priorities::{self, Section};
use crate::files::proposal;
use crate::today::Date;

use super::place::Place;
use super::{ActionError, Change, Committed, STALE, answer, changes, commit, draft};

mod image;
mod undo;

pub use image::add_with_image;
pub use undo::{undo_add, undo_as_draft, undo_category, undo_to_draft, undo_to_priorities};

pub const PATH: &str = "specs/INBOX.md";
/// The agent's proposed triage, answered like a round of questions.
pub const TRIAGE: &str = "specs/INBOX-TRIAGE.md";

/// The subject of the commit submitting the triage's answers.
pub const TRIAGE_ANSWERED: &str = "chore: answer the inbox triage";

/// Refuses the triage as changed unless its text has the hash `base`: the page that writes or
/// submits it saw all of it.
pub fn ensure_triage(place: &Place, base: &str) -> Result<(), ActionError> {
    if hash(&fs::read_to_string(place.root.join(TRIAGE))?) == base {
        Ok(())
    } else {
        Err(ActionError::changed(TRIAGE))
    }
}

/// The commit of the triage alone, answered.
fn commit_triage(place: &Place) -> Result<Committed, ActionError> {
    commit::commit(
        place,
        &Change {
            paths: vec![TRIAGE.to_string()],
            subject: TRIAGE_ANSWERED.to_string(),
            body: None,
        },
    )
}

/// Submits the triage, answered as a round is, and commits it alone. Refused before anything is
/// written when it changed since it was read with the hash `previous`, or other files are staged.
pub fn submit_triage(place: &Place, previous: &str, today: Date) -> Result<Committed, ActionError> {
    ensure_triage(place, previous)?;
    super::place::ensure_only_staged(place, &[TRIAGE.to_string()])?;
    answer::record(place, TRIAGE, today)?;
    commit_triage(place)
}

/// Commits the triage again after a hook refused its submit: only an answered triage that the
/// last commit does not hold.
pub fn retry_triage(place: &Place) -> Result<Committed, ActionError> {
    let text = fs::read_to_string(place.root.join(TRIAGE))?;
    let answered = frontmatter::parse(&text)
        .ok()
        .is_some_and(|front| front.text("status") == Some("answered"));
    let git = crate::git::Git::open(&place.root)?;
    let committed = git
        .head()
        .and_then(|head| git.read_file(head, TRIAGE).ok().flatten());
    if !answered || committed.as_deref() == Some(text.as_bytes()) {
        return Err(ActionError::Refused(format!(
            "{} has nothing to commit again",
            answer::name_of(TRIAGE)
        )));
    }
    super::place::ensure_only_staged(place, &[TRIAGE.to_string()])?;
    commit_triage(place)
}

/// The marks a tool writes before a note's text.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Marks {
    /// Whether an agent wrote the note.
    pub agent: bool,
    /// The slug of the feature or change it is about.
    pub about: Option<String>,
}

/// A file's text: empty when it is missing, an error when it cannot be read, so that an edit
/// does not overwrite it.
fn file(place: &Place, path: &str) -> Result<String, ActionError> {
    match fs::read_to_string(place.root.join(path)) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        result => Ok(result?),
    }
}

fn text(place: &Place) -> Result<String, ActionError> {
    file(place, PATH)
}

/// The inbox of `text`, with the status of the triage `triage`, and `changes`, the count of the
/// commit bar's change list.
pub fn of(text: &str, triage: Option<&str>, changes: u32) -> Inbox {
    let status = triage
        .and_then(|triage| frontmatter::parse(triage).ok())
        .and_then(|front| front.text("status").map(String::from));
    Inbox {
        changes,
        triage: status,
        ..inbox::read(text)
    }
}

fn read_text(place: &Place, written: &str) -> Inbox {
    let triage = fs::read_to_string(place.root.join(TRIAGE)).ok();
    of(written, triage.as_deref(), changes::list(place).count)
}

/// The inbox, with its changes since the last commit and the triage's status. A file that cannot
/// be read shows as empty.
pub fn read(place: &Place) -> Inbox {
    read_text(place, &text(place).unwrap_or_default())
}

/// Applies an edit over the version read at `previous`, or over the file as it is without one,
/// and returns the inbox as it wrote it.
fn apply(
    place: &Place,
    previous: Option<&str>,
    edit: impl FnOnce(&str) -> Option<String>,
    refused: &str,
) -> Result<Inbox, ActionError> {
    let current = text(place)?;
    if previous.is_some_and(|previous| hash(&current) != previous) {
        return Err(ActionError::Refused(format!("INBOX.md {STALE}")));
    }
    let edited = edit(&current).ok_or_else(|| ActionError::Refused(refused.to_string()))?;
    fs::write(place.root.join(PATH), &edited)?;
    Ok(read_text(place, &edited))
}

const NO_TEXT: &str = "A note needs text.";

/// Refuses a blank note, and a mark that would not parse back as one: checked by every add, and
/// by `ura note` before it reaches the default branch.
pub fn checked_note(marks: &Marks, text: &str) -> Result<(), ActionError> {
    if text.trim().is_empty() {
        return Err(ActionError::Refused(NO_TEXT.to_string()));
    }
    if let Some(about) = marks
        .about
        .as_deref()
        .filter(|about| !inbox::is_slug(about))
    {
        return Err(ActionError::Refused(format!(
            "{about} is not a slug: lowercase letters, digits, and -"
        )));
    }
    Ok(())
}

/// Adds a note at the end of a category, or of the notes without one, creating the file or the
/// category when missing, and gives the inbox and the note's line, from 1. `previous` is `None`
/// when nothing was read before, as from the CLI.
pub fn add(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    previous: Option<&str>,
) -> Result<(Inbox, u32), ActionError> {
    checked_note(marks, text)?;
    let line = inbox::note_line(marks.agent, marks.about.as_deref(), text);
    let mut at = 0;
    let edit = |current: &str| {
        let (edited, line) = inbox::add(current, category, &line);
        at = line;
        Some(edited)
    };
    let inbox = apply(place, previous, edit, NO_TEXT)?;
    Ok((inbox, at))
}

/// What [`note`] did once the note was written.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Noted {
    /// Committed alone, in this commit.
    Committed(Committed),
    /// Written without committing, as asked.
    Written,
    /// Written without committing: `INBOX.md` had uncommitted changes, someone's work in progress.
    Uncommitted,
}

/// Adds a note, as `ura note` does, and commits `INBOX.md` alone when `commit` is set and the file
/// had no uncommitted change. When it will commit, other staged files are refused before anything
/// is written.
pub fn note(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    commit: bool,
) -> Result<Noted, ActionError> {
    checked_note(marks, text)?;
    let before = fs::read_to_string(place.root.join(PATH)).ok();
    let clean = before == super::place::committed(place, PATH);
    if commit && clean {
        super::place::ensure_only_staged(place, &[PATH.to_string()])?;
    }
    add(place, category, marks, text, None)?;
    match (commit, clean) {
        (false, _) => return Ok(Noted::Written),
        (true, false) => return Ok(Noted::Uncommitted),
        (true, true) => {}
    }
    let subject = format!(
        "chore: add \"{}\" to the inbox",
        super::priorities::short(&crate::files::lines::one_line(text))
    );
    commit::commit(
        place,
        &Change {
            paths: vec![PATH.to_string()],
            subject,
            body: None,
        },
    )
    .map(Noted::Committed)
}

/// Replaces a note's text, its marks and sub-items kept.
pub fn edit(
    place: &Place,
    id: &str,
    text: &str,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    if text.trim().is_empty() {
        return Err(ActionError::Refused(NO_TEXT.to_string()));
    }
    apply(
        place,
        previous,
        |current| inbox::edit(current, id, text),
        &format!("no note {id}"),
    )
}

/// Removes a note, sub-items included.
pub fn remove(place: &Place, id: &str, previous: Option<&str>) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::remove(current, id),
        &format!("no note {id}"),
    )
}

/// Moves a note to the end of a category, or of the notes without one.
pub fn category(
    place: &Place,
    id: &str,
    category: Option<&str>,
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::move_to(current, id, category),
        &format!("no note {id}"),
    )
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal.
pub fn insert(
    place: &Place,
    category: Option<&str>,
    index: usize,
    lines: &[String],
    previous: Option<&str>,
) -> Result<Inbox, ActionError> {
    apply(
        place,
        previous,
        |current| inbox::insert(current, category, index, lines),
        "Nothing to put back.",
    )
}

/// A file's text, refused when it changed since it was read at `previous`.
fn current(place: &Place, path: &str, previous: &str) -> Result<String, ActionError> {
    let text = file(place, path)?;
    if hash(&text) != previous {
        let name = path.rsplit('/').next().unwrap_or(path);
        return Err(ActionError::Refused(format!("{name} {STALE}")));
    }
    Ok(text)
}

fn no_note(id: &str) -> ActionError {
    ActionError::Refused(format!("no note {id}"))
}

/// Writes `edited` over `target`, then `inbox` over `INBOX.md`, and puts `target` back as it was
/// when the second write fails, so a note is never in neither file.
fn write_both(place: &Place, target: &str, edited: &str, inbox: &str) -> Result<(), ActionError> {
    let path = place.root.join(target);
    let before = fs::read_to_string(&path).ok();
    fs::write(&path, edited)?;
    if let Err(error) = fs::write(place.root.join(PATH), inbox) {
        let _ = match before {
            Some(before) => fs::write(&path, before),
            None => fs::remove_file(&path),
        };
        return Err(error.into());
    }
    Ok(())
}

/// The inbox and the priorities, each refused when it changed since it was read.
fn both(
    place: &Place,
    previous: &str,
    priorities_previous: &str,
) -> Result<(String, String), ActionError> {
    let inbox = current(place, PATH, previous)?;
    let priorities = current(place, super::priorities::PATH, priorities_previous)?;
    Ok((inbox, priorities))
}

/// Moves a note's lines, without its marks, to the end of a section of `PRIORITIES.md`. Both files
/// are checked against the versions read before either is written.
pub fn to_priorities(
    place: &Place,
    id: &str,
    section: Section,
    previous: &str,
    priorities_previous: &str,
) -> Result<(), ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    let (lines, _) = inbox::unmarked_lines(&inbox, id).ok_or_else(|| no_note(id))?;
    let edited = priorities::insert_entry(&priorities, section, usize::MAX, &lines)
        .ok_or_else(|| no_note(id))?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    write_both(place, super::priorities::PATH, &edited, &without)
}

/// Makes a note a new draft, `specs/drafts/<slug>.md` or the next free name, linked from the end of
/// a section of `PRIORITIES.md`, and returns the draft's path. A note that links a draft is one.
pub fn to_new_draft(
    place: &Place,
    id: &str,
    section: Section,
    previous: &str,
    priorities_previous: &str,
) -> Result<String, ActionError> {
    let (inbox, priorities) = both(place, previous, priorities_previous)?;
    let note = inbox::note(&inbox, id).ok_or_else(|| no_note(id))?;
    if let Some(link) = note.link.as_deref() {
        return Err(ActionError::Refused(format!(
            "{} already links {link}",
            note.text
        )));
    }
    let (title, nested) = inbox::draft_parts(&inbox, id).ok_or_else(|| no_note(id))?;
    let path = draft::free_path(place, &note.text);
    let entry = format!(
        "- {}",
        inbox::link_to(&title, path.trim_start_matches("specs/"))
    );
    let edited = priorities::insert_entry(&priorities, section, usize::MAX, &[entry])
        .ok_or_else(|| no_note(id))?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    draft::write_new(place, &path, &title, &nested)?;
    if let Err(error) = write_both(place, super::priorities::PATH, &edited, &without) {
        let _ = fs::remove_file(place.root.join(&path));
        return Err(error);
    }
    Ok(path)
}

/// The text of the draft or backlog file at `draft`, from the top level, refused when it is none.
fn draft_text(place: &Place, draft: &str) -> Result<String, ActionError> {
    let plain = !draft.split('/').any(|part| part == ".." || part.is_empty());
    (crate::target::is_draft(draft) && plain && draft.ends_with(".md"))
        .then(|| fs::read_to_string(place.root.join(draft)).ok())
        .flatten()
        .ok_or_else(|| ActionError::Refused(format!("no draft {draft}")))
}

/// A note's lines as written in the draft at `draft`, their relative links rebased to its folder.
fn into_draft(lines: &[String], draft: &str) -> Vec<String> {
    let folder = draft.rsplit_once('/').map_or("", |(folder, _)| folder);
    crate::files::retarget::rebase(&lines.join("\n"), draft::INBOX_FOLDER, folder)
        .split('\n')
        .map(String::from)
        .collect()
}

/// Adds a note's lines, without its marks, at the end of the `## What` section of the draft at
/// `draft`, from the top level.
pub fn to_draft(place: &Place, id: &str, draft: &str, previous: &str) -> Result<(), ActionError> {
    let inbox = current(place, PATH, previous)?;
    let text = draft_text(place, draft)?;
    let (lines, _) = inbox::unmarked_lines(&inbox, id).ok_or_else(|| no_note(id))?;
    let edited = proposal::append_to_what(&text, &into_draft(&lines, draft))
        .ok_or_else(|| ActionError::Refused(format!("{draft} has no ## What section")))?;
    let without = inbox::remove(&inbox, id).ok_or_else(|| no_note(id))?;
    write_both(place, draft, &edited, &without)
}
