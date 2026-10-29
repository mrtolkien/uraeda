//! Expanding a proposal of `PRIORITIES.md` into a file, or a note of the inbox: a proposal file
//! from the proposal template, linked from the line.

use std::fs;

use crate::embedded;
use crate::files::priorities::{self, Proposal};
use crate::slug;

use super::ActionError;
use super::place::Place;

const PRIORITIES: &str = "specs/PRIORITIES.md";
/// The folder of `INBOX.md` and `PRIORITIES.md`, which their relative links start from.
pub(crate) const INBOX_FOLDER: &str = "specs";

/// The proposals that can be expanded: those without a link.
pub fn candidates(place: &Place) -> Result<Vec<Proposal>, ActionError> {
    let text = fs::read_to_string(place.root.join(PRIORITIES))?;
    Ok(priorities::parse(&text)
        .into_iter()
        .filter(|proposal| proposal.link.is_none())
        .collect())
}

/// `  Now   Basic web UI`, one line per proposal, the sections padded to the longest one plus two
/// spaces.
pub fn listed(proposals: &[&Proposal]) -> String {
    let width = proposals
        .iter()
        .map(|proposal| proposal.section.title().len() + 2)
        .max()
        .unwrap_or_default();
    proposals
        .iter()
        .map(|proposal| format!("\n  {:<width$}{}", proposal.section.title(), proposal.text))
        .collect()
}

/// A proposal file written: its path from the top level, and the proposal it expands.
pub struct Expanded {
    pub path: String,
    pub text: String,
}

/// Expands the one proposal of `PRIORITIES.md` containing `query`, ignoring case.
pub fn run(place: &Place, query: &str) -> Result<Expanded, ActionError> {
    let priorities_path = place.root.join(PRIORITIES);
    let text = fs::read_to_string(&priorities_path)?;
    let lower = query.to_lowercase();
    let proposals = priorities::parse(&text);
    let matching: Vec<&Proposal> = proposals
        .iter()
        .filter(|proposal| proposal.text.to_lowercase().contains(&lower))
        .collect();
    let proposal = match matching.as_slice() {
        [] => {
            return Err(ActionError::Refused(format!(
                "no proposal in PRIORITIES.md matches \"{query}\""
            )));
        }
        [proposal] => *proposal,
        several => {
            return Err(ActionError::Refused(format!(
                "{} proposals match \"{query}\":{}",
                several.len(),
                listed(several)
            )));
        }
    };
    expand_line(place, &text, proposal)
}

/// Expands the proposal of `PRIORITIES.md` with the id `id`, like `next-2`, as the web UI names
/// it.
pub fn create(place: &Place, id: &str) -> Result<Expanded, ActionError> {
    let text = fs::read_to_string(place.root.join(PRIORITIES))?;
    let proposals = priorities::parse(&text);
    let proposal = proposals
        .iter()
        .find(|proposal| format!("{}-{}", proposal.section.id(), proposal.position) == id)
        .ok_or_else(|| ActionError::Refused(format!("no proposal {id}")))?;
    expand_line(place, &text, proposal)
}

/// What expanding the proposal `proposal` of the priorities `text` into a file at `path` writes,
/// without writing it: the file's text, from the template, the line as its title and What, its
/// nested lines after it; and the priorities with the line a link to the file, alone. Refused when
/// the line links a file already.
pub(crate) fn expanded(
    text: &str,
    proposal: &Proposal,
    path: &str,
) -> Result<(String, String), ActionError> {
    if let Some(link) = &proposal.link {
        return Err(ActionError::Refused(format!(
            "{} already links {link}",
            proposal.text
        )));
    }
    let content = from_note(path, &proposal.text, &proposal.nested(text));
    if content.is_empty() {
        return Err(ActionError::Refused("no proposal template".into()));
    }
    let target = path.trim_start_matches("specs/");
    let linked = priorities::link(text, proposal.line, target)
        .ok_or_else(|| ActionError::Refused("cannot link the proposal".into()))?;
    Ok((content, linked))
}

fn expand_line(place: &Place, text: &str, proposal: &Proposal) -> Result<Expanded, ActionError> {
    let priorities_path = place.root.join(PRIORITIES);
    if let Some(link) = &proposal.link {
        return Err(ActionError::Refused(format!(
            "{} already links {link}",
            proposal.text
        )));
    }
    let path = format!("{PROPOSALS}/{}.md", slug::from_text(&proposal.text));
    let file = place.root.join(&path);
    if file.exists() {
        return Err(ActionError::Refused(format!("{path} exists")));
    }
    let (content, linked) = expanded(text, proposal, &path)?;
    fs::create_dir_all(file.parent().unwrap_or(&place.root))?;
    fs::write(&file, content)?;
    fs::write(&priorities_path, linked)?;
    Ok(Expanded {
        path,
        text: proposal.text.clone(),
    })
}

