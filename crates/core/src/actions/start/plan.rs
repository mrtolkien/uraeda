//! The plan of a start: every check, and everything it writes, settled before anything is
//! written.

use std::fs;
use std::path::{Path, PathBuf};

use crate::actions::expand::listed;
use crate::actions::place;
use crate::check::change_holds;
use crate::files::lines;
use crate::files::markdown::Document;
use crate::files::priorities::{self, Proposal, Section};
use crate::git::{Git, GitError};
use crate::target::proposal_name;
use crate::today::Date;
use crate::workspace::{Kind, Workspace, folder_branch, folder_path, resolve};

use super::typed::Typed;
use super::{Source, Start, StartError};

/// A slug as `ura expand` makes them: lowercase letters, digits, and hyphens.
fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && !slug.starts_with('-')
        && slug
            .chars()
            .all(|c| (c.is_alphanumeric() && !c.is_uppercase()) || c == '-')
}

/// The files of a proposal file: the file itself, or every file of a postponed folder, from the top
/// level.
fn proposal_files(root: &Path, proposal: &str) -> Result<Vec<String>, StartError> {
    let path = root.join(proposal);
    if path.is_file() {
        return Ok(vec![proposal.to_string()]);
    }
    let mut files = Vec::new();
    let mut stack = vec![path.clone()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)?.flatten() {
            if entry.file_type().is_ok_and(|t| t.is_dir()) {
                stack.push(entry.path());
            } else if let Ok(relative) = entry.path().strip_prefix(root) {
                files.push(relative.to_string_lossy().into_owned());
            }
        }
    }
    files.sort();
    if files.is_empty() {
        return Err(StartError::Refused(format!(
            "{proposal}: no such proposal file"
        )));
    }
    Ok(files)
}

/// A proposal file, read: its file or postponed folder, its files, its proposal, and the
/// proposal's text.
struct Proposed<'a> {
    proposal: &'a str,
    postponed: bool,
    files: Vec<String>,
    /// The proposal's path: the file itself, or the postponed folder's `proposal.md`.
    proposal_source: String,
    text: String,
}

