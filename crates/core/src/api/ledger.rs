//! The constitution and the decisions, as the default branch has them: from its checkout when one
//! has it, so an edit shows before it is committed, else from its tip. Each decision comes with the
//! date of the last commit touching it, and the first problem `ura check` finds in it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::{Result, default_checkout};
use crate::check;
use crate::decisions::{PartChange, compare};
use crate::files::document::{self, BlockKind, Document, hash};
use crate::files::frontmatter;
use crate::git::{Git, ObjectId};
use crate::view::ProblemView;
use crate::workspace::Problem;

const CONSTITUTION: &str = "specs/CONSTITUTION.md";
const DECISIONS: &str = "specs/decisions";

/// The constitution and the decisions: `None` without `specs/CONSTITUTION.md`, and no decision
/// without `specs/decisions/`.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ledger {
    pub constitution: Option<Constitution>,
    /// By file name.
    pub decisions: Vec<Decision>,
    /// Every problem `ura check` finds in the decisions.
    pub problems: Vec<ProblemView>,
}

/// `specs/CONSTITUTION.md`: its title, its version line's fields when it has them, and its
/// principles, the `### <number>. <title>` headings.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Constitution {
    pub title: String,
    /// From `**Version**: 1.3.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-14`.
    pub version: Option<String>,
    pub ratified: Option<String>,
    pub amended: Option<String>,
    pub principles: Vec<Principle>,
    pub document: Document,
}

/// A principle of the constitution.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Principle {
    /// Its Roman numeral, like `IV`.
    pub number: String,
    /// Its numeral in lower case, like `iv`, for its address.
    pub slug: String,
    pub title: String,
    /// The ids of its heading and of the top-level blocks under it, up to the next heading of its
    /// level or above, in the constitution's document.
    pub blocks: Vec<u32>,
}

/// A decision of `specs/decisions/`.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Decision {
    /// Its file name without `.md`, like `ui-behaviour`.
    pub name: String,
    /// Its H1, else, or when it is unreadable, its name.
    pub title: String,
    /// Its frontmatter's fields, when they are text.
    pub status: Option<String>,
    pub approved_by: Option<String>,
    /// A Lucide icon name, like `git-branch`.
    pub icon: Option<String>,
    /// The first sentence of its first paragraph, when one comes before its first section.
    pub summary: Option<String>,
    /// The date of the last commit of the default branch touching it, `YYYY-MM-DD`.
    pub changed: Option<String>,
    pub document: Document,
    /// The kept parts of its `## Rules` section, each with its strength and its check; empty for
    /// an unreadable file or one without the section.
    pub rules: Vec<PartChange>,
    /// The first problem `ura check` finds in it.
    pub problem: Option<String>,
    /// Whether it cannot be parsed, like a frontmatter that is not valid YAML: its title is then its
    /// name, and nothing else read from it stands.
    pub unreadable: bool,
}

/// The texts of the constitution and of the decisions, by file name, and where they were read.
struct Texts {
    constitution: Option<String>,
    decisions: BTreeMap<String, String>,
}

fn lossy(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

fn disk_texts(root: &Path) -> Texts {
    let decisions = std::fs::read_dir(root.join(DECISIONS))
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let text = lossy(std::fs::read(entry.path()).ok()?);
            name.ends_with(".md").then_some((name, text))
        })
        .collect();
    Texts {
        constitution: std::fs::read(root.join(CONSTITUTION)).ok().map(lossy),
        decisions,
    }
}

fn tip_texts(git: &Git, tip: ObjectId) -> Texts {
    let read = |path: &str| git.read_file(tip, path).ok().flatten().map(lossy);
    let decisions = git
        .list_files(tip, DECISIONS)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|path| {
            let name = path.strip_prefix(&format!("{DECISIONS}/"))?;
            let markdown = name.ends_with(".md") && !name.contains('/');
            markdown.then(|| Some((name.to_string(), read(&path)?)))?
        })
        .collect();
    Texts {
        constitution: read(CONSTITUTION),
        decisions,
    }
}

/// The checkout the default branch's files are read from: the default branch's, or this one when
/// there is no default branch.
fn checkout_of(git: &Git, default: Option<&str>) -> Option<PathBuf> {
    match default {
        Some(default) => default_checkout(git, default),
        None => Some(git.root().to_path_buf()),
    }
}