/// The folder of proposal files, from the top level.
pub(crate) const PROPOSALS: &str = "specs/proposals";
/// The folder of note files, from the top level.
pub(crate) const NOTES: &str = "specs/notes";

/// A name in `dir`, `specs/proposals` or `specs/notes`, after `text` that no file or folder there
/// has: `<slug>`, then with `-2`, `-3`, ... when a file or a folder has the name.
pub fn free_name(place: &Place, dir: &str, text: &str) -> String {
    let slug = Some(slug::from_text(text))
        .filter(|slug| !slug.is_empty())
        .unwrap_or_else(|| "note".to_string());
    let taken = |name: &str| {
        let base = place.root.join(dir);
        base.join(format!("{name}.md")).exists() || base.join(name).exists()
    };
    (1..)
        .map(|n| match n {
            1 => slug.clone(),
            n => format!("{slug}-{n}"),
        })
        .find(|name| !taken(name))
        .unwrap_or(slug)
}

/// A path for a new proposal file named after `text` that no proposal file has:
/// `specs/proposals/<slug>.md`, or the next free name, as [`free_name`] gives it.
pub fn free_path(place: &Place, text: &str) -> String {
    format!("{PROPOSALS}/{}.md", free_name(place, PROPOSALS, text))
}

/// Writes a new proposal file at `path` from a note, as [`from_note`] gives it.
pub fn write_new(
    place: &Place,
    path: &str,
    line: &str,
    nested: &[String],
) -> Result<(), ActionError> {
    let content = from_note(path, line, nested);
    if content.is_empty() {
        return Err(ActionError::Refused("no proposal template".into()));
    }
    let file = place.root.join(path);
    fs::create_dir_all(file.parent().unwrap_or(&place.root))?;
    fs::write(&file, content)?;
    Ok(())
}

/// The text of the note file `note`, freeform, as a proposal file's, as the workflow reads a
/// proposal's `## What`: the template with the note's `#` title, or `title` when its first line is
/// none, as its title and the first paragraph of What, and the rest of the note after it, as
/// [`proposal`] writes a note's line and nested lines. `None` for a note file with a `## What`
/// already, as older tools wrote them from the template, or without the template.
pub(crate) fn note_as_proposal(note: &str, title: &str) -> Option<String> {
    if crate::files::proposal::has_what(note) {
        return None;
    }
    let shaped = crate::files::with_unix_newlines(note, |note| {
        let (first, rest) = note.split_once('\n').unwrap_or((note, ""));
        let (title, body) = match first.strip_prefix("# ") {
            Some(own) => (own.trim(), rest),
            None => (title, note),
        };
        let body = body.trim_matches('\n');
        let nested = if body.is_empty() {
            Vec::new()
        } else {
            vec![body.to_string()]
        };
        Some(proposal(title, &nested))
            .filter(|shaped| !shaped.is_empty())
            .ok_or(())
    });
    shaped.ok()
}

/// The note file a proposal file [`note_as_proposal`] made was, while it is still exactly that,
/// as the Undo of a note's promotion takes it back. `None` once the human changed it: it stays a
/// proposal's text, which a note file may hold too.
pub(crate) fn proposal_as_note(text: &str) -> Option<String> {
    const MARK: &str = "\u{1}note";
    let note = crate::files::with_unix_newlines(text, |text| {
        let title = text
            .lines()
            .find_map(|line| line.strip_prefix("# "))
            .ok_or(())?
            .trim();
        if proposal(title, &[]) == text {
            return Ok::<_, ()>(format!("# {title}\n"));
        }
        let marked = proposal(title, &[MARK.to_string()]);
        let (head, tail) = marked.split_once(MARK).ok_or(())?;
        let body = text
            .strip_prefix(head)
            .and_then(|rest| rest.strip_suffix(tail))
            .ok_or(())?;
        Ok(format!("# {title}\n\n{body}\n"))
    })
    .ok()?;
    (note_as_proposal(&note, "").as_deref() == Some(text)).then_some(note)
}

