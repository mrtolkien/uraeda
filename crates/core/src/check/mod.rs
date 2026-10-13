//! `ura check`: every rule of the skill that a file can be checked against, each with a stable id.
//! Every rule here is written in the skill (see `specs/decisions/cli.md`).

mod answers;
mod links;
mod names;
mod sections;
mod values;

pub use values::{Action, Choice, Field, FieldKind};

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::files::{frontmatter, markdown, review};
use crate::workspace::{FileKind, Problem};

#[derive(Debug, thiserror::Error)]
pub enum CheckError {
    #[error("{}: no such file or folder", .0.display())]
    Missing(PathBuf),
}

/// What a file is, for the rules that apply to it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Checked {
    Workflow(FileKind),
    Decision,
    Priorities,
    /// The record of a finished feature or bug, in `specs/done/`.
    Record,
}

/// A file being checked, with the other files of its folder.
pub(crate) struct File<'a> {
    /// From the root, like `specs/2026-10-10-x/spec.md`.
    pub path: String,
    pub text: &'a str,
    pub kind: Checked,
    /// The texts of the other workflow files of its folder, by name.
    pub folder: &'a BTreeMap<String, String>,
    /// Where the root is, for links from the repository's top level.
    pub root: &'a Path,
}

impl File<'_> {
    pub fn problem(&self, line: Option<usize>, rule: &str, message: impl Into<String>) -> Problem {
        Problem {
            file: self.path.clone(),
            line,
            rule: rule.to_string(),
            message: message.into(),
        }
    }
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned()
}

/// Checks a `specs/` folder, any folder under it, or one file, against the skill's rules.
pub fn check(root: &Path, target: &Path) -> Result<Vec<Problem>, CheckError> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let target = fs::canonicalize(target).map_err(|_| CheckError::Missing(target.into()))?;
    let mut problems = Vec::new();
    if target.is_file() {
        let dir = target.parent().unwrap_or(&root);
        let name = target.file_name().unwrap_or_default().to_string_lossy();
        let mut found = check_folder_files(&root, dir, true, &mut problems);
        problems.extend(found.remove(name.as_ref()).unwrap_or_default());
        problems.retain(|p| p.file == relative(&root, &target));
    } else {
        walk(&root, &target, &mut problems);
    }
    problems.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(problems)
}

/// The problems `check(root, path)` would report if the file at `path` held `text`: the rest of its
/// folder is read from disk.
pub fn check_text(root: &Path, path: &Path, text: &str) -> Vec<Problem> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let path = canonical_file(path);
    let dir = path.parent().unwrap_or(&root);
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    let mut problems = Vec::new();
    let mut found = check_folder_files_with(&root, dir, true, Some((&name, text)), &mut problems);
    problems.extend(found.remove(name.as_ref()).unwrap_or_default());
    problems.retain(|p| p.file == relative(&root, &path));
    problems.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    problems
}

/// The frontmatter fields of the file at `path`, under `root`, if it held `text`: its kind's
/// fields, required then optional, with their lines and values in `text`. Empty for a file without
/// frontmatter fields.
pub fn fields(root: &Path, path: &Path, text: &str) -> Vec<Field> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let path = canonical_file(path);
    let dir = path.parent().unwrap_or(&root);
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    match kind_of(dir, &name, true) {
        Some(kind) => values::field_list(kind, text),
        None => Vec::new(),
    }
}

/// The frontmatter fields of the file at `path`, under `root`, as it is on disk: empty when it
/// cannot be read.
pub fn fields_on_disk(root: &Path, path: &Path) -> Vec<Field> {
    match fs::read_to_string(path) {
        Ok(text) => fields(root, path, &text),
        Err(_) => Vec::new(),
    }
}

/// A file's path with its folder resolved, even when the file itself is not on disk yet.
fn canonical_file(path: &Path) -> PathBuf {
    if let Ok(path) = fs::canonicalize(path) {
        return path;
    }
    match (path.parent(), path.file_name()) {
        (Some(dir), Some(name)) => fs::canonicalize(dir)
            .map(|dir| dir.join(name))
            .unwrap_or_else(|_| path.to_path_buf()),
        _ => path.to_path_buf(),
    }
}

/// Checks every folder under `dir`.
fn walk(root: &Path, dir: &Path, problems: &mut Vec<Problem>) {
    names::check_folder_names(root, dir, problems);
    let found = check_folder_files(root, dir, false, problems);
    problems.extend(found.into_values().flatten());
    let mut subfolders: Vec<PathBuf> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
        .map(|entry| entry.path())
        .filter(|path| {
            !path
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with('.'))
        })
        .collect();
    subfolders.sort();
    for subfolder in subfolders {
        walk(root, &subfolder, problems);
    }
}

/// What kind of file a name is, in a folder: decisions in `decisions/`, priorities at the top.
fn kind_of(dir: &Path, name: &str, any_folder: bool) -> Option<Checked> {
    let parent = dir.file_name().map(|n| n.to_string_lossy().into_owned());
    if parent.as_deref() == Some("decisions") && name.ends_with(".md") {
        return Some(Checked::Decision);
    }
    let grandparent = dir.parent().and_then(Path::file_name);
    if parent.as_deref() == Some("done")
        && grandparent.is_some_and(|name| name == "specs")
        && name.ends_with(".md")
    {
        return Some(Checked::Record);
    }
    if name == "PRIORITIES.md" {
        return Some(Checked::Priorities);
    }
    if !any_folder && !names::is_workflow_folder(dir) {
        return None;
    }
    FileKind::of(name).map(|(kind, _)| Checked::Workflow(kind))
}