impl<'a> Proposed<'a> {
    fn read(root: &Path, proposal: &'a str) -> Result<Proposed<'a>, StartError> {
        let postponed = root.join(proposal).is_dir();
        let proposal_source = if postponed {
            format!("{proposal}/proposal.md")
        } else {
            proposal.to_string()
        };
        let files = proposal_files(root, proposal)?;
        let text = fs::read_to_string(root.join(&proposal_source)).map_err(|_| {
            StartError::Refused(format!("{proposal_source}: no such proposal file"))
        })?;
        Ok(Proposed {
            proposal,
            postponed,
            files,
            proposal_source,
            text,
        })
    }

    /// Refuses a postponed folder holding files a change's folder has no place for, like a
    /// feature's `spec.md`, which `ura check` would report once the folder is a change's.
    fn check_change(&self) -> Result<(), StartError> {
        let prefix = format!("{}/", self.proposal);
        let mut misplaced: Vec<String> = Vec::new();
        for file in &self.files {
            let Some(inside) = file.strip_prefix(&prefix) else {
                continue;
            };
            let (entry, is_dir) = match inside.split_once('/') {
                Some((folder, _)) => (folder, true),
                None => (inside, false),
            };
            let shown = if is_dir {
                format!("{entry}/")
            } else {
                entry.to_string()
            };
            if !entry.starts_with('.')
                && !change_holds(entry, is_dir)
                && !misplaced.contains(&shown)
            {
                misplaced.push(shown);
            }
        }
        misplaced.sort();
        let (verb, list) = match misplaced.as_slice() {
            [] => return Ok(()),
            [one] => ("has", one.clone()),
            [first, second] => ("have", format!("{first} and {second}")),
            [rest @ .., last] => ("have", format!("{}, and {last}", rest.join(", "))),
        };
        Err(StartError::Refused(format!(
            "{} holds {list}, which {verb} no place in a change: start it as a feature, without \
             --change",
            self.proposal
        )))
    }
}

/// What a start starts from, read: a proposal file, or a typed change, its number of images, and
/// the text of the line of **Now** it starts from, if any.
enum Origin<'a> {
    Proposal(Proposed<'a>),
    Text(&'a Typed, usize, Option<&'a str>),
}

/// Everything a start writes, settled before anything is written.
pub(super) struct Plan {
    /// Whether the proposal file is a postponed folder rather than a file.
    pub(super) postponed: bool,
    /// The proposal file or postponed folder, for a start from a proposal file.
    pub(super) proposal: Option<String>,
    pub(super) files: Vec<String>,
    /// The proposal file's files that are committed.
    pub(super) tracked: Vec<String>,
    /// The dated folder.
    pub(super) folder: String,
    /// The folder for a feature, `change/<folder>` for a change.
    pub(super) branch: String,
    pub(super) slug: String,
    /// The feature's or the change's name, its line in the priorities.
    pub(super) name: String,
    /// Where the branch's worktree goes, unless `switch`.
    pub(super) worktree: PathBuf,
    /// `PRIORITIES.md` with the proposal moved to **Now**.
    pub(super) priorities: String,
    /// `PRIORITIES.md` as it was read, `None` when there was none: what a refused commit puts
    /// back.
    pub(super) priorities_before: Option<String>,
    /// The lines nested under the proposal in `PRIORITIES.md`, which its move to **Now** takes
    /// out: the proposal file takes them.
    pub(super) nested: Vec<String>,
    pub(super) start_subject: String,
    /// `specs/<folder>`, or `specs/changes/<folder>` for a change.
    pub(super) destination: String,
    /// What puts the proposal in `destination`, as the step left to do by hand.
    pub(super) write_left: String,
}

impl Plan {
    /// The start commit, as the step left to do by hand: with the proposal file's removal, when it
    /// was committed.
    pub(super) fn commit_left(&self, default: &str) -> String {
        let removal = match &self.proposal {
            Some(proposal) if !self.tracked.is_empty() => format!(", the removal of {proposal},"),
            _ => String::new(),
        };
        format!(
            "commit specs/PRIORITIES.md{removal} and {}/ on {default} as \"{}\"",
            self.destination, self.start_subject
        )
    }

