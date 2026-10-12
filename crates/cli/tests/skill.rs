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
        assert!(
            text.contains(&format!("`ura {command}")),
            "ura {command} is not in the skill"
        );
    }
}
