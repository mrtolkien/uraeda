//! The vault's folders, made when missing and never removed: a folder the human emptied stays.

use std::io;

use crate::Vault;

/// The wiki's five folders, one per kind of note.
pub const WIKI_FOLDERS: [&str; 5] = ["libraries", "apps", "standards", "topics", "gotchas"];

/// A project's folders, beside the `specs/` the links make.
pub const PROJECT_FOLDERS: [&str; 2] = ["proposals", "research"];

/// Makes the vault's shared folders, and each project's of `projects`, by repository name.
pub fn ensure(vault: &Vault, projects: &[&str]) -> io::Result<()> {
    let root = vault.root();
    std::fs::create_dir_all(root.join("inbox"))?;
    for folder in WIKI_FOLDERS {
        std::fs::create_dir_all(root.join("wiki").join(folder))?;
    }
    for project in projects {
        for folder in PROJECT_FOLDERS {
            std::fs::create_dir_all(root.join("projects").join(project).join(folder))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_the_layout_and_keeps_what_is_there() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path().join("Uraeda"));
        std::fs::create_dir_all(vault.root().join("inbox")).unwrap();
        std::fs::write(vault.root().join("inbox/a.md"), "mine").unwrap();
        ensure(&vault, &["todo"]).unwrap();
        ensure(&vault, &["todo"]).unwrap();
        for folder in [
            "wiki/gotchas",
            "projects/todo/proposals",
            "projects/todo/research",
        ] {
            assert!(vault.root().join(folder).is_dir(), "{folder}");
        }
        assert_eq!(
            std::fs::read_to_string(vault.root().join("inbox/a.md")).unwrap(),
            "mine"
        );
    }
}
