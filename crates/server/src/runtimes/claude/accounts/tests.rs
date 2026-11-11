//! The `accounts` setting's lines, as folders with their names and their problems.

use std::path::Path;

use super::folders;

#[test]
fn the_lines_become_folders_named_by_the_rule() {
    let home = Path::new("/home/me");
    let lines: Vec<String> = [
        "~/.claude",
        "~/.claude-b",
        " /data/work/ ",
        "",
        "docs",
        "~/.claude-b/",
        "/elsewhere/.claude-b",
        "/x/.claude-",
    ]
    .map(str::to_owned)
    .to_vec();
    let (folders, problems) = folders(&lines, home);
    let read: Vec<(&str, &str)> = folders
        .iter()
        .map(|folder| (folder.id.as_str(), folder.name.as_str()))
        .collect();
    assert_eq!(
        read,
        [
            ("/home/me/.claude", "default"),
            ("/home/me/.claude-b", "b"),
            ("/data/work", "work"),
            // A name already taken reads the folder's path.
            ("/elsewhere/.claude-b", "/elsewhere/.claude-b"),
            ("/x/.claude-", "/x/.claude-"),
        ]
    );
    assert_eq!(problems, ["account folder docs is not an absolute path"]);
}

#[test]
fn only_a_folder_other_than_the_default_is_given_as_the_variable() {
    let home = Path::new("/home/me");
    assert!(super::folder_env("/home/me/.claude", home).is_empty());
    assert_eq!(
        super::folder_env("/home/me/.claude-b", home),
        [(
            "CLAUDE_CONFIG_DIR".to_owned(),
            "/home/me/.claude-b".to_owned()
        )]
    );
}
