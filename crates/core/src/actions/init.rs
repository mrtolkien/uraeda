//! Setting a project up: the `specs/` folder from the templates. The skill is `install`'s.

use std::fs;
use std::path::Path;

use crate::embedded;

use super::ActionError;

/// What `init` did, one line each.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InitLine {
    Created(String),
    /// A path kept as it was.
    Kept(String),
}

fn write(path: &Path, bytes: &[u8]) -> Result<(), ActionError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)?;
    Ok(())
}

/// Sets up `specs/` at `root`, writing only what is missing.
pub fn run(root: &Path) -> Result<Vec<InitLine>, ActionError> {
    let mut lines = Vec::new();
    for name in ["README.md", "CONSTITUTION.md", "PRIORITIES.md"] {
        let shown = format!("specs/{name}");
        let path = root.join(&shown);
        if path.exists() {
            lines.push(InitLine::Kept(shown));
            continue;
        }
        let template = embedded::template(name)
            .ok_or_else(|| ActionError::Refused(format!("no template for {name}")))?;
        write(&path, template.as_bytes())?;
        lines.push(InitLine::Created(shown));
    }
    for folder in ["drafts", "backlog", "decisions", "changes", "done"] {
        let dir = root.join("specs").join(folder);
        if dir.exists() {
            continue;
        }
        let shown = format!("specs/{folder}/.gitkeep");
        write(&root.join(&shown), b"")?;
        lines.push(InitLine::Created(shown));
    }
    Ok(lines)
}
