//! An agent's note from a feature's or a change's worktree: a note file of its own in
//! `specs/notes/`, so its branch never writes `INBOX.md`.

use std::fs;

use super::super::place::Place;
use super::super::{ActionError, Change, commit};
use super::{Marks, Noted, added_subject, checked_note};

const NOTES: &str = "specs/notes";

/// The words of a note file's name: the slug of the note's first four words, apostrophes dropped
/// first, so "record's" gives `records`.
fn words(text: &str) -> String {
    let words: Vec<&str> = text.split_whitespace().take(4).collect();
    crate::slug::from_text(&words.join(" ").replace(['\'', '’'], ""))
}

/// The first free path for the note: `<about>-<words>.md`, or the words alone without `about`,
/// then `-2`, `-3`, ... when taken.
fn free_path(place: &Place, marks: &Marks, text: &str) -> String {
    let words = words(text);
    let stem = match (marks.about.as_deref(), words.is_empty()) {
        (Some(about), true) => about.to_string(),
        (Some(about), false) => format!("{about}-{words}"),
        (None, true) => "note".to_string(),
        (None, false) => words,
    };
    let mut path = format!("{NOTES}/{stem}.md");
    let mut count = 2;
    while place.root.join(&path).exists() {
        path = format!("{NOTES}/{stem}-{count}.md");
        count += 1;
    }
    path
}

/// The note file's text: its frontmatter, `about` and `category` each only when set, and the note
/// as its title.
fn content(category: Option<&str>, marks: &Marks, text: &str) -> String {
    let mut front = String::from("---\nagent: true\n");
    if let Some(about) = &marks.about {
        front.push_str(&format!("about: {about}\n"));
    }
    if let Some(category) = category {
        front.push_str(&format!("category: {category}\n"));
    }
    format!("{front}---\n\n# {}\n", crate::files::lines::one_line(text))
}

/// Writes an agent's note as a note file of its own, and commits it alone when `commit` is set:
/// `ura note --agent` in a feature's or a change's worktree. Gives the file's path, from the top
/// level.
pub fn agent_note(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    commit: bool,
) -> Result<(String, Noted), ActionError> {
    checked_note(marks, text)?;
    let path = free_path(place, marks, text);
    fs::create_dir_all(place.root.join(NOTES))?;
    fs::write(place.root.join(&path), content(category, marks, text))?;
    if !commit {
        return Ok((path, Noted::Written));
    }
    let committed = commit::commit_only(
        place,
        &Change {
            paths: vec![path.clone()],
            subject: added_subject(text),
            body: None,
        },
    )?;
    Ok((path, Noted::Committed(committed)))
}