    /// The branch, as the step left to do by hand.
    pub(super) fn branch_left(&self, switch: bool) -> String {
        if switch {
            format!("create the branch {}", self.branch)
        } else {
            format!(
                "create the branch {} in .worktrees/{}",
                self.branch, self.folder
            )
        }
    }
}

impl Start<'_> {
    /// Every check, before anything is written. The working tree's other changes, uncommitted or
    /// staged, are not checked: the start commits its own files alone, and leaves them as they are.
    pub(super) fn plan(&self, slug: Option<&str>, today: Date) -> Result<Plan, StartError> {
        // The start commits its files alone, which these refuse, or which would end them.
        if let Some(operation) = self.at.operation_in_progress() {
            return Err(StartError::Refused(format!(
                "cannot start: {operation} is in progress on {}: finish or abort it first",
                self.default
            )));
        }
        let origin = match self.source {
            Source::Proposal(proposal) => Origin::Proposal(Proposed::read(self.root, proposal)?),
            Source::Text {
                typed,
                images,
                line,
            } => Origin::Text(typed, images.len(), line),
        };
        if let Origin::Proposal(proposed) = &origin
            && self.kind == Kind::Change
        {
            proposed.check_change()?;
        }
        let slug = slug.map_or_else(
            || match &origin {
                Origin::Proposal(proposed) => crate::slug::short(proposal_name(proposed.proposal)),
                Origin::Text(typed, ..) => typed.proposed_slug(),
            },
            str::to_string,
        );
        let (folder, worktree) = self.claim(&slug, today)?;
        let files = match &origin {
            Origin::Proposal(proposed) => proposed.files.clone(),
            Origin::Text(..) => Vec::new(),
        };
        // Which of the proposal file's files are committed, read before any write of ours.
        let tracked = self.tracked(&files);
        let destination = folder_path(self.kind, &folder);
        let target = format!("/{destination}/proposal.md");
        // Only a missing file is no priorities: one the start cannot read refuses it.
        let priorities_before = match fs::read_to_string(self.root.join("specs/PRIORITIES.md")) {
            Ok(text) => Some(text),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => {
                return Err(StartError::Refused(format!(
                    "cannot read specs/PRIORITIES.md: {error}"
                )));
            }
        };
        let priorities_text = priorities_before.clone().unwrap_or_default();
        let (name, priorities, nested, write_left) = match &origin {
            Origin::Proposal(proposed) => {
                let (name, priorities, nested) =
                    moved_proposal(&priorities_text, proposed, &slug, &target)?;
                let write_left = format!("move {} to {destination}", proposed.proposal);
                (name, priorities, nested, write_left)
            }
            Origin::Text(typed, images, line) => {
                let name = typed.title.clone();
                let (priorities, nested) = started_line(&priorities_text, typed, *line, &target);
                let write_left = typed_write_left(&destination, *images);
                (name, priorities, nested, write_left)
            }
        };
        let postponed = matches!(&origin, Origin::Proposal(proposed) if proposed.postponed);
        Ok(Plan {
            postponed,
            proposal: match &origin {
                Origin::Proposal(proposed) => Some(proposed.proposal.to_string()),
                Origin::Text(..) => None,
            },
            files,
            tracked,
            start_subject: format!("chore({slug}): start {name}"),
            name,
            slug,
            write_left,
            destination,
            branch: folder_branch(self.kind, &folder),
            folder,
            worktree,
            priorities,
            priorities_before,
            nested,
        })
    }

    /// The dated folder for a slug, and where its worktree goes: refused as taken when the folder
    /// is, or when its worktree's folder exists.
    fn claim(&self, slug: &str, today: Date) -> Result<(String, PathBuf), StartError> {
        let folder = self.free_folder(slug, today)?;
        let worktree = place::worktree_path(self.git, &folder);
        if !self.run.switch && worktree.exists() {
            return Err(StartError::Taken {
                slug: slug.to_string(),
                kind: self.kind,
                message: GitError::WorktreeExists(format!(".worktrees/{folder}")).to_string(),
            });
        }
        Ok((folder, worktree))
    }

    /// The dated folder for a slug, refused when the slug is not one, or when a record, a branch,
    /// or a folder already holds the name, as a feature's or as a change's.
    fn free_folder(&self, slug: &str, today: Date) -> Result<String, StartError> {
        if !valid_slug(slug) {
            return Err(StartError::Refused(format!(
                "\"{slug}\" is not a slug: lowercase letters, digits, and hyphens; choose one with --slug"
            )));
        }
        let folder = format!("{today}-{slug}");
        let kinds = [Kind::Feature, Kind::Change];
        let hint = "choose another slug with --slug";
        check_free(self.root, &self.at, self.workspace, &folder, &kinds, hint).map_err(
            |error| match error {
                StartError::Refused(message) => StartError::Taken {
                    slug: slug.to_string(),
                    kind: self.kind,
                    message,
                },
                error => error,
            },
        )?;
        Ok(folder)
    }

    /// The files committed at `HEAD`, among `files`.
    fn tracked(&self, files: &[String]) -> Vec<String> {
        let head = self.at.head();
        files
            .iter()
            .filter(|file| {
                head.is_some_and(|head| self.at.read_file(head, file).ok().flatten().is_some())
            })
            .cloned()
            .collect()
    }
}

