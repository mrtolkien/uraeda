//! Answering a round of questions: one answer at a time, then the submission.

use std::fs;

use crate::files::clarifications::{self, Applicability, RoundNotes};
use crate::files::{frontmatter, markdown};
use crate::gates;
use crate::today::Date;
use crate::workspace::{Feature, FileKind};

use super::images::{images_folder, linked_images};
use super::place::Place;
use super::{ActionError, Change, list};

/// The latest round of a feature: its file name and number.
fn latest_round(feature: &Feature) -> Result<(String, u32), ActionError> {
    feature
        .files
        .iter()
        .filter(|file| file.kind == FileKind::Clarifications)
        .max_by_key(|file| file.round)
        .map(|file| (file.name.clone(), file.round.unwrap_or(0)))
        .ok_or_else(|| ActionError::Refused(format!("{} has no questions", feature.folder)))
}

/// The latest round's file, from the top level.
pub fn round_path(feature: &Feature) -> Result<String, ActionError> {
    let (name, _) = latest_round(feature)?;
    Ok(format!("{}/{name}", feature.path))
}

/// Refuses a round that is not the feature's latest: only the latest is answered and submitted.
pub fn ensure_latest(feature: &Feature, name: &str) -> Result<(), ActionError> {
    let (latest, _) = latest_round(feature)?;
    if latest == name {
        Ok(())
    } else {
        Err(ActionError::Refused(format!(
            "{name} is not the latest round: {latest} is"
        )))
    }
}

/// Refuses a round that is not `awaiting-human`: an answered round is a record.
fn waiting(text: &str, name: &str) -> Result<(), ActionError> {
    if gates::awaits_human(text) {
        Ok(())
    } else {
        Err(ActionError::Refused(format!(
            "{name} is not waiting for answers"
        )))
    }
}

/// An answer written: in which file, its text as written, and how many applicable questions are
/// answered.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Written {
    pub file: String,
    pub text: String,
    pub answered: usize,
    pub total: usize,
}

/// Writes one answer, or the notes with `notes`, in the latest round. Commits nothing.
pub fn write(
    place: &Place,
    feature: &Feature,
    id: &str,
    answer: &str,
) -> Result<Written, ActionError> {
    edit(place, feature, |_, text| {
        Ok(clarifications::set_answer(text, id, answer)?)
    })
}

/// Edits the latest round, waiting for answers, with `change`, which takes the file's path and
/// text and refuses or returns the text to write. Commits nothing.
fn edit(
    place: &Place,
    feature: &Feature,
    change: impl FnOnce(&str, &str) -> Result<String, ActionError>,
) -> Result<Written, ActionError> {
    let (name, _) = latest_round(feature)?;
    let file = format!("{}/{name}", feature.path);
    let path = place.root.join(&file);
    let text = fs::read_to_string(&path)?;
    waiting(&text, &name)?;
    let edited = change(&file, &text)?;
    fs::write(&path, &edited)?;
    let questions = clarifications::parse(&edited);
    let applicable: Vec<_> = questions
        .iter()
        .filter(|q| q.applies(&questions) != Applicability::No)
        .collect();
    Ok(Written {
        file,
        text: edited,
        answered: applicable.iter().filter(|q| !q.answer.is_empty()).count(),
        total: applicable.len(),
    })
}

/// The questions of a round that need an answer and have none, by id: `Q3`, `Q5`.
pub fn blank(text: &str) -> Vec<String> {
    let questions = clarifications::parse(text);
    questions
        .iter()
        .filter(|q| q.answer.is_empty() && q.applies(&questions) != Applicability::No)
        .map(|q| q.id.clone())
        .collect()
}

/// The subject of the commit submitting round `round`: `discovery(recurring-tasks): answer round
/// 01`. `slug` is the feature's.
pub fn subject(slug: &str, round: u32) -> String {
    format!("discovery({slug}): answer round {round:02}")
}

/// Submits the latest round: every applicable question answered, `status: answered`, and the
/// block turned into its record; with the images the feature's folder links, the others deleted.
pub fn submit(place: &Place, feature: &Feature, today: Date) -> Result<Change, ActionError> {
    let (name, round) = latest_round(feature)?;
    let file = format!("{}/{name}", feature.path);
    let path = place.root.join(&file);
    let text = fs::read_to_string(&path)?;
    waiting(&text, &name)?;
    let blank = blank(&text);
    if !blank.is_empty() {
        let verb = if blank.len() == 1 { "has" } else { "have" };
        return Err(ActionError::Refused(format!(
            "{} {verb} no answer",
            list(&blank)
        )));
    }
    let answered = frontmatter::set(&text, "status", "answered");
    let recorded =
        markdown::record_block(&answered, &format!("Answered on {today}.")).unwrap_or(answered);
    fs::write(&path, recorded)?;
    let mut paths = vec![file];
    paths.extend(linked_images(place, &feature.path)?);
    Ok(Change {
        paths,
        subject: subject(&feature.slug, round),
        body: None,
    })
}

