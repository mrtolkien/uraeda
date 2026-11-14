//! `ura vault check`: the wikilinks that resolve to no file of the vault, and the wiki's notes
//! without a `description`. The repositories' files, in `projects/*/specs/`, are git's and keep
//! markdown links: they are not checked.

use std::collections::HashSet;

use serde::Serialize;

use crate::{Vault, notes, paths, walk};

/// One problem, at a note's line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Problem {
    pub path: String,
    /// From 1; none for a problem of the whole note.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<usize>,
    pub message: String,
}

impl std::fmt::Display for Problem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.line {
            Some(line) => write!(f, "{}:{line}: {}", self.path, self.message),
            None => write!(f, "{}: {}", self.path, self.message),
        }
    }
}

/// Every problem of the vault, by path then line.
pub fn check(vault: &Vault) -> Vec<Problem> {
    let files = walk::files(vault.root(), |p| !p.split('/').any(|s| s.starts_with('.')));
    let targets = Targets::new(&files);
    let mut problems = Vec::new();
    for path in files
        .iter()
        .filter(|p| p.ends_with(".md") && !paths::is_read_only(p))
    {
        let Ok(text) = std::fs::read_to_string(vault.root().join(path)) else {
            continue;
        };
        for (line, target) in wikilinks(&text) {
            if !targets.resolves(&target) {
                problems.push(Problem {
                    path: path.clone(),
                    line: Some(line),
                    message: format!("[[{target}]] is no note of the vault"),
                });
            }
        }
        if path.starts_with("wiki/") && notes::description(&text).is_none() {
            problems.push(Problem {
                path: path.clone(),
                line: None,
                message: "a wiki note says its description in its frontmatter".into(),
            });
        }
    }
    problems
}

/// What a wikilink may name, in lower case as Obsidian matches: a file's name with and without
/// `.md`, and its paths.
struct Targets {
    names: HashSet<String>,
    paths: HashSet<String>,
}

impl Targets {
    fn new(files: &[String]) -> Targets {
        let mut names = HashSet::new();
        let mut paths = HashSet::new();
        for file in files {
            let lower = file.to_lowercase();
            let name = lower.rsplit('/').next().unwrap_or(&lower).to_string();
            if let Some(stem) = name.strip_suffix(".md") {
                names.insert(stem.to_string());
            }
            if let Some(stem) = lower.strip_suffix(".md") {
                paths.insert(stem.to_string());
            }
            names.insert(name);
            paths.insert(lower);
        }
        Targets { names, paths }
    }

    fn resolves(&self, target: &str) -> bool {
        let target = target.trim().trim_start_matches('/').to_lowercase();
        if target.is_empty() {
            // `[[#heading]]` is a link inside the note itself.
            return true;
        }
        if target.contains('/') {
            self.paths.contains(&target)
                || self
                    .paths
                    .iter()
                    .any(|p| p.ends_with(&format!("/{target}")))
        } else {
            self.names.contains(&target)
        }
    }
}

/// The wikilinks of a note, with their lines from 1, outside code: `[[name]]`, `[[name|text]]`,
/// `[[name#heading]]`, `![[image.png]]`, each as the name it points to.
pub fn wikilinks(text: &str) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    let mut fence: Option<&str> = None;
    for (index, line) in text.lines().enumerate() {
        let trimmed = line.trim_start();
        if let Some(open) = fence {
            if trimmed.starts_with(open) {
                fence = None;
            }
            continue;
        }
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            fence = Some(&trimmed[..3]);
            continue;
        }
        let mut rest = line;
        let mut in_code = false;
        while !rest.is_empty() {
            if rest.starts_with('`') {
                in_code = !in_code;
                rest = &rest[1..];
            } else if !in_code && rest.starts_with("[[") {
                let Some(end) = rest.find("]]") else { break };
                let inner = &rest[2..end];
                let target = inner.split(['|', '#', '^']).next().unwrap_or_default();
                out.push((index + 1, target.to_string()));
                rest = &rest[end + 2..];
            } else {
                let step = rest.chars().next().map_or(1, char::len_utf8);
                rest = &rest[step..];
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_wikilinks_outside_code() {
        let text = "See [[todoist]] and [[date-fns|the lib]].\n`[[not]]`\n```\n[[nor]]\n```\n![[shot.png]] [[#here]] [[a#b]]\n";
        assert_eq!(
            wikilinks(text),
            [
                (1, "todoist".to_string()),
                (1, "date-fns".to_string()),
                (6, "shot.png".to_string()),
                (6, String::new()),
                (6, "a".to_string()),
            ]
        );
    }

    #[test]
    fn reports_broken_links_and_missing_descriptions() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path());
        let w = |p: &str, t: &str| notes::write(&vault, p, t.as_bytes()).unwrap();
        w(
            "wiki/apps/todoist.md",
            "---\ndescription: A todo app\n---\n[[Date-FNS]] [[gone]]\n",
        );
        w("wiki/libraries/date-fns.md", "# date-fns\n");
        w(
            "inbox/a.md",
            "[[wiki/apps/todoist]] [[apps/todoist]] [[shot.png]]\n",
        );
        std::fs::write(dir.path().join("inbox/shot.png"), b"").unwrap();
        let problems: Vec<String> = check(&vault).iter().map(ToString::to_string).collect();
        assert_eq!(
            problems,
            [
                "wiki/apps/todoist.md:4: [[gone]] is no note of the vault",
                "wiki/libraries/date-fns.md: a wiki note says its description in its frontmatter",
            ]
        );
    }
}
