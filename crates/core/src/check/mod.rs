//! `ura check`: every rule of the skill that a file can be checked against, each with a stable id.
//! Every rule here is written in the skill (see `specs/decisions/cli.md`).

mod answers;
mod decision;
mod finder;
mod links;
mod names;
mod record;
mod reviews;
mod sections;
mod spec;
mod unapproved;
mod values;
mod writing;

pub use decision::{DECISION_ALTERNATIVES, DECISION_RULES};
pub use finder::{Fixed, fix};
pub use spec::{SPEC_WORDS, reviewed_words};
pub use values::{Action, Choice, Field, FieldKind, allowed_values};

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::files::{frontmatter, markdown};
use crate::git::{Git, ObjectId};
use crate::workspace::{FileKind, Problem, Severity};
use finder::Finder;

#[derive(Debug, thiserror::Error)]
pub enum CheckError {
    #[error("{}: no such file or folder", .0.display())]
    Missing(PathBuf),
    /// The fix could not write its files.
    #[error(transparent)]
    Fix(#[from] crate::actions::ActionError),
}

/// What a file is, for the rules that apply to it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Checked {
    Workflow(FileKind),
    Decision,
    /// `decisions/preview.md`: a decision, with the preview fields.
    PreviewDecision,
    /// The record of a finished feature or change, in `specs/done/`.
    Record,
    /// A guide, a markdown file at any depth of `specs/ui/` or `specs/guides/`: free form, only its
    /// links checked.
    Guide,
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
    /// A commit whose tree links resolve against, in place of the files under `root`.
    pub tip: Option<(&'a Git, ObjectId)>,
    /// Where a missing file went, from the history of `tip`, else of `HEAD`.
    pub finder: &'a Finder<'a>,
}

impl File<'_> {
    pub fn problem(&self, line: Option<usize>, rule: &str, message: impl Into<String>) -> Problem {
        Problem {
            file: self.path.clone(),
            line,
            rule: rule.to_string(),
            message: message.into(),
            severity: Severity::Error,
            fixable: false,
        }
    }

    /// A problem that does not fail the check.
    pub fn warning(&self, line: Option<usize>, rule: &str, message: impl Into<String>) -> Problem {
        Problem {
            severity: Severity::Warning,
            ..self.problem(line, rule, message)
        }
    }
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned()
}

/// Checks a `specs/` folder, any folder under it, or one file, against the skill's rules, the
/// branch's history included: `decision.unapproved` walks it. `ura check` shows its warnings.
pub fn check(root: &Path, target: &Path) -> Result<Vec<Problem>, CheckError> {
    check_with(root, target, true)
}

fn check_with(root: &Path, target: &Path, history: bool) -> Result<Vec<Problem>, CheckError> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let finder = Finder::new(&root, None);
    check_in(&root, target, history, &finder)
}

/// `check_with` on a canonical `root`, asking `finder` where each missing file went.
fn check_in(
    root: &Path,
    target: &Path,
    history: bool,
    finder: &Finder<'_>,
) -> Result<Vec<Problem>, CheckError> {
    let target = fs::canonicalize(target).map_err(|_| CheckError::Missing(target.into()))?;
    let mut problems = Vec::new();
    if target.is_file() {
        let dir = target.parent().unwrap_or(root);
        let name = target.file_name().unwrap_or_default().to_string_lossy();
        let mut found = check_folder_files(root, dir, true, finder, &mut problems);
        problems.extend(found.remove(name.as_ref()).unwrap_or_default());
        names::check_change_file(root, &target, &mut problems);
        // A decision's file is reported as in its `specs/` folder's check, for its own warning.
        if history && let Some(specs) = decisions_parent(&target) {
            unapproved::check_unapproved(root, &specs, &mut problems);
        }
        problems.retain(|p| p.file == relative(root, &target));
    } else {
        walk(root, &target, finder, &mut problems);
        if history {
            unapproved::check_unapproved(root, &target, &mut problems);
        }
    }
    problems.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(problems)
}

/// The `specs/` folder holding the `decisions/` folder that holds a file.
fn decisions_parent(file: &Path) -> Option<PathBuf> {
    let decisions = file.parent()?;
    (decisions.file_name()? == "decisions")
        .then(|| decisions.parent().map(Path::to_path_buf))
        .flatten()
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

/// Checks every folder under `dir`. A change's folder is checked as a whole, so the problems of
/// `names::check_change_file`, which checks one file of it, are reported once.
fn walk(root: &Path, dir: &Path, finder: &Finder<'_>, problems: &mut Vec<Problem>) {
    names::check_folder_names(root, dir, problems);
    names::check_removed(root, dir, problems);
    names::check_change_files(root, dir, problems);
    let found = check_folder_files(root, dir, false, finder, problems);
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
        walk(root, &subfolder, finder, problems);
    }
}

/// The folders of `specs/` that hold guides, free form, at any depth.
const GUIDE_FOLDERS: [&str; 2] = ["ui", "guides"];

