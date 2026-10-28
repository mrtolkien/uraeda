//! `layout.unlinked-note`: a note file of `specs/notes/` that no note of `INBOX.md` links, as a
//! removal leaves one the human typed in, so that it is found again.

use std::fs;
use std::path::Path;

use crate::files::inbox;
use crate::workspace::{Problem, Severity};

/// Warns on each note file of `dir`, when it is a `specs/notes/` folder, that no note of the
/// `INBOX.md` beside it links: a single `<slug>.md`, or a folder's `note.md`.
pub(super) fn check_note_files(root: &Path, dir: &Path, problems: &mut Vec<Problem>) {
    let Some(specs) = dir
        .parent()
        .filter(|_| dir.file_name() == Some("notes".as_ref()))
    else {
        return;
    };
    if specs.file_name() != Some("specs".as_ref()) {
        return;
    }
    let text = fs::read_to_string(specs.join("INBOX.md")).unwrap_or_default();
    let linked: Vec<String> = inbox::parse(&text)
        .iter()
        .filter_map(inbox::Note::file)
        .collect();
    let mut files: Vec<String> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let is_dir = entry.file_type().is_ok_and(|kind| kind.is_dir());
            match is_dir {
                true if entry.path().join("note.md").is_file() => Some(format!("{name}/note.md")),
                false if name.ends_with(".md") => Some(name),
                _ => None,
            }
        })
        .collect();
    files.sort();
    for file in files {
        if linked.contains(&format!("specs/notes/{file}")) {
            continue;
        }
        problems.push(Problem {
            file: super::relative(root, &dir.join(&file)),
            line: None,
            rule: "layout.unlinked-note".into(),
            message: "no note links this note file".into(),
            severity: Severity::Warning,
        });
    }
}
