//! Installing the skill embedded in the binary in a base folder, the home folder or a repository's
//! top level: in `.agents/skills/` for every agent that reads it, in `.claude/skills/` for Claude
//! Code, or both, the second linked to the first. Writes only into folders it installed.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use include_dir::Dir;
use sha2::{Digest, Sha256};

use crate::embedded::SKILL;

use super::ActionError;

/// The skill's folder for every agent that reads `.agents/skills/`, from the base folder.
pub const AGENTS_DIR: &str = ".agents/skills/uraeda";
/// The skill's folder, or link, for Claude Code, from the base folder.
pub const CLAUDE_DIR: &str = ".claude/skills/uraeda";
/// The manifest of an installed skill, in `sha256sum` format.
pub const MANIFEST: &str = ".ura-manifest";

/// The link ura makes from `CLAUDE_DIR` to `AGENTS_DIR`.
const CLAUDE_TARGET: &str = "../../.agents/skills/uraeda";

/// The folders to install the skill in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Folders {
    pub agents: bool,
    pub claude: bool,
}

/// What `install` did, one line each, its paths prefixed with the base folder as shown.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InstallLine {
    /// The skill's folder, written for the first time, with its number of files.
    Installed(String, usize),
    /// The skill's folder, and how many of its files were written or removed.
    Updated(String, usize),
    /// The link, and its target.
    Linked(String, String),
    /// A path kept as it was, and why when it is not obvious.
    Kept(String, Option<String>),
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

fn embedded() -> BTreeMap<String, &'static [u8]> {
    let mut embedded = BTreeMap::new();
    files(&SKILL, &mut embedded);
    embedded
}

/// An I/O error on a path, as shown.
fn failed(shown: &str) -> impl FnOnce(std::io::Error) -> ActionError + '_ {
    move |error| ActionError::Io(format!("could not write {shown}: {error}"))
}

fn write(path: &Path, bytes: &[u8], shown: &str) -> Result<(), ActionError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(failed(shown))?;
    }
    fs::write(path, bytes).map_err(failed(shown))
}

fn manifest_text(manifest: &BTreeMap<String, String>) -> String {
    manifest
        .iter()
        .map(|(path, hash)| format!("{hash}  {path}\n"))
        .collect()
}

/// The skill paths, of `AGENTS_DIR` and `CLAUDE_DIR`, with anything at them in `base`: a folder,
/// a file, or a link, dangling or not.
pub fn existing(base: &Path) -> Vec<&'static str> {
    [AGENTS_DIR, CLAUDE_DIR]
        .into_iter()
        .filter(|dir| fs::symlink_metadata(base.join(dir)).is_ok())
        .collect()
}

/// Installs the skill in the chosen folders of `base`, `.agents` first, each by what is there:
/// nothing is copied, or linked for `.claude` when both are chosen; a folder with a manifest is
/// updated; a folder without one, or a link, is kept. `shown` prefixes the printed paths.
pub fn install(
    base: &Path,
    shown: &str,
    folders: Folders,
) -> Result<Vec<InstallLine>, ActionError> {
    let mut lines = Vec::new();
    if folders.agents {
        place(base, shown, AGENTS_DIR, None, &mut lines)?;
    }
    if folders.claude {
        let link = folders.agents.then_some(CLAUDE_TARGET);
        place(base, shown, CLAUDE_DIR, link, &mut lines)?;
    }
    Ok(lines)
}

/// Installs at one skill path; when there is nothing, links it to `link` if given.
fn place(
    base: &Path,
    shown: &str,
    dir: &str,
    link: Option<&str>,
    lines: &mut Vec<InstallLine>,
) -> Result<(), ActionError> {
    let path = base.join(dir);
    let shown_dir = format!("{shown}{dir}");
    match fs::symlink_metadata(&path) {
        Err(_) => match link {
            Some(target) => make_link(&path, target, &shown_dir, lines),
            None => copy(&path, &shown_dir, lines),
        },
        Ok(meta) if meta.file_type().is_symlink() => {
            let target = fs::read_link(&path).map_err(failed(&shown_dir))?;
            let why = (target != Path::new(CLAUDE_TARGET))
                .then(|| format!("a link to {}", target.display()));
            lines.push(InstallLine::Kept(shown_dir, why));
            Ok(())
        }
        Ok(meta) if meta.is_dir() && path.join(MANIFEST).is_file() => {
            update(&path, &shown_dir, lines)
        }
        Ok(_) => {
            lines.push(InstallLine::Kept(
                shown_dir,
                Some("not installed by ura".to_string()),
            ));
            Ok(())
        }
    }
}

