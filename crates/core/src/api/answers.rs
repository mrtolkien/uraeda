//! The answers to a clarifications round: one answer, the notes, and the round's submission.

use std::path::Path;

use super::{Result, file_view, reach, read_file, write_lock};
use crate::actions::answer;
use crate::today;
use crate::view::FileView;
use crate::workspace::Feature;

fn round_name(feature: &Feature) -> Result<String> {
    let path = answer::round_path(feature)?;
    Ok(path.rsplit('/').next().unwrap_or_default().to_string())
}

/// Saves one answer, from the letters picked and a comment, over the answer last read.
pub fn save_answer(
    repo: &Path,
    folder: &str,
    question: &str,
    letters: &[String],
    comment: &str,
    previous: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    let written = answer::save(&place, &feature, question, letters, comment, previous)?;
    // A save writes an answer's text only: the round's status, read before it, stays right.
    file_view(&git, &feature, &round_name(&feature)?, Some(written.text))
}

/// Saves the notes on the settled points, over the notes last read.
pub fn save_notes(repo: &Path, folder: &str, notes: &str, previous: &str) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    let written = answer::save_notes(&place, &feature, notes, previous)?;
    file_view(&git, &feature, &round_name(&feature)?, Some(written.text))
}

/// Submits the latest round and commits it; refused when `round`, the round the human answered,
/// is another.
pub fn submit_answers(repo: &Path, folder: &str, round: Option<&str>) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    if let Some(round) = round {
        answer::ensure_latest(&feature, round)?;
    }
    answer::submit_and_commit(&place, &feature, today::today())?;
    read_file(repo, folder, &round_name(&feature)?)
}
