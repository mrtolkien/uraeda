//! Setting a project up: the `specs/` folder from the templates, and the skill embedded in the
//! binary, for every agent that reads `.agents/skills/` and for Claude Code.

use std::fs;
use std::path::Path;

use crate::embedded;

use super::ActionError;
use super::install::{self, Folders, InstallLine};

/// What `init` did, one line each.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InitLine {
    Created(String),
    /// A path kept as it was, and why when it is not obvious.
    Kept(String, Option<String>),
    /// The skill's folder, and how many of its files were written.
    Updated(String, usize),
    /// The skill's folder, written for the first time, with its number of files.
    Installed(String, usize),
    Linked(String, String),
}

fn write(path: &Path, bytes: &[u8]) -> Result<(), ActionError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)?;
    Ok(())
}

/// Sets up `specs/` at `root`, and the skill unless `skill` is false. Writes only what is
/// missing, and the skill files nobody edited since they were installed.
pub fn run(root: &Path, skill: bool) -> Result<Vec<InitLine>, ActionError> {
    let mut lines = Vec::new();
    for name in ["README.md", "CONSTITUTION.md", "PRIORITIES.md"] {
        let shown = format!("specs/{name}");
        let path = root.join(&shown);
        if path.exists() {
            lines.push(InitLine::Kept(shown, None));
            continue;
        }
        let template = embedded::template(name)
            .ok_or_else(|| ActionError::Refused(format!("no template for {name}")))?;
        write(&path, template.as_bytes())?;
        lines.push(InitLine::Created(shown));
    }
    for folder in ["drafts", "backlog", "decisions", "bugs", "done"] {
        let dir = root.join("specs").join(folder);
        if dir.exists() {
            continue;
        }
        let shown = format!("specs/{folder}/.gitkeep");
        write(&root.join(&shown), b"")?;
        lines.push(InitLine::Created(shown));
    }
    if skill {
        let both = Folders {
            agents: true,
            claude: true,
        };
        lines.extend(
            install::install(root, "", both)?
                .into_iter()
                .map(|line| match line {
                    InstallLine::Installed(path, count) => InitLine::Installed(path, count),
                    InstallLine::Updated(path, count) => InitLine::Updated(path, count),
                    InstallLine::Linked(link, target) => InitLine::Linked(link, target),
                    InstallLine::Kept(path, why) => InitLine::Kept(path, why),
                }),
        );
    }
    Ok(lines)
}
