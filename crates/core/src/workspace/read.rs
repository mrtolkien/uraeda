//! Reading a feature's or a bug's folder: its files' texts, its record, and whether it differs from
//! its commit.

use std::collections::BTreeMap;

use super::{
    Feature, FileKind, Kind, Problem, ReadFrom, Reader, Source, folder_branch, record_kind,
    record_path,
};
use crate::git::ObjectId;
use crate::steps::Step;

/// The texts of a folder's workflow files, by name, and the names of those that are not UTF-8.
pub(super) fn read_texts(
    reader: &Reader<'_>,
    from: ReadFrom,
    path: &str,
) -> (BTreeMap<String, String>, Vec<String>) {
    let mut texts = BTreeMap::new();
    let mut unreadable = Vec::new();
    for name in reader.files(from, path) {
        if FileKind::of(&name).is_none() {
            continue;
        }
        match reader.read(from, &format!("{path}/{name}")) {
            Some(text) => {
                texts.insert(name, text);
            }
            None => unreadable.push(name),
        }
    }
    (texts, unreadable)
}

/// A finished feature or bug from its record's text, with a problem when the record's kind is not
/// its branch's.
pub(super) fn read_record(
    reader: &Reader<'_>,
    kind: Kind,
    folder: &str,
    text: String,
    from: ReadFrom,
    committed: Option<ObjectId>,
) -> Feature {
    let committed_text =
        committed.and_then(|commit| reader.read(ReadFrom::Commit(commit), &record_path(folder)));
    let recorded = record_kind(&text);
    let mut feature = Feature::from_record(kind, folder, text);
    if recorded != kind && feature.problems.is_empty() {
        let (said, branch) = match kind {
            Kind::Feature => ("bug", "feature's"),
            Kind::Bug => ("feature", "bug's"),
        };
        feature.problems.push(Problem {
            file: record_path(folder),
            line: None,
            rule: "frontmatter.kind".into(),
            message: format!(
                "kind is {said}, but {} is a {branch} branch",
                folder_branch(kind, folder)
            ),
        });
        feature.step = Step::none();
    }
    feature.uncommitted = matches!(from, ReadFrom::Disk)
        && committed_text.as_deref() != feature.text(&format!("{folder}.md"));
    feature.source = source_of(from);
    feature
}

pub(super) fn source_of(from: ReadFrom) -> Source {
    match from {
        ReadFrom::Disk => Source::WorkingTree,
        ReadFrom::Commit(_) => Source::Local,
    }
}

/// Whether a folder read from disk differs from its commit. Git's changes add the deleted files to
/// the texts that differ from the commit.
pub(super) fn folder_uncommitted(
    reader: &Reader<'_>,
    feature: &Feature,
    path: &str,
    from: ReadFrom,
    committed: Option<ObjectId>,
) -> bool {
    let folder_prefix = format!("{path}/");
    matches!(from, ReadFrom::Disk)
        && (feature.texts.iter().any(|(name, text)| {
            let committed_text = committed.and_then(|commit| {
                reader.read(ReadFrom::Commit(commit), &format!("{path}/{name}"))
            });
            committed_text.as_deref() != Some(text.as_str())
        }) || reader
            .git
            .changed_files()
            .is_ok_and(|files| files.iter().any(|file| file.starts_with(&folder_prefix))))
}
