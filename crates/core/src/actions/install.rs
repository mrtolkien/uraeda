//! Installing the skill embedded in the binary in a base folder, the home folder or a repository's
//! top level: in `.agents/skills/` for every agent that reads it, in `.claude/skills/` for Claude
//! Code, or both, the second linked to the first. Writes only into folders it installed.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

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
        place(base, shown, AGENTS_DIR, false, &mut lines)?;
    }
    if folders.claude {
        place(base, shown, CLAUDE_DIR, folders.agents, &mut lines)?;
    }
    Ok(lines)
}

/// Updates every skill ura installed in `base`, each a real folder with a manifest at `AGENTS_DIR`
/// or `CLAUDE_DIR`, the others skipped; an empty list when there is none. `shown` prefixes the
/// printed paths.
pub fn update(base: &Path, shown: &str) -> Result<Vec<InstallLine>, ActionError> {
    let mut lines = Vec::new();
    for dir in [AGENTS_DIR, CLAUDE_DIR] {
        let path = base.join(dir);
        let installed = fs::symlink_metadata(&path).is_ok_and(|meta| meta.is_dir())
            && path.join(MANIFEST).is_file();
        if installed {
            refresh(&path, &format!("{shown}{dir}"), &mut lines)?;
        }
    }
    Ok(lines)
}

/// Installs at one skill path; when there is nothing, links it to `AGENTS_DIR` if `link`.
fn place(
    base: &Path,
    shown: &str,
    dir: &str,
    link: bool,
    lines: &mut Vec<InstallLine>,
) -> Result<(), ActionError> {
    let path = base.join(dir);
    let shown_dir = format!("{shown}{dir}");
    match fs::symlink_metadata(&path) {
        Err(_) if link => make_link(base, shown, lines),
        Err(_) => copy(&path, &shown_dir, lines),
        Ok(meta) if meta.file_type().is_symlink() => {
            let target = fs::read_link(&path).map_err(failed(&shown_dir))?;
            let why = (dir != CLAUDE_DIR || !reaches_agents(base, &path))
                .then(|| format!("a link to {}", target.display()));
            lines.push(InstallLine::Kept(shown_dir, why));
            Ok(())
        }
        Ok(meta) if meta.is_dir() && path.join(MANIFEST).is_file() => {
            refresh(&path, &shown_dir, lines)
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

/// Whether a manifest's path stays inside the skill: relative, with only normal components.
fn inside(path: &str) -> bool {
    let path = Path::new(path);
    path.components().next().is_some()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

/// The first link on a path inside the skill folder `dir`, the file itself included, from `dir`.
fn first_link(dir: &Path, path: &str) -> Option<PathBuf> {
    let mut current = PathBuf::new();
    for component in Path::new(path).components() {
        current.push(component);
        let meta = fs::symlink_metadata(dir.join(&current));
        if meta.is_ok_and(|meta| meta.file_type().is_symlink()) {
            return Some(current);
        }
    }
    None
}

/// The links found inside an installed skill, each kept, and printed once.
struct Links<'a> {
    dir: &'a Path,
    shown_dir: &'a str,
    seen: BTreeSet<PathBuf>,
}

impl Links<'_> {
    /// Whether a path of the skill goes through a link, which is then kept.
    fn through(&mut self, path: &str, lines: &mut Vec<InstallLine>) -> bool {
        let Some(link) = first_link(self.dir, path) else {
            return false;
        };
        if self.seen.insert(link.clone()) {
            let target = fs::read_link(self.dir.join(&link)).unwrap_or_default();
            lines.push(InstallLine::Kept(
                format!("{}/{}", self.shown_dir, link.display()),
                Some(format!("a link to {}", target.display())),
            ));
        }
        true
    }
}

/// Updates an installed skill from its manifest: writes the files nobody edited since they were
/// installed, keeps the edited ones, and removes the files the skill no longer has, unless edited.
/// A manifest's path outside the skill, absolute or with `..`, is ignored, and a path through a
/// link inside the skill, the manifest's included, is kept: nothing is written through a link.
fn refresh(dir: &Path, shown_dir: &str, lines: &mut Vec<InstallLine>) -> Result<(), ActionError> {
    let mut links = Links {
        dir,
        shown_dir,
        seen: BTreeSet::new(),
    };
    let recorded = fs::read_to_string(dir.join(MANIFEST)).unwrap_or_default();
    let installed: BTreeMap<String, String> = recorded
        .lines()
        .filter_map(|line| {
            let (hash, path) = line.split_once("  ")?;
            inside(path).then(|| (path.to_string(), hash.to_string()))
        })
        .collect();
    let embedded = embedded();
    let mut manifest = BTreeMap::new();
    let mut written = 0;
    for (path, bytes) in &embedded {
        if links.through(path, lines) {
            if let Some(hash) = installed.get(path) {
                manifest.insert(path.clone(), hash.clone());
            }
            continue;
        }
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
        if links.through(path, lines) {
            manifest.insert(path.clone(), hash.clone());
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
    if text != recorded && !links.through(MANIFEST, lines) {
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

/// Whether `path` resolves to the `AGENTS_DIR` of `base`, through any link.
fn reaches_agents(base: &Path, path: &Path) -> bool {
    match (
        fs::canonicalize(path),
        fs::canonicalize(base.join(AGENTS_DIR)),
    ) {
        (Ok(path), Ok(agents)) => path == agents,
        _ => false,
    }
}

/// The relative path from the folder `from` to `to`, both absolute and without `..`.
fn relative(from: &Path, to: &Path) -> PathBuf {
    let from: Vec<_> = from.components().collect();
    let to: Vec<_> = to.components().collect();
    let common = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    from[common..]
        .iter()
        .map(|_| Component::ParentDir)
        .chain(to[common..].iter().copied())
        .collect()
}

/// Links `CLAUDE_DIR` to `AGENTS_DIR`, with a target relative to the link's real folder, which
/// the system resolves it from when `.claude` or `.claude/skills` is itself a link.
fn make_link(base: &Path, shown: &str, lines: &mut Vec<InstallLine>) -> Result<(), ActionError> {
    let path = base.join(CLAUDE_DIR);
    let shown_dir = format!("{shown}{CLAUDE_DIR}");
    let parent = path.parent().unwrap_or(base);
    fs::create_dir_all(parent).map_err(failed(&shown_dir))?;
    let real_parent = fs::canonicalize(parent).map_err(failed(&shown_dir))?;
    let real_base = fs::canonicalize(base).map_err(failed(&shown_dir))?;
    let target = relative(&real_parent, &real_base.join(AGENTS_DIR));
    #[cfg(unix)]
    std::os::unix::fs::symlink(&target, &path).map_err(failed(&shown_dir))?;
    if !reaches_agents(base, &path) {
        let _ = fs::remove_file(&path);
        return Err(failed(&shown_dir)(std::io::Error::other(format!(
            "the link would not reach {shown}{AGENTS_DIR}"
        ))));
    }
    lines.push(InstallLine::Linked(
        shown_dir,
        target.to_string_lossy().into_owned(),
    ));
    Ok(())
}
