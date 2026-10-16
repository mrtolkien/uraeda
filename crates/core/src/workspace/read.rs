//! Reading a feature's or a change's folder: its files' texts, its record, and whether it differs
//! from its commit.

use std::collections::BTreeMap;

use super::{
    Feature, FileKind, Kind, Problem, ReadFrom, Reader, Source, first_file, folder_branch,
    folder_path, record_kind, record_path, resolve,
};
use crate::files::{frontmatter, markdown};
use crate::git::ObjectId;
use crate::steps::{self, PullRequest, Step};

/// The texts of a folder's workflow files, by name, and the names of those that are not UTF-8.
fn read_texts(
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

/// A finished feature or change from its record's text, with a problem when the record's kind is not
/// its branch's.
fn read_record(
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
            Kind::Feature => ("change", "feature's"),
            Kind::Change => ("feature", "change's"),
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

fn source_of(from: ReadFrom) -> Source {
    match from {
        ReadFrom::Disk => Source::WorkingTree,
        ReadFrom::Commit(_) => Source::Local,
    }
}

/// Whether a folder read from disk differs from its commit. Git's changes add the deleted files to
/// the texts that differ from the commit.
fn folder_uncommitted(
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

/// A feature or change, from its folder, or its record when the folder is gone. Read from disk, its
/// step is read from `committed`, its latest commit, while its files stay the disk's (R4).
pub(super) fn read_feature(
    reader: &Reader<'_>,
    kind: Kind,
    folder: &str,
    branch: Option<String>,
    from: ReadFrom,
    committed: Option<ObjectId>,
) -> Feature {
    let mut feature = read_folder(reader, kind, folder, branch, from, committed);
    feature.step = steps::step(&feature, PullRequest::Unknown);
    if let (ReadFrom::Disk, Some(commit)) = (from, committed) {
        let at_tip = read_feature(
            reader,
            kind,
            folder,
            None,
            ReadFrom::Commit(commit),
            committed,
        );
        feature.step = at_tip.step.clone();
        feature.at_tip = Some(Box::new(at_tip));
    }
    feature
}

/// A feature or change, from its folder, or its record when the folder is gone.
fn read_folder(
    reader: &Reader<'_>,
    kind: Kind,
    folder: &str,
    branch: Option<String>,
    from: ReadFrom,
    committed: Option<ObjectId>,
) -> Feature {
    let path = folder_path(kind, folder);
    let (texts, unreadable) = read_texts(reader, from, &path);
    if texts.is_empty()
        && unreadable.is_empty()
        && let Some(text) = reader.read(from, &record_path(folder))
    {
        let mut feature = read_record(reader, kind, folder, text, from, committed);
        feature.branch = branch;
        return feature;
    }
    let mut feature = Feature::from_texts(kind, folder, texts);
    feature.mockups = reader
        .files(from, &format!("{path}/mockups"))
        .into_iter()
        .filter(|name| name.ends_with(".html"))
        .collect();
    feature.mockups.sort();
    for name in unreadable {
        feature.problems.push(Problem {
            file: format!("{path}/{name}"),
            line: None,
            rule: "file.utf8".into(),
            message: "not UTF-8".into(),
        });
    }
    feature.branch = branch;
    feature.source = source_of(from);
    let first_path = format!("{path}/{}", first_file(kind));
    feature.proposal_committed = committed.is_some_and(|commit| {
        reader
            .git
            .read_file(commit, &first_path)
            .ok()
            .flatten()
            .is_some()
    });
    feature.uncommitted = folder_uncommitted(reader, &feature, &path, from, committed);
    feature.decisions_pending = feature
        .texts
        .get("spec.md")
        .is_some_and(|spec| decisions_pending(reader, from, &path, folder, spec));
    feature
}

/// Whether a decision the spec links is `proposed`, or has a proposed change for this folder.
fn decisions_pending(
    reader: &Reader<'_>,
    from: ReadFrom,
    dir: &str,
    folder: &str,
    spec: &str,
) -> bool {
    let document = markdown::Document::parse(spec);
    let start = document
        .headings
        .iter()
        .find(|h| h.level == 2 && h.text == "Decisions")
        .map(|h| h.line);
    let Some(start) = start else {
        return false;
    };
    let end = document
        .headings
        .iter()
        .find(|h| h.level <= 2 && h.line > start)
        .map_or(usize::MAX, |h| h.line);
    let change = format!("## Proposed change ({folder})");
    document
        .links
        .iter()
        .filter(|link| link.line > start && link.line < end && !link.wiki)
        .filter_map(|link| resolve(dir, &link.target))
        .filter(|path| path.starts_with("specs/decisions/"))
        .any(|path| {
            let Some(text) = reader.read(from, &path) else {
                return false;
            };
            let proposed = frontmatter::parse(&text)
                .is_ok_and(|front| front.text("status") == Some("proposed"));
            proposed || text.lines().any(|line| line.trim_end() == change)
        })
}