/// Where the default branch's files are read: its checkout, this one when there is no default
/// branch, else its tip. With the folder `ura check` resolves links from, and the tip whose tree
/// it resolves them against instead when no checkout has the default branch.
fn source(git: &Git, default: Option<&str>) -> (Texts, PathBuf, Option<ObjectId>) {
    let checkout = checkout_of(git, default);
    match (checkout, default.and_then(|default| git.tip(default))) {
        (Some(root), _) => (disk_texts(&root), root, None),
        (None, Some(tip)) => (tip_texts(git, tip), git.root().to_path_buf(), Some(tip)),
        (None, None) => (
            Texts {
                constitution: None,
                decisions: BTreeMap::new(),
            },
            git.root().to_path_buf(),
            None,
        ),
    }
}

/// A file's size and modification time, as the watch sees it change without reading it.
fn stamp(path: &Path) -> Option<(u64, std::time::SystemTime)> {
    let meta = std::fs::metadata(path).ok()?;
    Some((meta.len(), meta.modified().ok()?))
}

/// The files of the constitution and the decisions under `root`, by name, as the watch sees them
/// change.
fn disk_stamps(root: &Path) -> Vec<(String, Option<(u64, std::time::SystemTime)>)> {
    let mut stamps: Vec<_> = std::fs::read_dir(root.join(DECISIONS))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            Some((name, stamp(&entry.path())))
        })
        .collect();
    stamps.push((CONSTITUTION.to_string(), stamp(&root.join(CONSTITUTION))));
    stamps.sort();
    stamps
}

/// What the ledger is read from, by hash, for the watch, without reading the files: the checkout's
/// files by size and modification time, and the default branch's tip by the ids of its decisions
/// folder and constitution, which change with its commits and so with the decisions' dates.
pub(crate) fn ledger_hash(git: &Git) -> String {
    let default = git.default_branch();
    let on_disk = checkout_of(git, default.as_deref()).map(|root| disk_stamps(&root));
    let committed = default
        .as_deref()
        .and_then(|default| git.tip(default))
        .map(|tip| {
            (
                git.entry_id(tip, DECISIONS),
                git.entry_id(tip, CONSTITUTION),
            )
        });
    hash(&format!("{on_disk:?}{committed:?}"))
}

/// The constitution and the decisions of the default branch.
pub fn read_ledger(repo: &Path) -> Result<Ledger> {
    let git = Git::discover(repo)?;
    let default = git.default_branch();
    let (texts, root, tip) = source(&git, default.as_deref());
    let mut found = check::check_folder_texts(
        &root,
        &root.join(DECISIONS),
        &texts.decisions,
        tip.map(|tip| (&git, tip)),
    );
    for problems in found.values_mut() {
        problems.sort_by_key(|problem| problem.line);
    }
    let dates = default
        .as_deref()
        .and_then(|default| git.last_changes(default, DECISIONS).ok())
        .unwrap_or_default();
    let decisions = texts
        .decisions
        .iter()
        .map(|(file, text)| {
            let problems = found.get(file).map(Vec::as_slice).unwrap_or_default();
            let date = dates.get(&format!("{DECISIONS}/{file}")).cloned();
            decision(file, text, date, problems)
        })
        .collect();
    let mut problems: Vec<&Problem> = found.values().flatten().collect();
    problems.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(Ledger {
        constitution: texts.constitution.as_deref().map(constitution),
        decisions,
        problems: problems.into_iter().map(ProblemView::from).collect(),
    })
}

/// The first heading of a level, as text.
fn heading(document: &Document, level: u32) -> Option<String> {
    document
        .blocks
        .iter()
        .find(|block| block.kind == BlockKind::Heading && block.level == Some(level))
        .map(|block| document.text(block.id))
        .filter(|text| !text.is_empty())
}

/// A text up to the end of its first sentence: a `.`, `!`, or `?` before a space or the end.
fn first_sentence(text: &str) -> &str {
    let mut chars = text.char_indices().peekable();
    while let Some((index, char)) = chars.next() {
        let ends = chars.peek().is_none_or(|(_, next)| next.is_whitespace());
        if matches!(char, '.' | '!' | '?') && ends {
            return &text[..index + char.len_utf8()];
        }
    }
    text
}

