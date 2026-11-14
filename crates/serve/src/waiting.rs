//! What waits on the human: the latest round of questions, the spec, and the plan whose status is
//! `awaiting-human`, in the checked-out worktrees of every served repository. It reads files with
//! gix and never runs git.

use std::path::{Path, PathBuf};

use uraeda_core::git::Git;
use uraeda_core::workspace::{Feature, FileKind, Kind, Workspace};

use crate::config::Settings;
use crate::html::escape;

/// What a human is asked for.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ask {
    /// Questions to answer, round `N`.
    Round(u32),
    Spec,
    Plan,
}

impl Ask {
    /// In plain words, as the home page says it.
    pub fn words(self) -> String {
        match self {
            Ask::Round(n) => format!("Questions, round {n}"),
            Ask::Spec => "Spec to review".into(),
            Ask::Plan => "Plan to review".into(),
        }
    }
}

/// One thing that waits.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Item {
    /// `2026-10-10-recurring-tasks`.
    pub folder: String,
    /// `recurring-tasks`.
    pub slug: String,
    pub kind: Kind,
    /// The absolute path of the worktree the feature is checked out in.
    pub worktree: PathBuf,
    /// The file's name, `clarifications-01.md`.
    pub file: String,
    pub ask: Ask,
    /// What is asked, the first line of the file's `> [!IMPORTANT]` block.
    pub waiting_line: Option<String>,
    /// The page's address from the token's folder: `{repo}/{folder}/round`, or
    /// `{repo}/{folder}/review/spec.md`.
    pub address: String,
}

/// What waits in one repository.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Repository {
    /// The main checkout's folder name, made unique and safe for an address.
    pub name: String,
    pub path: PathBuf,
    pub items: Vec<Item>,
    /// Why this repository could not be read, in one line.
    pub problem: Option<String>,
}

/// What waits, across the settings' repositories, in their order.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Waiting {
    pub repositories: Vec<Repository>,
}

impl Waiting {
    pub fn is_empty(&self) -> bool {
        self.repositories.iter().all(|r| r.items.is_empty())
    }
}

/// The repositories with their names: a folder's name, kept to letters, digits, `-`, `_`, and `.`,
/// and numbered when two share one.
pub fn repository_names(settings: &Settings) -> Vec<(String, PathBuf)> {
    let mut out: Vec<(String, PathBuf)> = Vec::new();
    for path in &settings.repositories {
        let base: String = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("repository")
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
                    c
                } else {
                    '-'
                }
            })
            .collect();
        let base = if base.is_empty() || base.starts_with('.') {
            "repository".to_string()
        } else {
            base
        };
        let mut name = base.clone();
        let mut n = 2;
        while out.iter().any(|(taken, _)| *taken == name) {
            name = format!("{base}-{n}");
            n += 1;
        }
        out.push((name, path.clone()));
    }
    out
}

/// What waits now. Blocks on disk: call it from a blocking thread.
pub fn read(settings: &Settings) -> Waiting {
    let repositories = repository_names(settings)
        .into_iter()
        .map(|(name, path)| match read_repository(&name, &path) {
            Ok(items) => Repository {
                name,
                path,
                items,
                problem: None,
            },
            Err(problem) => Repository {
                name,
                path,
                items: Vec::new(),
                problem: Some(problem),
            },
        })
        .collect();
    Waiting { repositories }
}

fn read_repository(name: &str, path: &Path) -> Result<Vec<Item>, String> {
    let git = Git::open(path).map_err(|e| e.to_string())?;
    let workspace = Workspace::read(&git).map_err(|e| e.to_string())?;
    let main = git.main_root();
    let mut items: Vec<Item> = workspace
        .features
        .iter()
        .flat_map(|feature| items_of(name, &main, feature))
        .collect();
    items.sort_by(|a, b| a.folder.cmp(&b.folder));
    Ok(items)
}