/// The proposal template with `line` as its title and as the paragraph of What, and no other
/// placeholder: each section keeps its heading, empty. `nested` lines follow the paragraph.
pub(crate) fn proposal(line: &str, nested: &[String]) -> String {
    let mut paragraphs: Vec<String> = Vec::new();
    for paragraph in embedded::proposal_paragraphs() {
        if paragraph.starts_with("# ") {
            paragraphs.push(format!("# {line}"));
        } else if !embedded::is_placeholder(paragraph) {
            paragraphs.push(paragraph.to_string());
        } else if paragraphs.last().is_some_and(|last| last == "## What") {
            paragraphs.push(line.to_string());
            if !nested.is_empty() {
                paragraphs.push(nested.join("\n"));
            }
        }
    }
    if paragraphs.is_empty() {
        return String::new();
    }
    paragraphs.join("\n\n") + "\n"
}

/// A note file's text, freeform: the note's `line` as its `#` title, then its `nested` lines, and
/// nothing else.
pub(crate) fn note(line: &str, nested: &[String]) -> String {
    if nested.is_empty() {
        return format!("# {line}\n");
    }
    format!("# {line}\n\n{}\n", nested.join("\n"))
}

/// `text`, written from `specs/`, its relative links rebased to the folder of `path`, so they
/// point at the same files.
fn rebased(path: &str, text: &str) -> String {
    let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
    crate::files::retarget::rebase(text, INBOX_FOLDER, folder)
}

/// What a file at `path` made from a note of `INBOX.md` or a proposal of `PRIORITIES.md` holds,
/// its relative links rebased from `specs/` to the file's folder: for a note file, under
/// `specs/notes/`, the [`note`] of its line and nested lines; for a proposal file, their
/// [`proposal`].
pub(crate) fn from_note(path: &str, line: &str, nested: &[String]) -> String {
    if crate::target::is_note_file(path) {
        rebased(path, &note(line, nested))
    } else {
        rebased(path, &proposal(line, nested))
    }
}

/// The proposal file at `path`, its `text`, with `nested`, the lines nested under the proposal of
/// `PRIORITIES.md` that links it, their relative links rebased to the file's folder: at the end of
/// its `## What`, as expand puts them, or at its end without one. A start or a promote leaves the
/// proposal a link alone, and the file takes its lines, so none is lost.
pub(crate) fn with_nested(text: &str, path: &str, nested: &[String]) -> String {
    let count = nested.len()
        - nested
            .iter()
            .rev()
            .take_while(|l| l.trim().is_empty())
            .count();
    if count == 0 {
        return text.to_string();
    }
    let lines: Vec<String> = rebased(path, &nested[..count].join("\n"))
        .split('\n')
        .map(String::from)
        .collect();
    crate::files::proposal::append_to_what(text, &lines)
        .unwrap_or_else(|| format!("{}\n\n{}\n", text.trim_end(), lines.join("\n")))
}

/// What a tool may have written at `path` for a note or a proposal titled `line`, with its
/// `nested` lines: [`from_note`]'s text, and for a note file, the proposal template older tools
/// wrote note files from.
pub(crate) fn written_shapes(path: &str, line: &str, nested: &[String]) -> Vec<String> {
    let mut shapes = vec![from_note(path, line, nested)];
    if crate::target::is_note_file(path) {
        shapes.push(rebased(path, &proposal(line, nested)));
    }
    shapes
}

/// Deletes the proposal file or note file at `path` while it holds what a move wrote, one of
/// `written`, with at most a note's images added at its end: with it go its whole `images/`,
/// which only the move filled, as an image attached since would have changed the text, then its
/// folder once empty. A file typed in is kept. Returns whether it was deleted.
pub(crate) fn remove_written(
    place: &Place,
    path: &str,
    written: &[String],
) -> Result<bool, ActionError> {
    let file = place.root.join(path);
    let Ok(text) = fs::read_to_string(&file) else {
        return Ok(false);
    };
    let folder = super::images::folder_of(path);
    let holds = |written: &String| match folder {
        Some(_) => crate::files::proposal::holds_written(&text, written),
        None => text == *written,
    };
    if !written.iter().any(holds) {
        return Ok(false);
    }
    fs::remove_file(&file)?;
    let Some(folder) = folder else {
        return Ok(true);
    };
    let images = super::images::images_folder(folder);
    // Never deleted through a symbolic link: the files would be another folder's.
    if super::images::in_place(&place.root, &images) {
        fs::remove_dir_all(place.root.join(&images))?;
    }
    // Fails while the folder holds anything else, as it should.
    let _ = fs::remove_dir(place.root.join(folder));
    Ok(true)
}
