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

/// The layout's folders that exist, from the vault's: `inbox`, `wiki/apps`,
/// `projects/todo/proposals`.
pub fn folders(vault: &Vault) -> Vec<String> {
    let root = vault.root();
    let mut out = vec!["inbox".to_string()];
    out.extend(WIKI_FOLDERS.iter().map(|f| format!("wiki/{f}")));
    if let Ok(entries) = std::fs::read_dir(root.join("projects")) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || !entry.path().is_dir() {
                continue;
            }
            out.extend(
                PROJECT_FOLDERS
                    .iter()
                    .map(|f| format!("projects/{name}/{f}")),
            );
        }
    }
    out.retain(|f| root.join(f).is_dir());
    out.sort();
    out
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
        assert!(folders(&vault).contains(&"projects/todo/research".to_string()));
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