/// The parts of the `## Rules` section, as the spec page's comparison reads them: the decision
/// compared with itself, so every part is kept.
fn rules_of(name: &str, text: &str) -> Vec<PartChange> {
    compare(name, Some(text), Some(text))
        .sections
        .into_iter()
        .find(|section| section.title == "Rules")
        .map(|section| section.parts)
        .unwrap_or_default()
}

fn decision(file: &str, text: &str, changed: Option<String>, problems: &[Problem]) -> Decision {
    let name = file.strip_suffix(".md").unwrap_or(file).to_string();
    let document = document::parse(text, DECISIONS);
    let front = frontmatter::parse(text);
    // A file without frontmatter is read as markdown; one whose frontmatter breaks is not read.
    let unreadable = matches!(
        front,
        Err(frontmatter::FrontmatterError::Unclosed | frontmatter::FrontmatterError::Yaml(_))
    );
    let front = front.ok();
    let field = |key: &str| {
        front
            .as_ref()
            .and_then(|front| front.text(key))
            .map(str::to_string)
    };
    let summary = document
        .blocks
        .iter()
        .filter(|block| block.parent.is_none())
        .take_while(|block| block.kind != BlockKind::Heading || block.level == Some(1))
        .find(|block| block.kind == BlockKind::Paragraph)
        .map(|block| first_sentence(&document.text(block.id)).to_string());
    let rules = if unreadable {
        Vec::new()
    } else {
        rules_of(&name, text)
    };
    Decision {
        title: heading(&document, 1)
            .filter(|_| !unreadable)
            .unwrap_or_else(|| name.clone()),
        status: field("status"),
        approved_by: field("approved-by"),
        icon: field("icon"),
        summary,
        changed,
        problem: problems.first().map(|problem| problem.message.clone()),
        unreadable,
        rules,
        name,
        document,
    }
}

/// A principle's number and title, from a heading like `IV. Review effort matches impact`.
fn principle_heading(text: &str) -> Option<(&str, &str)> {
    let (number, title) = text.split_once(". ")?;
    let roman = !number.is_empty() && number.chars().all(|c| "IVXLCDM".contains(c));
    roman.then_some((number, title))
}

fn principles(document: &Document) -> Vec<Principle> {
    let mut principles: Vec<Principle> = Vec::new();
    let mut open = false;
    for block in document
        .blocks
        .iter()
        .filter(|block| block.parent.is_none())
    {
        let level = (block.kind == BlockKind::Heading)
            .then_some(block.level)
            .flatten();
        if let Some(level) = level.filter(|level| *level <= 3) {
            let text = document.text(block.id);
            let found = principle_heading(&text).filter(|_| level == 3);
            open = found.is_some();
            if let Some((number, title)) = found {
                principles.push(Principle {
                    number: number.to_string(),
                    slug: number.to_lowercase(),
                    title: title.to_string(),
                    blocks: Vec::new(),
                });
            }
        }
        if let Some(principle) = principles.last_mut().filter(|_| open) {
            principle.blocks.push(block.id);
        }
    }
    principles
}

fn constitution(text: &str) -> Constitution {
    let document = document::parse(text, "specs");
    // The version line: `Version: 1.3.1 | Ratified: … | Last Amended: …`, its marks taken off.
    let fields: BTreeMap<String, String> = document
        .blocks
        .iter()
        .filter(|block| block.kind == BlockKind::Paragraph)
        .map(|block| document.text(block.id))
        .find(|line| line.starts_with("Version:"))
        .map(|line| {
            line.split('|')
                .filter_map(|field| {
                    let (key, value) = field.split_once(':')?;
                    Some((key.trim().to_string(), value.trim().to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    Constitution {
        title: heading(&document, 1).unwrap_or_else(|| "Constitution".to_string()),
        version: fields.get("Version").cloned(),
        ratified: fields.get("Ratified").cloned(),
        amended: fields.get("Last Amended").cloned(),
        principles: principles(&document),
        document,
    }
}
