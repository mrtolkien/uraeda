//! The links that show each repository's workflow files in the vault, in
//! `projects/<repository>/specs/`: the constitution and the decisions of the main checkout, and the
//! folder of each feature or change in progress, from the worktree it is checked out in.
//!
//! Obsidian follows a link to a folder, lists it, and watches it, even one made or removed while it
//! runs. It lists a link to a single file without watching it: the constitution is read from disk
//! when opened, and only Obsidian's search lags behind a change.
//!
//! Only links are made and removed here: a real file or folder of `specs/` is never touched.

use std::io;
use std::path::{Path, PathBuf};

use uraeda_core::git::Git;
use uraeda_core::workspace::Workspace;

use crate::Vault;

/// One link of `projects/<repository>/specs/`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Link {
    /// Its name in `specs/`: `CONSTITUTION.md`, `decisions`, `2026-11-14-uraeda-light-vault`.
    pub name: String,
    /// What it points to, absolute.
    pub target: PathBuf,
}

/// The links of the repository whose main checkout is `main`. Reads git with gix, and never runs
/// it. Blocks on disk.
pub fn of_repository(main: &Path) -> Result<Vec<Link>, String> {
    let git = Git::open(main).map_err(|e| e.to_string())?;
    let workspace = Workspace::read(&git).map_err(|e| e.to_string())?;
    let main = git.main_root();
    let mut links = Vec::new();
    for name in ["CONSTITUTION.md", "decisions"] {
        let target = main.join("specs").join(name);
        if target.exists() {
            links.push(Link {
                name: name.to_string(),
                target,
            });
        }
    }
    for feature in &workspace.features {
        let Some(worktree) = feature.worktree.as_deref() else {
            continue;
        };
        if feature.is_finished() || links.iter().any(|l| l.name == feature.folder) {
            continue;
        }
        let target = main.join(worktree).join(&feature.path);
        if target.is_dir() {
            links.push(Link {
                name: feature.folder.clone(),
                target,
            });
        }
    }
    Ok(links)
}

/// The folder of a repository's links in the vault.
pub fn folder(vault: &Vault, repository: &str) -> PathBuf {
    vault.root().join("projects").join(repository).join("specs")
}

/// Makes `projects/<repository>/specs/` hold `links`: a link missing is made, a link that points
/// elsewhere is made again, and a link no longer wanted is removed.
pub fn apply(vault: &Vault, repository: &str, links: &[Link]) -> io::Result<()> {
    let dir = folder(vault, repository);
    std::fs::create_dir_all(&dir)?;
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_symlink() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let target = std::fs::read_link(entry.path())?;
        if !links.iter().any(|l| l.name == name && l.target == target) {
            std::fs::remove_file(entry.path())?;
        }
    }
    for link in links {
        let path = dir.join(&link.name);
        if std::fs::symlink_metadata(&path).is_err() {
            symlink(&link.target, &path)?;
        }
    }
    Ok(())
}

/// Removes the links of every project not in `keep`: a repository no longer served shows nothing of
/// git. Its notes stay.
pub fn prune(vault: &Vault, keep: &[&str]) -> io::Result<()> {
    let projects = vault.root().join("projects");
    let Ok(entries) = std::fs::read_dir(&projects) else {
        return Ok(());
    };
    for entry in entries {
        let name = entry?.file_name().to_string_lossy().into_owned();
        if !keep.contains(&name.as_str()) && folder(vault, &name).is_dir() {
            apply(vault, &name, &[])?;
        }
    }
    Ok(())
}

#[cfg(unix)]
fn symlink(target: &Path, path: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(target, path)
}

#[cfg(windows)]
fn symlink(target: &Path, path: &Path) -> io::Result<()> {
    if target.is_dir() {
        std::os::windows::fs::symlink_dir(target, path)
    } else {
        std::os::windows::fs::symlink_file(target, path)
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn link(name: &str, target: &Path) -> Link {
        Link {
            name: name.into(),
            target: target.to_path_buf(),
        }
    }

    #[test]
    fn makes_moves_and_removes_its_links_only() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("repo");
        let (a, b) = (repo.join("a"), repo.join("b"));
        std::fs::create_dir_all(&a).unwrap();
        std::fs::create_dir_all(&b).unwrap();
        let vault = Vault::new(dir.path().join("Uraeda"));
        apply(&vault, "todo", &[link("x", &a), link("gone", &a)]).unwrap();
        let specs = folder(&vault, "todo");
        std::fs::write(specs.join("mine.md"), "real").unwrap();
        apply(&vault, "todo", &[link("x", &b)]).unwrap();
        assert_eq!(std::fs::read_link(specs.join("x")).unwrap(), b);
        assert!(std::fs::symlink_metadata(specs.join("gone")).is_err());
        assert!(specs.join("mine.md").is_file());
        prune(&vault, &[]).unwrap();
        assert!(std::fs::symlink_metadata(specs.join("x")).is_err());
        assert!(specs.join("mine.md").is_file());
    }
}
