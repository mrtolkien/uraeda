//! Answering a round of questions: one answer at a time, then the submission.

use std::fs;

use crate::files::clarifications::{self, Applicability};
use crate::files::{frontmatter, markdown};
use crate::today::Date;
use crate::workspace::{Feature, FileKind};

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

/// Refuses a round that is not `awaiting-human`: an answered round is a record.
fn waiting(text: &str, name: &str) -> Result<(), ActionError> {
    let status = frontmatter::parse(text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    if status.as_deref() == Some("awaiting-human") {
        Ok(())
    } else {
        Err(ActionError::Refused(format!(
            "{name} is not waiting for answers"
        )))
    }
}

/// An answer written: in which file, and how many applicable questions are answered.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Written {
    pub file: String,
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
    let (name, _) = latest_round(feature)?;
    let file = format!("{}/{name}", feature.path);
    let path = place.root.join(&file);
    let text = fs::read_to_string(&path)?;
    waiting(&text, &name)?;
    let edited = clarifications::set_answer(&text, id, answer)?;
    fs::write(&path, &edited)?;
    let questions = clarifications::parse(&edited);
    let applicable: Vec<_> = questions
        .iter()
        .filter(|q| q.applies(&questions) != Applicability::No)
        .collect();
    Ok(Written {
        file,
        answered: applicable.iter().filter(|q| !q.answer.is_empty()).count(),
        total: applicable.len(),
    })
}

/// Submits the latest round: every applicable question answered, `status: answered`, and the
/// block turned into its record.
pub fn submit(place: &Place, feature: &Feature, today: Date) -> Result<Change, ActionError> {
    let (name, round) = latest_round(feature)?;
    let file = format!("{}/{name}", feature.path);
    let path = place.root.join(&file);
    let text = fs::read_to_string(&path)?;
    waiting(&text, &name)?;
    let questions = clarifications::parse(&text);
    let blank: Vec<String> = questions
        .iter()
        .filter(|q| q.answer.is_empty() && q.applies(&questions) != Applicability::No)
        .map(|q| q.id.clone())
        .collect();
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
    Ok(Change {
        paths: vec![file],
        subject: format!("discovery({}): answer round {round:02}", feature.slug),
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

/// Writes the notes over the ones the UI last read. Commits nothing.
pub fn save_notes(
    place: &Place,
    feature: &Feature,
    notes: &str,
    previous: &str,
) -> Result<Written, ActionError> {
    let file = round_path(feature)?;
    let text = fs::read_to_string(place.root.join(&file))?;
    let current = clarifications::notes(&text)
        .map(|(_, notes)| notes)
        .unwrap_or_default();
    if current.trim() != previous.trim() {
        return Err(ActionError::changed(&file));
    }
    write(place, feature, "notes", notes)
}

/// Submits the latest round and commits it, refused before anything is written when other files
/// are staged.
pub fn submit_and_commit(
    place: &Place,
    feature: &Feature,
    today: Date,
) -> Result<super::Committed, ActionError> {
    let path = round_path(feature)?;
    super::place::ensure_only_staged(place, &[path])?;
    let change = submit(place, feature, today)?;
    super::commit::commit(place, &change)
}
