//! A running Storybook's index, `index.json`, and the story a story link names in it.

use std::collections::HashMap;

use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::Value;

use super::upstream;
use crate::paths::address_parts;

/// Why a preview that answers is failed: its index is not JSON, or not an index.
pub(crate) const UNREADABLE: &str = "Storybook's index could not be read.";

/// One entry of Storybook's `index.json` v5: a story, or a docs page.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Entry {
    pub id: String,
    /// The story's export, in the stories file.
    #[serde(default)]
    pub export_name: Option<String>,
    /// The file's path, from the folder the preview runs in: `./src/A.stories.tsx`.
    #[serde(default)]
    pub import_path: String,
    /// `story`, or `docs`.
    #[serde(default, rename = "type")]
    pub kind: String,
}

/// Storybook's `index.json`: its entries by id.
#[derive(Debug, Deserialize)]
pub(crate) struct StoryIndex {
    pub entries: HashMap<String, Entry>,
}

/// Why an index was not read.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum NoIndex {
    /// Nothing answers yet, or not with a 200.
    NotYet,
    /// A 200 that is not an index: see [`UNREADABLE`].
    Unreadable,
}

/// The index of the preview on `port`.
pub(super) async fn read(port: u16) -> Result<StoryIndex, NoIndex> {
    let got = upstream::get(port, "/index.json").await;
    let got = got.filter(|got| got.status == StatusCode::OK);
    parsed(&got.ok_or(NoIndex::NotYet)?.body)
}

/// An index's text as an index.
fn parsed(text: &[u8]) -> Result<StoryIndex, NoIndex> {
    let index: Value = serde_json::from_slice(text).map_err(|_| NoIndex::Unreadable)?;
    serde_json::from_value(index).map_err(|_| NoIndex::Unreadable)
}

/// The entry of the story a link names, in the index of the preview run in `folder`: the one
/// whose `importPath`, joined to the folder, is the link's file, and whose `exportName` is its
/// export.
pub(crate) fn match_story<'a>(
    index: &'a StoryIndex,
    folder: &str,
    path: &str,
    export: &str,
) -> Option<&'a Entry> {
    let path = normalized(path);
    index.entries.values().find(|entry| {
        entry.kind == "story"
            && entry.export_name.as_deref() == Some(export)
            && normalized(&format!("{folder}/{}", entry.import_path)) == path
    })
}

/// A path without its `.` parts, with each `..` taking the part before it.
fn normalized(path: &str) -> String {
    address_parts(path).join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    const INDEX: &str = r#"{ "v": 5, "entries": {
        "a--docs": { "id": "a--docs", "importPath": "./src/A.stories.tsx", "type": "docs" },
        "a--one": { "id": "a--one", "exportName": "One", "importPath": "./src/A.stories.tsx", "type": "story" },
        "b--one": { "id": "b--one", "exportName": "One", "importPath": "./src/B.stories.tsx", "type": "story" }
    } }"#;

    // Each row: the folder the preview runs in, the link's file and export, and the story's id.
    const ROWS: [(&str, &str, &str, Option<&str>); 6] = [
        (
            "packages/web",
            "packages/web/src/A.stories.tsx",
            "One",
            Some("a--one"),
        ),
        (
            "packages/web",
            "packages/web/src/B.stories.tsx",
            "One",
            Some("b--one"),
        ),
        (
            "packages/web",
            "./packages/web/./src/A.stories.tsx",
            "One",
            Some("a--one"),
        ),
        (".", "src/A.stories.tsx", "One", Some("a--one")),
        (
            "packages/web",
            "packages/web/src/A.stories.tsx",
            "Two",
            None,
        ),
        ("packages/web", "src/A.stories.tsx", "One", None),
    ];

    #[test]
    fn a_story_is_found_by_its_file_and_its_export() {
        let index = parsed(INDEX.as_bytes()).unwrap();

        for (folder, path, export, id) in ROWS {
            let found = match_story(&index, folder, path, export);
            assert_eq!(
                found.map(|entry| entry.id.as_str()),
                id,
                "{folder} {path}#{export}"
            );
        }
        assert_eq!(parsed(b"not json").unwrap_err(), NoIndex::Unreadable);
        assert_eq!(parsed(b"{}").unwrap_err(), NoIndex::Unreadable);
    }
}
