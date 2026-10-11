//! `links.*`: links to markdown files and into `specs/` resolve to a file, and their anchor to a
//! heading of it; wikilinks name a file of the `specs/` folder.

use std::fs;
use std::path::{Path, PathBuf};

use crate::files::markdown::Document;
use crate::workspace::{Problem, resolve};

use super::File;

/// The folder a link is relative to: the linking file's folder, from the root.
fn folder_of(path: &str) -> String {
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
            if !has_file_named(&specs_folder(file.root, &file.path), name) {
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
        let target = file.root.join(&resolved);
        if !target.exists() {
            problems.push(file.problem(Some(link.line), "links.file", format!("no file {path}")));
            continue;
        }
        let (Some(anchor), true) = (anchor, markdown) else {
            continue;
        };
        let Ok(text) = fs::read_to_string(&target) else {
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