/// Writes the answer composed from the letters picked and a comment, as the web UI sends them,
/// over the answer the UI last read, `previous`: a different answer in the file means it changed
/// elsewhere, and nothing is written. Commits nothing.
pub fn save(
    place: &Place,
    feature: &Feature,
    id: &str,
    letters: &[String],
    comment: &str,
    previous: &str,
) -> Result<Written, ActionError> {
    let file = round_path(feature)?;
    let text = fs::read_to_string(place.root.join(&file))?;
    let current = clarifications::parse(&text)
        .into_iter()
        .find(|question| question.id == id)
        .map(|question| question.answer)
        .ok_or_else(|| clarifications::AnswerError::UnknownQuestion(id.to_string()))?;
    if current.trim() != previous.trim() {
        return Err(ActionError::changed(&file));
    }
    write(
        place,
        feature,
        id,
        &clarifications::compose_answer(letters, comment),
    )
}

/// The notes of a round, split, or the refusal of a round without a `**Notes:**` line.
fn round_notes(text: &str) -> Result<RoundNotes, ActionError> {
    Ok(clarifications::round_notes(text).ok_or(clarifications::AnswerError::NoNotesLine)?)
}

/// Writes the free notes over the ones the UI last read, keeping the comments on settled points.
/// Commits nothing.
pub fn save_notes(
    place: &Place,
    feature: &Feature,
    notes: &str,
    previous: &str,
) -> Result<Written, ActionError> {
    edit(place, feature, |file, text| {
        let current = round_notes(text)?;
        if current.free.trim() != previous.trim() {
            return Err(ActionError::changed(file));
        }
        Ok(clarifications::set_notes(text, notes, &current.comments)?)
    })
}

/// Adds a comment on the settled point starting with `subject`, after the round's other comments.
/// Commits nothing.
pub fn add_settled_comment(
    place: &Place,
    feature: &Feature,
    subject: &str,
    text: &str,
) -> Result<Written, ActionError> {
    edit(place, feature, |_, file_text| {
        let mut notes = round_notes(file_text)?;
        let subject = subject.trim();
        if !notes.subjects.iter().any(|known| known == subject) {
            return Err(ActionError::Refused(
                "That point is no longer in the round.".to_string(),
            ));
        }
        notes.comments.push((subject.to_string(), text.to_string()));
        Ok(clarifications::set_notes(
            file_text,
            &notes.free,
            &notes.comments,
        )?)
    })
}

/// Changes comment `number`, counted from 1 in the notes' order, with `change`, over its subject
/// and its text the UI last read, `previous`: another subject or text, or no such comment, means
/// the notes changed elsewhere, as a comment removed renumbers the ones after it.
fn change_settled_comment(
    place: &Place,
    feature: &Feature,
    number: u32,
    (subject, previous): (&str, &str),
    change: impl FnOnce(&mut Vec<(String, String)>, usize),
) -> Result<Written, ActionError> {
    edit(place, feature, |file, text| {
        let mut notes = round_notes(text)?;
        let index = (number as usize).wrapping_sub(1);
        match notes.comments.get(index) {
            Some((on, current))
                if on.trim() == subject.trim() && current.trim() == previous.trim() => {}
            _ => return Err(ActionError::changed(file)),
        }
        change(&mut notes.comments, index);
        Ok(clarifications::set_notes(
            text,
            &notes.free,
            &notes.comments,
        )?)
    })
}

/// Writes comment `number` on the settled point `subject` over its text last read. Commits
/// nothing.
pub fn edit_settled_comment(
    place: &Place,
    feature: &Feature,
    number: u32,
    subject: &str,
    text: &str,
    previous: &str,
) -> Result<Written, ActionError> {
    change_settled_comment(
        place,
        feature,
        number,
        (subject, previous),
        |comments, index| {
            comments[index].1 = text.to_string();
        },
    )
}

/// Removes comment `number` on the settled point `subject`, over its text last read. Commits
/// nothing.
pub fn remove_settled_comment(
    place: &Place,
    feature: &Feature,
    number: u32,
    subject: &str,
    previous: &str,
) -> Result<Written, ActionError> {
    change_settled_comment(
        place,
        feature,
        number,
        (subject, previous),
        |comments, index| {
            comments.remove(index);
        },
    )
}

/// Submits the latest round and commits it, refused before anything is written when other files
/// are staged.
pub fn submit_and_commit(
    place: &Place,
    feature: &Feature,
    today: Date,
) -> Result<super::Committed, ActionError> {
    let path = round_path(feature)?;
    super::place::ensure_only_staged(place, &[path, images_folder(&feature.path)])?;
    let change = submit(place, feature, today)?;
    super::commit::commit(place, &change)
}
