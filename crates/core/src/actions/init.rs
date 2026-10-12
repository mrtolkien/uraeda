//! Setting a project up: the `specs/` folder from the templates, and the skill embedded in the
//! binary, for every agent that reads `.agents/skills/` and for Claude Code.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use include_dir::Dir;
use sha2::{Digest, Sha256};

use crate::embedded::{self, SKILL};

use super::ActionError;

/// Where the skill is installed, from the top level.
pub const SKILL_DIR: &str = ".agents/skills/uraeda";
/// The link Claude Code reads the skill through.
pub const CLAUDE_LINK: &str = ".claude/skills/uraeda";
/// The manifest of the installed skill, in `sha256sum` format.
pub const MANIFEST: &str = ".ura-manifest";

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

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Every file of an embedded folder, with its path inside the skill.
fn files<'a>(dir: &'a Dir<'a>, out: &mut BTreeMap<String, &'a [u8]>) {
    for file in dir.files() {
        out.insert(file.path().to_string_lossy().into_owned(), file.contents());
    }
    for sub in dir.dirs() {
        files(sub, out);
    }
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
        install_skill(root, &mut lines)?;
        link_claude(root, &mut lines)?;
    }
    Ok(lines)
}

fn install_skill(root: &Path, lines: &mut Vec<InitLine>) -> Result<(), ActionError> {
    let dir = root.join(SKILL_DIR);
    let first_install = !dir.exists();
    let installed: BTreeMap<String, String> = fs::read_to_string(dir.join(MANIFEST))
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let (hash, path) = line.split_once("  ")?;
            Some((path.to_string(), hash.to_string()))
        })
        .collect();
    let mut embedded = BTreeMap::new();
    files(&SKILL, &mut embedded);
    let mut manifest = BTreeMap::new();
    let mut written = 0;
    for (path, bytes) in &embedded {
        let target = dir.join(path);
        let new_hash = sha256(bytes);
        match fs::read(&target) {
            Err(_) => {
                write(&target, bytes)?;
                written += 1;
                manifest.insert(path.clone(), new_hash);
            }
            Ok(current) => {
                let current_hash = sha256(&current);
                if current_hash == new_hash {
                    manifest.insert(path.clone(), new_hash);
                } else if installed.get(path) == Some(&current_hash) {
                    write(&target, bytes)?;
                    written += 1;
                    manifest.insert(path.clone(), new_hash);
                } else {
                    lines.push(InitLine::Kept(
                        format!("{SKILL_DIR}/{path}"),
                        Some("edited since installed".to_string()),
                    ));
                    if let Some(hash) = installed.get(path) {
                        manifest.insert(path.clone(), hash.clone());
                    }
                }
            }
        }
    }
    // Files of an older skill that this one no longer has, when nobody edited them.
    for (path, hash) in &installed {
        if embedded.contains_key(path) {
            continue;
        }
        let target = dir.join(path);
        match fs::read(&target) {
            Ok(current) if &sha256(&current) == hash => {
                fs::remove_file(&target)?;
                written += 1;
            }
            Ok(_) => {
                manifest.insert(path.clone(), hash.clone());
            }
            Err(_) => {}
        }
    }
    let text: String = manifest
        .iter()
        .map(|(path, hash)| format!("{hash}  {path}\n"))
        .collect();
    write(&dir.join(MANIFEST), text.as_bytes())?;
    let shown = format!("{SKILL_DIR}/");
    if first_install {
        lines.push(InitLine::Installed(shown, written));
    } else if written > 0 {
        lines.push(InitLine::Updated(shown, written));
    } else {
        lines.push(InitLine::Kept(shown, Some("up to date".to_string())));
    }
    Ok(())
}

fn link_claude(root: &Path, lines: &mut Vec<InitLine>) -> Result<(), ActionError> {
    let link = root.join(CLAUDE_LINK);
    if fs::symlink_metadata(&link).is_ok() {
        lines.push(InitLine::Kept(CLAUDE_LINK.to_string(), None));
        return Ok(());
    }
    if let Some(parent) = link.parent() {
        fs::create_dir_all(parent)?;
    }
    let target = format!("../../{SKILL_DIR}");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&target, &link)?;
    lines.push(InitLine::Linked(CLAUDE_LINK.to_string(), target));
    Ok(())
}
