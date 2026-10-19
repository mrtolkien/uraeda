//! `links.*`: links and images to markdown files and into `specs/` resolve to a file, and their
//! heading of it; wikilinks name a file of the `specs/` folder.

use std::fs;
use std::path::{Path, PathBuf};

use crate::files::markdown::Document;
use crate::workspace::{Problem, resolve};

use super::File;

/// The folder a link is relative to: the linking file's folder, from the root.
fn folder_of(path: &str) -> String {
    // A candidate's links resolve as if it sat in `specs/decisions/`, as the decision it replaces.
    if let Some(folder) = crate::decisions::links_folder(path) {
        return folder;
    }
    Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// The nearest `specs` folder holding a path, for wikilinks.
fn specs_folder(root: &Path, path: &str) -> PathBuf {
    let mut dir = root.join(path);
    while let Some(parent) = dir.parent() {
        if dir.file_name().is_some_and(|n| n == "specs") {
            return dir;
        }
        dir = parent.to_path_buf();
    }
    root.join("specs")
}

/// Whether the file or folder at `path`, from the root, exists where links resolve: in the tree of
/// the file's tip when it has one, else under its root.
fn exists(file: &File<'_>, path: &str) -> bool {
    match file.tip {
        Some((git, tip)) => {
            git.read_file(tip, path).ok().flatten().is_some()
                || git
                    .list_files(tip, path)
                    .is_ok_and(|files| !files.is_empty())
        }
        None => file.root.join(path).exists(),
    }
}

/// The text of the file at `path`, from the root, where links resolve.
fn read(file: &File<'_>, path: &str) -> Option<String> {
    match file.tip {
        Some((git, tip)) => String::from_utf8(git.read_file(tip, path).ok()??).ok(),
        None => fs::read_to_string(file.root.join(path)).ok(),
    }
}

/// Whether the nearest `specs` folder holding the file has a file named `name`, for wikilinks.
fn wiki_target_exists(file: &File<'_>, name: &str) -> bool {
    let Some((git, tip)) = file.tip else {
        return has_file_named(&specs_folder(file.root, &file.path), name);
    };
    let mut specs = "specs".to_string();
    let mut prefix = String::new();
    for part in file.path.split('/') {
        if part == "specs" {
            specs = format!("{prefix}specs");
        }
        prefix = format!("{prefix}{part}/");
    }
    git.list_files(tip, &specs).is_ok_and(|files| {
        files.iter().any(|path| {
            let file = path.rsplit('/').next().unwrap_or_default();
            file == name || file == format!("{name}.md")
        })
    })
}

fn has_file_named(dir: &Path, name: &str) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let file = entry.file_name().to_string_lossy().into_owned();
        if entry.file_type().is_ok_and(|t| t.is_dir()) {
            has_file_named(&entry.path(), name)
        } else {
            file == name || file == format!("{name}.md")
        }
    })
}

pub(super) fn check_links(file: &File<'_>, document: &Document, problems: &mut Vec<Problem>) {
    let dir = folder_of(&file.path);
    for link in &document.links {
        if link.wiki {
            let name = link.target.split(['#', '|']).next().unwrap_or_default();
            if !wiki_target_exists(file, name) {
                problems.push(file.problem(
                    Some(link.line),
                    "links.wiki",
                    format!("no file named {name}"),
                ));
            }
            continue;
        }
        let (path, anchor) = match link.target.split_once('#') {
            Some((path, anchor)) => (path, Some(anchor)),
            None => (link.target.as_str(), None),
        };
        if path.is_empty() {
            if let Some(anchor) = anchor
                && !document.anchors().contains(&anchor.to_lowercase())
            {
                problems.push(file.problem(
                    Some(link.line),
                    "links.heading",
                    format!("no heading \"{anchor}\" in this file"),
                ));
            }
            continue;
        }
        let Some(resolved) = resolve(&dir, path) else {
            continue;
        };
        let markdown = resolved.ends_with(".md");
        let in_specs = resolved.starts_with("specs/") || resolved.contains("/specs/");
        if !markdown && !in_specs {
            continue;
        }
        let found = exists(file, &resolved);
        // PRIORITIES.md and INBOX.md link to started features, whose files live on their own
        // branches.
        let on_a_branch = matches!(
            file.kind,
            super::Checked::Priorities | super::Checked::Inbox
        ) && resolved
            .split('/')
            .any(|part| crate::workspace::folder_slug(part).is_some());
        if !found && on_a_branch {
            continue;
        }
        if !found {
            problems.push(file.problem(Some(link.line), "links.file", format!("no file {path}")));
            continue;
        }
        let (Some(anchor), true) = (anchor, markdown) else {
            continue;
        };
        let Some(text) = read(file, &resolved) else {
            continue;
        };
        if !Document::parse(&text)
            .anchors()
            .contains(&anchor.to_lowercase())
        {
            problems.push(file.problem(
                Some(link.line),
                "links.heading",
                format!("no heading \"{anchor}\" in {path}"),
            ));
        }
    }
}
