//! The vault's folders, made when missing and never removed: a folder the human emptied stays.

use std::io;

use crate::Vault;

/// The wiki's four folders, one per kind of subject. A subject with more than one note is a folder
/// of them, made by whoever writes its second note.
pub const WIKI_FOLDERS: [&str; 4] = ["libraries", "apps", "standards", "topics"];

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
        let board = root.join("projects").join(project).join("Board.base");
        match std::fs::read_to_string(&board) {
            Err(_) => crate::notes::write_atomic(&board, board_text(project).as_bytes())?,
            Ok(text) => {
                if let Some(drawn) = with_uraeda_board(project, &text) {
                    crate::notes::write_atomic(&board, drawn.as_bytes())?;
                }
            }
        }
    }
    Ok(())
}

/// The view type of a project's board, which the Uraeda plugin draws: a column per `status`, the
/// cards in the order of their `rank`, dragged into place.
pub const BOARD_VIEW: &str = "uraeda-board";

/// A project's board, written once and the human's afterwards: an Obsidian base of its proposals,
/// drawn by the plugin's board view, which holds the columns and the order itself.
pub fn board_text(project: &str) -> String {
    format!(
        "filters:\n  and:\n    - file.inFolder(\"projects/{project}/proposals\")\nviews:\n  - type: \
         {BOARD_VIEW}\n    name: Board\n"
    )
}

/// An older board of the project, drawn by Obsidian's own kanban, which cannot order the cards of
/// a column: the same board with the plugin's view, the rest of the human's edits kept. `None` for
/// a board that is not that one.
fn with_uraeda_board(project: &str, text: &str) -> Option<String> {
    let folder = format!("file.inFolder(\"projects/{project}/proposals\")");
    let kanban = "  - type: kanban\n";
    (text.contains(&folder) && text.contains(kanban))
        .then(|| text.replacen(kanban, &format!("  - type: {BOARD_VIEW}\n"), 1))
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
        let board = std::fs::read_to_string(vault.root().join("projects/todo/Board.base")).unwrap();
        assert!(
            board.contains("file.inFolder(\"projects/todo/proposals\")"),
            "{board}"
        );
        for folder in [
            "wiki/topics",
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

    #[test]
    fn an_older_kanban_board_gets_the_plugins_view_and_keeps_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path().join("Uraeda"));
        let board = vault.root().join("projects/todo/Board.base");
        std::fs::create_dir_all(board.parent().unwrap()).unwrap();
        let older = "filters:\n  and:\n    - file.inFolder(\"projects/todo/proposals\")\n    - status != \"idea\"\nviews:\n  - type: kanban\n    name: Mine\n";
        std::fs::write(&board, older).unwrap();
        ensure(&vault, &["todo"]).unwrap();
        let text = std::fs::read_to_string(&board).unwrap();
        assert_eq!(text, older.replace("type: kanban", "type: uraeda-board"));
        ensure(&vault, &["todo"]).unwrap();
        assert_eq!(std::fs::read_to_string(&board).unwrap(), text);
    }
}