/// Checks the workflow files directly inside a folder, and returns the problems by file name.
fn check_folder_files(
    root: &Path,
    dir: &Path,
    any_folder: bool,
    problems: &mut Vec<Problem>,
) -> BTreeMap<String, Vec<Problem>> {
    check_folder_files_with(root, dir, any_folder, None, problems)
}

/// Like `check_folder_files`, with one file's text, by name, in place of its file on disk.
fn check_folder_files_with(
    root: &Path,
    dir: &Path,
    any_folder: bool,
    replaced: Option<(&str, &str)>,
    problems: &mut Vec<Problem>,
) -> BTreeMap<String, Vec<Problem>> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect();
    if let Some((name, _)) = replaced
        && !names.iter().any(|existing| existing == name)
    {
        names.push(name.to_string());
    }
    names.sort();
    if any_folder || names::is_workflow_folder(dir) {
        names::check_rounds(root, dir, &names, problems);
    }
    let mut texts = BTreeMap::new();
    let mut found: BTreeMap<String, Vec<Problem>> = BTreeMap::new();
    for name in &names {
        if kind_of(dir, name, any_folder).is_none() {
            continue;
        }
        if let Some((replaced, text)) = replaced
            && replaced == name
        {
            texts.insert(name.clone(), text.to_string());
            continue;
        }
        match fs::read(dir.join(name)).map(String::from_utf8) {
            Ok(Ok(text)) => {
                texts.insert(name.clone(), text);
            }
            _ => {
                found.entry(name.clone()).or_default().push(Problem {
                    file: relative(root, &dir.join(name)),
                    line: None,
                    rule: "file.utf8".into(),
                    message: "not UTF-8".into(),
                });
            }
        }
    }
    for (name, text) in &texts {
        let Some(kind) = kind_of(dir, name, any_folder) else {
            continue;
        };
        let file = File {
            path: relative(root, &dir.join(name)),
            text,
            kind,
            folder: &texts,
            root,
        };
        found
            .entry(name.clone())
            .or_default()
            .extend(check_file(&file));
    }
    found
}

fn check_file(file: &File<'_>) -> Vec<Problem> {
    let mut problems = Vec::new();
    let front = values::check_frontmatter(file, &mut problems);
    let document = markdown::Document::parse(file.text);
    match file.kind {
        Checked::Priorities => sections::check_priorities(file, &document, &mut problems),
        Checked::Workflow(FileKind::Review) => check_review(file, &mut problems),
        _ => sections::check_sections(file, &document, &mut problems),
    }
    if file.kind == Checked::Record {
        sections::check_record_numbering(file, &document, &mut problems);
        let name = Path::new(&file.path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let dated = name
            .strip_suffix(".md")
            .is_some_and(|stem| crate::workspace::folder_slug(stem).is_some());
        if !dated {
            problems.push(file.problem(
                None,
                "names.record",
                format!("\"{name}\" is not a record's name: YYYY-MM-DD-<slug>.md"),
            ));
        }
        let noted = document
            .callout
            .as_ref()
            .is_some_and(|c| c.kind == markdown::CalloutKind::Note);
        if !noted {
            problems.push(file.problem(
                None,
                "blocks.note",
                "a record opens with a \"> [!NOTE]\" block",
            ));
        }
    }
    if let Checked::Workflow(FileKind::Clarifications) = file.kind {
        answers::check_answers(file, front.as_ref(), &mut problems);
    }
    if let Some(front) = &front {
        let waiting = front.text("status") == Some("awaiting-human");
        let has_block = document
            .callout
            .as_ref()
            .is_some_and(|c| c.kind == markdown::CalloutKind::Important);
        if waiting && !has_block {
            problems.push(file.problem(
                None,
                "blocks.important",
                "a file waiting for the human opens with a \"> [!IMPORTANT]\" block",
            ));
        }
    }
    links::check_links(file, &document, &mut problems);
    problems
}

fn check_review(file: &File<'_>, problems: &mut Vec<Problem>) {
    let review = match review::parse(file.text) {
        Ok(review) => review,
        Err(review::ReviewError::Frontmatter(_)) => return,
        Err(error) => {
            let line = match &error {
                review::ReviewError::BadAnchor { line, .. } => Some(*line),
                _ => None,
            };
            problems.push(file.problem(line, "reviews.format", error.to_string()));
            return;
        }
    };
    if review.verdict == review::Verdict::ChangesRequested && review.comments.is_empty() {
        problems.push(file.problem(
            None,
            "reviews.comment",
            "a request for changes needs at least one comment",
        ));
    }
    for (index, comment) in review.comments.iter().enumerate() {
        if comment.number as usize != index + 1 {
            problems.push(file.problem(
                Some(comment.line),
                "reviews.numbering",
                format!("C{} should be C{}", comment.number, index + 1),
            ));
        }
        if matches!(comment.anchor, review::Anchor::Lines(..)) && comment.quote.is_empty() {
            problems.push(file.problem(
                Some(comment.line),
                "reviews.quote",
                format!("C{} quotes no line", comment.number),
            ));
        }
    }
}

/// The frontmatter of a file, when it parses.
pub(crate) fn parse_frontmatter(text: &str) -> Option<frontmatter::Frontmatter> {
    frontmatter::parse(text).ok()
}