fn items_of(repo: &str, main: &Path, feature: &Feature) -> Vec<Item> {
    let Some(worktree) = feature.worktree.as_deref() else {
        return Vec::new();
    };
    let worktree = main.join(worktree);
    let latest_round = feature
        .files
        .iter()
        .filter(|f| f.kind == FileKind::Clarifications)
        .filter_map(|f| f.round)
        .max();
    let mut items = Vec::new();
    for file in &feature.files {
        if file.status.as_deref() != Some("awaiting-human") {
            continue;
        }
        let (ask, address) = match file.kind {
            FileKind::Clarifications => match file.round {
                Some(n) if Some(n) == latest_round => {
                    (Ask::Round(n), format!("{repo}/{}/round", feature.folder))
                }
                _ => continue,
            },
            FileKind::Spec => (
                Ask::Spec,
                format!("{repo}/{}/review/{}", feature.folder, file.name),
            ),
            FileKind::Plan => (
                Ask::Plan,
                format!("{repo}/{}/review/{}", feature.folder, file.name),
            ),
            _ => continue,
        };
        items.push(Item {
            folder: feature.folder.clone(),
            slug: feature.slug.clone(),
            kind: feature.kind,
            worktree: worktree.clone(),
            file: file.name.clone(),
            ask,
            waiting_line: file.waiting_line.clone(),
            address,
        });
    }
    items
}

/// A feature a page is about, read now.
#[derive(Clone, Debug)]
pub struct Located {
    /// The worktree the feature is checked out in, absolute: where its files are read and written.
    pub root: PathBuf,
    /// The repository's main checkout.
    pub main: PathBuf,
    pub feature: Feature,
}

#[derive(Debug, thiserror::Error)]
pub enum LocateError {
    /// No such repository, or no such feature checked out.
    #[error("not found")]
    NotFound,
    #[error("{0}")]
    Read(String),
}

/// The feature `folder` of the repository named `repo`, as checked out in a worktree. Blocks on
/// disk.
pub fn locate(settings: &Settings, repo: &str, folder: &str) -> Result<Located, LocateError> {
    let (_, path) = repository_names(settings)
        .into_iter()
        .find(|(name, _)| name == repo)
        .ok_or(LocateError::NotFound)?;
    if folder.is_empty() || folder.contains(['/', '\\']) || folder.starts_with('.') {
        return Err(LocateError::NotFound);
    }
    let git = Git::open(&path).map_err(|e| LocateError::Read(e.to_string()))?;
    let workspace =
        Workspace::read_folder(&git, folder).map_err(|e| LocateError::Read(e.to_string()))?;
    let main = git.main_root();
    let feature = workspace
        .features
        .into_iter()
        .find(|f| f.folder == folder && f.worktree.is_some())
        .ok_or(LocateError::NotFound)?;
    let root = main.join(feature.worktree.as_deref().unwrap_or("."));
    Ok(Located {
        root,
        main,
        feature,
    })
}

/// `recurring-tasks` as "Recurring tasks".
pub fn readable(slug: &str) -> String {
    let text = slug.replace(['-', '_'], " ");
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// The home page's body.
pub fn render(waiting: &Waiting) -> String {
    let mut out = String::from("<main><h1>What waits on you</h1>");
    if waiting.is_empty() && waiting.repositories.iter().all(|r| r.problem.is_none()) {
        out.push_str(
            "<p class=\"waiting-empty\">Nothing waits on you.</p>\
             <p class=\"muted\">New questions and specs to review appear here.</p>",
        );
    }
    // A repository with nothing waiting and nothing wrong takes no place on the page.
    let shown: Vec<&Repository> = waiting
        .repositories
        .iter()
        .filter(|r| !r.items.is_empty() || r.problem.is_some())
        .collect();
    let grouped = shown.len() > 1;
    for repository in shown {
        if grouped {
            out.push_str(&format!(
                "<section class=\"waiting-repo\"><h2>{}</h2>",
                escape(&repository.name)
            ));
        }
        if let Some(problem) = &repository.problem {
            out.push_str(&format!(
                "<p class=\"waiting-problem\">This repository could not be read: {}</p>",
                escape(problem)
            ));
        }
        if !repository.items.is_empty() {
            out.push_str("<ul class=\"waiting-list\">");
            for item in &repository.items {
                out.push_str(&card(item));
            }
            out.push_str("</ul>");
        }
        if grouped {
            out.push_str("</section>");
        }
    }
    out.push_str("</main>");
    out
}

fn card(item: &Item) -> String {
    let line = item
        .waiting_line
        .as_deref()
        .map(|l| format!("<span class=\"waiting-line\">{}</span>", escape(l)))
        .unwrap_or_default();
    format!(
        "<li><a class=\"waiting-card\" href=\"{}\">\
         <span class=\"waiting-name\">{}</span>\
         <span class=\"waiting-ask\">{}</span>{line}</a></li>",
        escape(&item.address),
        escape(&readable(&item.slug)),
        escape(&item.ask.words()),
    )
}
