mod common;

use std::fs;

use common::*;

/// The subcommands `ura --help` lists.
fn subcommands() -> Vec<String> {
    let output = ura_in(&repository(), &["--help"], &[]);
    output
        .stdout
        .split("Commands:")
        .nth(1)
        .unwrap()
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| *name != "help")
        .take_while(|name| !name.ends_with(':'))
        .map(String::from)
        .collect()
}

#[test]
fn every_command_is_named_in_the_skill() {
    let skill = repository().join("skills/uraeda");
    let mut text = fs::read_to_string(skill.join("SKILL.md")).unwrap();
    for entry in fs::read_dir(skill.join("references")).unwrap() {
        text.push_str(&fs::read_to_string(entry.unwrap().path()).unwrap());
    }

    let commands = subcommands();

    assert!(commands.len() >= 8, "{commands:?}");
    for command in commands {
        // TEMPORARY: the commands Uraeda light removes, until their cut.
        if REMOVED.contains(&command.as_str()) {
            continue;
        }
        assert!(
            text.contains(&format!("`ura {command}")),
            "ura {command} is not in the skill"
        );
    }
}

/// TEMPORARY: the commands `ura` loses with Uraeda light, until each is removed.
const REMOVED: [&str; 14] = [
    "serve-app",
    "start",
    "clean",
    "note",
    "inbox",
    "expand",
    "lsp",
    "add",
    "extension",
    "pair",
    "key",
    "import-sessions",
    "sandbox",
    "fake-storybook",
];

// US7.1, SC-004.
#[test]
fn the_skill_entry_point_stays_lean() {
    let skill = repository().join("skills/uraeda/SKILL.md");
    let length = fs::read_to_string(&skill).unwrap().chars().count();
    assert!(
        length <= 20_000,
        "SKILL.md has {length} characters, over 20,000: move what most steps do not need to a \
         reference, and link it"
    );
}

/// The markdown files under `folder`, at any depth.
fn markdown_files(folder: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
    for entry in fs::read_dir(folder).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            markdown_files(&path, files);
        } else if path.extension().is_some_and(|extension| extension == "md") {
            files.push(path);
        }
    }
}

// The skill holds the workflow for any harness: what only the app does, it tells its own
// sessions (`crates/server/src/runtimes/built_in/instructions.rs`), and its users
// (`docs/app.md`).
#[test]
fn the_skill_never_describes_the_web_ui() {
    let skill = repository().join("skills/uraeda");
    let mut files = vec![skill.join("SKILL.md")];
    markdown_files(&skill.join("references"), &mut files);
    markdown_files(&skill.join("assets/templates"), &mut files);
    markdown_files(&skill.join("assets/example"), &mut files);

    for file in files {
        let text = fs::read_to_string(&file).unwrap();
        for phrase in [
            "web UI",
            "uraeda-offer",
            "in Uraeda",
            "Uraeda shows",
            "Uraeda's helper",
        ] {
            assert!(
                !text.contains(phrase),
                "{} names the app with \"{phrase}\": move it to the app's instructions or \
                 docs/app.md",
                file.display()
            );
        }
    }
}