/// A first copy: every file and the manifest, written in a sibling `<name>.ura-tmp` folder, then
/// renamed into place, so a failed copy leaves nothing at the skill path.
fn copy(path: &Path, shown_dir: &str, lines: &mut Vec<InstallLine>) -> Result<(), ActionError> {
    let shown_folder = format!("{shown_dir}/");
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".ura-tmp");
    let temporary = Path::new(&temporary);
    match fs::symlink_metadata(temporary) {
        Ok(meta) if meta.is_dir() => fs::remove_dir_all(temporary),
        Ok(_) => fs::remove_file(temporary),
        Err(_) => Ok(()),
    }
    .map_err(failed(&shown_folder))?;
    let written = (|| {
        fs::create_dir_all(temporary).map_err(failed(&shown_folder))?;
        let embedded = embedded();
        let mut manifest = BTreeMap::new();
        for (file, bytes) in &embedded {
            write(&temporary.join(file), bytes, &format!("{shown_dir}/{file}"))?;
            manifest.insert(file.clone(), sha256(bytes));
        }
        write(
            &temporary.join(MANIFEST),
            manifest_text(&manifest).as_bytes(),
            &format!("{shown_dir}/{MANIFEST}"),
        )?;
        fs::rename(temporary, path).map_err(failed(&shown_folder))?;
        Ok(embedded.len())
    })();
    match written {
        Ok(count) => {
            lines.push(InstallLine::Installed(shown_folder, count));
            Ok(())
        }
        Err(error) => {
            let _ = fs::remove_dir_all(temporary);
            Err(error)
        }
    }
}

/// Updates an installed skill from its manifest: writes the files nobody edited since they were
/// installed, keeps the edited ones, and removes the files the skill no longer has, unless edited.
fn update(dir: &Path, shown_dir: &str, lines: &mut Vec<InstallLine>) -> Result<(), ActionError> {
    let recorded = fs::read_to_string(dir.join(MANIFEST)).unwrap_or_default();
    let installed: BTreeMap<String, String> = recorded
        .lines()
        .filter_map(|line| {
            let (hash, path) = line.split_once("  ")?;
            Some((path.to_string(), hash.to_string()))
        })
        .collect();
    let embedded = embedded();
    let mut manifest = BTreeMap::new();
    let mut written = 0;
    for (path, bytes) in &embedded {
        let target = dir.join(path);
        let shown = format!("{shown_dir}/{path}");
        let new_hash = sha256(bytes);
        match fs::read(&target) {
            Err(_) => {
                write(&target, bytes, &shown)?;
                written += 1;
                manifest.insert(path.clone(), new_hash);
            }
            Ok(current) => {
                let current_hash = sha256(&current);
                if current_hash == new_hash {
                    manifest.insert(path.clone(), new_hash);
                } else if installed.get(path) == Some(&current_hash) {
                    write(&target, bytes, &shown)?;
                    written += 1;
                    manifest.insert(path.clone(), new_hash);
                } else {
                    lines.push(InstallLine::Kept(
                        shown,
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
                fs::remove_file(&target).map_err(failed(&format!("{shown_dir}/{path}")))?;
                written += 1;
            }
            Ok(_) => {
                manifest.insert(path.clone(), hash.clone());
            }
            Err(_) => {}
        }
    }
    let text = manifest_text(&manifest);
    if text != recorded {
        write(
            &dir.join(MANIFEST),
            text.as_bytes(),
            &format!("{shown_dir}/{MANIFEST}"),
        )?;
    }
    let shown_folder = format!("{shown_dir}/");
    if written > 0 {
        lines.push(InstallLine::Updated(shown_folder, written));
    } else {
        lines.push(InstallLine::Kept(
            shown_folder,
            Some("up to date".to_string()),
        ));
    }
    Ok(())
}

fn make_link(
    path: &Path,
    target: &str,
    shown_dir: &str,
    lines: &mut Vec<InstallLine>,
) -> Result<(), ActionError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(failed(shown_dir))?;
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, path).map_err(failed(shown_dir))?;
    lines.push(InstallLine::Linked(
        shown_dir.to_string(),
        target.to_string(),
    ));
    Ok(())
}