/// Whether a folder is a guides' folder of `specs/`, or one under it.
fn in_guides(dir: &Path) -> bool {
    dir.ancestors().any(|folder| {
        folder
            .file_name()
            .is_some_and(|name| GUIDE_FOLDERS.iter().any(|guides| name == *guides))
            && folder
                .parent()
                .and_then(Path::file_name)
                .is_some_and(|name| name == "specs")
    })
}

/// What kind of file a name is, in a folder: decisions in `decisions/`, records in `specs/done/`,
/// and guides in `specs/ui/` and `specs/guides/`.
fn kind_of(dir: &Path, name: &str, any_folder: bool) -> Option<Checked> {
    if name.ends_with(".md") && in_guides(dir) {
        return Some(Checked::Guide);
    }
    let parent = dir.file_name().map(|n| n.to_string_lossy().into_owned());
    if parent.as_deref() == Some("decisions") && name == "preview.md" {
        return Some(Checked::PreviewDecision);
    }
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
    if !any_folder && !names::is_workflow_folder(dir) {
        return None;
    }
    // `layout.removed` reports a review's findings file, never written any more.
    if name.starts_with("findings-") {
        return None;
    }
    FileKind::of(name).map(|(kind, _)| Checked::Workflow(kind))
}

/// Checks the workflow files directly inside a folder, and returns the problems by file name.
fn check_folder_files(
    root: &Path,
    dir: &Path,
    any_folder: bool,
    finder: &Finder<'_>,
    problems: &mut Vec<Problem>,
) -> BTreeMap<String, Vec<Problem>> {
    check_folder_files_with(root, dir, any_folder, None, finder, problems)
}

/// Like `check_folder_files`, with one file's text, by name, in place of its file on disk.
fn check_folder_files_with(
    root: &Path,
    dir: &Path,
    any_folder: bool,
    replaced: Option<(&str, &str)>,
    finder: &Finder<'_>,
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
                    severity: Severity::Error,
                    fixable: false,
                });
            }
        }
    }
    check_texts(root, dir, any_folder, &texts, finder, &mut found);
    found
}

fn check_texts(
    root: &Path,
    dir: &Path,
    any_folder: bool,
    texts: &BTreeMap<String, String>,
    finder: &Finder<'_>,
    found: &mut BTreeMap<String, Vec<Problem>>,
) {
    for (name, text) in texts {
        let Some(kind) = kind_of(dir, name, any_folder) else {
            continue;
        };
        let file = File {
            path: relative(root, &dir.join(name)),
            text,
            kind,
            folder: texts,
            root,
            tip: finder.tip,
            finder,
        };
        found
            .entry(name.clone())
            .or_default()
            .extend(check_file(&file));
    }
}

/// A plan's task with no checkbox step: nothing tracks it, so it could never read as done.
fn check_task_steps(file: &File<'_>, problems: &mut Vec<Problem>) {
    let doc = crate::files::document::parse(file.text, "");
    for task in crate::files::items::tasks(&doc) {
        if task.total == 0 {
            let line = doc.blocks[task.heading_block as usize].start_line as usize;
            problems.push(file.problem(
                Some(line),
                "plan.steps",
                format!(
                    "Task {} has no step: write its steps as checkboxes, \"- [ ]\"",
                    task.number
                ),
            ));
        }
    }
}

fn check_file(file: &File<'_>) -> Vec<Problem> {
    let mut problems = Vec::new();
    let front = values::check_frontmatter(file, &mut problems);
    let document = markdown::Document::parse(file.text);
    match file.kind {
        Checked::Workflow(FileKind::Review) => reviews::check_review(file, &mut problems),
        _ => sections::check_sections(file, &document, &mut problems),
    }
    match file.kind {
        Checked::Workflow(FileKind::Spec) => {
            let waiting = front
                .as_ref()
                .is_some_and(|front| front.text("status") == Some("awaiting-human"));
            spec::check_spec(file, waiting, &mut problems);
        }
        Checked::Decision | Checked::PreviewDecision => {
            decision::check_decision(file, &mut problems);
        }
        Checked::Workflow(FileKind::Plan) => check_task_steps(file, &mut problems),
        _ => {}
    }
    if file.kind == Checked::Record {
        record::check_record(file, &document, &mut problems);
    }
    if let Checked::Workflow(FileKind::Clarifications) = file.kind {
        answers::check_answers(file, front.as_ref(), &mut problems);
    }
    // A round's document tree, parsed once for the checks that read it.
    let tree = (file.kind == Checked::Workflow(FileKind::Clarifications))
        .then(|| crate::files::document::parse(file.text, ""));
    if let Some(tree) = tree.as_ref() {
        sections::check_settled_subjects(file, tree, &mut problems);
    }
    if let Some(front) = &front {
        let waiting = front.text("status") == Some("awaiting-human");
        if let Some(tree) = tree.as_ref().filter(|_| waiting) {
            writing::check_writing(file, tree, &mut problems);
        }
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

/// The frontmatter of a file, when it parses.
pub(crate) fn parse_frontmatter(text: &str) -> Option<frontmatter::Frontmatter> {
    frontmatter::parse(text).ok()
}