/// Refuses a dated folder that a record, a branch, or a folder already holds, as one of `kinds`,
/// from the default branch's working tree at `root`, saying `hint` to get out of it.
pub(crate) fn check_free(
    root: &Path,
    at: &Git,
    workspace: &Workspace,
    folder: &str,
    kinds: &[Kind],
    hint: &str,
) -> Result<(), StartError> {
    let features = &workspace.features;
    let record = crate::workspace::record_path(folder);
    let recorded = root.join(&record).exists()
        || features
            .iter()
            .any(|feature| feature.folder == folder && feature.is_finished());
    if recorded {
        return Err(StartError::Refused(format!("{record} exists: {hint}")));
    }
    let branches = at.branches()?;
    let taken = kinds.iter().any(|&kind| {
        let branch_name = folder_branch(kind, folder);
        branches.iter().any(|branch| branch.name == branch_name)
            || root.join(folder_path(kind, folder)).exists()
    }) || features
        .iter()
        .any(|feature| feature.folder == folder && kinds.contains(&feature.kind));
    if taken {
        return Err(StartError::Refused(format!("{folder} exists: {hint}")));
    }
    Ok(())
}

/// What puts a typed change's proposal, and its images, in `destination`, as the step left to do
/// by hand.
fn typed_write_left(destination: &str, images: usize) -> String {
    let proposal = format!("write {destination}/proposal.md from the text");
    if images == 0 {
        proposal
    } else {
        format!("{proposal}, and its images in {destination}/images/")
    }
}

/// `PRIORITIES.md` with a typed change's link to `target` on top of **Now**, in place of the line
/// of **Now** it starts from, `line`, its plain text, when **Now** holds it once, without a link,
/// the spaces of both collapsed: a line changed since it was read stays. Then the lines nested
/// under the line, which the change's proposal takes, but those the typed text holds already.
fn started_line(
    priorities_text: &str,
    typed: &Typed,
    line: Option<&str>,
    target: &str,
) -> (String, Vec<String>) {
    let name = &typed.title;
    let found: Vec<Proposal> = line.map_or_else(Vec::new, |line| {
        let line = lines::one_line(line);
        priorities::parse(priorities_text)
            .into_iter()
            .filter(|p| p.section == Section::Now && p.link.is_none())
            .filter(|p| lines::one_line(&p.text) == line)
            .collect()
    });
    let moved = match found.as_slice() {
        [found] => priorities::move_to_started(priorities_text, found.line, name, target)
            .map(|edited| (edited, found.nested(priorities_text))),
        _ => None,
    };
    let Some((edited, mut nested)) = moved else {
        return (
            priorities::add_started(priorities_text, name, target),
            Vec::new(),
        );
    };
    nested.retain(|line| !typed.holds(line));
    (edited, nested)
}

/// The feature's name, `PRIORITIES.md` with its proposal moved to the top of **Now** as a link
/// to `target`, or added there when no proposal links the proposal file, and the lines nested
/// under the proposal, which the move takes out.
fn moved_proposal(
    priorities_text: &str,
    proposed: &Proposed<'_>,
    slug: &str,
    target: &str,
) -> Result<(String, String, Vec<String>), StartError> {
    let Proposed {
        proposal,
        proposal_source,
        text,
        ..
    } = proposed;
    let linking: Vec<Proposal> = priorities::parse(priorities_text)
        .into_iter()
        .filter(|line| {
            line.link
                .as_deref()
                .and_then(|link| resolve("specs", link))
                .is_some_and(|path| path == *proposal || path == *proposal_source)
        })
        .collect();
    match linking.as_slice() {
        [] => {
            let name = Document::parse(text)
                .headings
                .into_iter()
                .find(|h| h.level == 1)
                .map_or_else(|| slug.to_string(), |h| h.text);
            let edited = priorities::add_started(priorities_text, &name, target);
            Ok((name, edited, Vec::new()))
        }
        [line] => {
            let edited =
                priorities::move_to_started(priorities_text, line.line, &line.text, target)
                    .ok_or_else(|| StartError::Refused("cannot move the proposal".into()))?;
            Ok((line.text.clone(), edited, line.nested(priorities_text)))
        }
        several => {
            let lines: Vec<&Proposal> = several.iter().collect();
            Err(StartError::Refused(format!(
                "{} proposals link {proposal}:{}",
                several.len(),
                listed(&lines)
            )))
        }
    }
}
