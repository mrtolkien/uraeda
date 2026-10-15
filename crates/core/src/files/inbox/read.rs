//! `INBOX.md` read for editing: its notes by category, with what the web UI shows and writes back.

use super::super::lines::Item;
use super::{Note, body, category_names, parse, scan};

/// A note of `INBOX.md`, for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxNote {
    /// `note-3`: its place in the file, from 1.
    pub id: String,
    /// Its address: the slug of its text, made unique.
    pub key: String,
    /// The markdown of its text, after its marker and marks, on one line.
    pub text: String,
    pub spans: Vec<super::super::document::Span>,
    pub agent: bool,
    /// The slug of the feature or change it is about.
    pub about: Option<String>,
    /// The path of the draft its whole text links to, from the repository's top level.
    pub draft: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
    /// Its lines as written, sub-items included: what an Undo of its removal writes back.
    pub lines: Vec<String>,
}

#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxCategory {
    /// `None` for the notes before the first category.
    pub name: Option<String>,
    pub notes: Vec<InboxNote>,
}

/// `INBOX.md` read for editing.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inbox {
    /// The SHA-256 of the text, to refuse edits over a change made elsewhere.
    pub hash: String,
    /// The categories that hold notes, the notes without one first, then in file order. Notes
    /// under two headings of the same name are in one category.
    pub categories: Vec<InboxCategory>,
    /// Every category's name, once, in file order, empty ones included: what the add form offers.
    pub names: Vec<String>,
    /// How many notes it holds.
    pub count: u32,
    /// How many changes wait for a commit.
    pub changes: u32,
    /// The status of `INBOX-TRIAGE.md`, when there is one.
    pub triage: Option<String>,
}

fn inbox_note(lines: &[&str], note: Note, item: &Item) -> InboxNote {
    let (_, _, text) = body(lines, item);
    let markdown = text.join(" ");
    let doc = super::super::document::parse(&markdown, "specs");
    let draft = note
        .link
        .as_deref()
        .and_then(|link| crate::workspace::resolve("specs", link))
        .filter(|path| path.starts_with("specs/drafts/"));
    InboxNote {
        id: note.id,
        key: note.key,
        text: markdown,
        spans: doc
            .blocks
            .first()
            .map(|b| b.spans.clone())
            .unwrap_or_default(),
        agent: note.agent,
        about: note.about,
        draft,
        start_line: note.line as u32,
        end_line: note.end as u32,
        lines: lines[note.line - 1..note.end]
            .iter()
            .map(|l| l.to_string())
            .collect(),
    }
}

/// The notes of `INBOX.md` by category.
pub fn read(text: &str) -> Inbox {
    let unix = text.replace("\r\n", "\n");
    let lines: Vec<&str> = unix.split('\n').collect();
    let notes = parse(&unix);
    let count = notes.len() as u32;
    let mut categories: Vec<InboxCategory> = vec![InboxCategory {
        name: None,
        notes: Vec::new(),
    }];
    for (note, (_, item)) in notes.into_iter().zip(scan(&unix)) {
        let name = note.category.clone();
        let note = inbox_note(&lines, note, &item);
        match categories.iter_mut().find(|c| c.name == name) {
            Some(category) => category.notes.push(note),
            None => categories.push(InboxCategory {
                name,
                notes: vec![note],
            }),
        }
    }
    categories.retain(|c| !c.notes.is_empty());
    let mut names = category_names(&unix);
    let mut seen = std::collections::HashSet::new();
    names.retain(|name| seen.insert(name.clone()));
    Inbox {
        hash: super::super::document::hash(text),
        categories,
        names,
        count,
        changes: 0,
        triage: None,
    }
}
