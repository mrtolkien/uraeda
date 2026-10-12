mod common;

use std::fs;
use std::path::Path;

use common::*;

const NEXT: &str = "Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.";
const NO_SKILL: &str =
    "No Uraeda skill found: install it with ura install --user --agents --claude.";

fn entries(dir: &Path) -> usize {
    fs::read_dir(dir).map_or(0, |entries| entries.count())
}

#[cfg(unix)]
fn symlink(target: &Path, link: &Path) {
    fs::create_dir_all(link.parent().unwrap()).unwrap();
    std::os::unix::fs::symlink(target, link).unwrap();
}

/// The line before the `Next:` line, which is the last one.
fn before_next(output: &Output) -> Option<&str> {
    let lines: Vec<&str> = output.stdout.lines().collect();
    assert_eq!(lines.last(), Some(&NEXT), "{}", output.stdout);
    lines.len().checked_sub(2).map(|index| lines[index])
}

#[test]
fn sets_up_specs_only_from_a_subfolder() {
    let repo = TestRepo::new();
    repo.write("crates/a.txt", "a\n");
    let home = repo.home();
    let home_env = [("HOME", home.to_str().unwrap())];
    let installed = ura_in(repo.path(), &["install", "--user", "--agents"], &home_env);
    assert_eq!(installed.code, 0, "{}", installed.stderr);

    let output = ura_in(&repo.path().join("crates"), &["init"], &home_env);

    for file in [
        "specs/README.md",
        "specs/CONSTITUTION.md",
        "specs/PRIORITIES.md",
        "specs/drafts/.gitkeep",
        "specs/backlog/.gitkeep",
        "specs/decisions/.gitkeep",
        "specs/bugs/.gitkeep",
        "specs/done/.gitkeep",
    ] {
        assert!(repo.exists(file), "{file}\n{}", output.stdout);
    }
    assert!(!repo.exists(".agents"));
    assert!(!repo.exists(".claude"));
    assert_eq!(repo.subjects("HEAD").len(), 1);
    assert_eq!(output.stdout.lines().last(), Some(NEXT));
    assert!(
        !output.stdout.contains("No Uraeda skill"),
        "{}",
        output.stdout
    );
    assert!(
        output.stdout.starts_with("created specs/README.md\n"),
        "{}",
        output.stdout
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn keeps_existing_files() {
    let repo = TestRepo::new();
    repo.write("specs/CONSTITUTION.md", "# Ours\n");

    let output = ura(&repo, &["init"]);

    assert_eq!(repo.read("specs/CONSTITUTION.md"), "# Ours\n");
    assert!(
        output.stdout.contains("kept    specs/CONSTITUTION.md\n"),
        "{}",
        output.stdout
    );
}

#[test]
#[cfg(unix)]
fn leaves_a_committed_skill_alone() {
    let repo = TestRepo::new();
    repo.write(".agents/skills/uraeda/references/plan.md", "old\n");
    let link = repo.path().join(".claude/skills/uraeda");
    symlink(Path::new("../../.agents/skills/uraeda"), &link);

    let output = ura(&repo, &["init"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        fs::read(repo.path().join(".agents/skills/uraeda/references/plan.md")).unwrap(),
        b"old\n"
    );
    assert_eq!(entries(&repo.path().join(".agents/skills/uraeda")), 1);
    assert_eq!(
        fs::read_link(&link).unwrap().to_str(),
        Some("../../.agents/skills/uraeda")
    );
}

#[test]
fn no_skill_is_refused() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["init", "--no-skill"]);

    assert_eq!(output.code, 1);
    assert!(
        output.stderr.contains("unexpected argument '--no-skill'"),
        "{}",
        output.stderr
    );
    assert!(!repo.exists("specs"));
}

#[test]
fn without_a_terminal_names_ura_install() {
    for args in [&["init"][..], &["init", "--no-input"]] {
        let repo = TestRepo::new();

        let output = ura(&repo, args);

        assert_eq!(before_next(&output), Some(NO_SKILL), "{args:?}");
        assert_eq!(entries(&repo.home()), 0, "{args:?}");
        assert_eq!(output.code, 0, "{}", output.stderr);
    }
}

#[test]
#[cfg(unix)]
fn no_line_when_a_skill_exists() {
    // (where, a link or a folder) → no line about the skill.
    let rows: &[(&str, bool)] = &[
        ("home/.claude/skills/uraeda", true),
        ("repo/.agents/skills/uraeda", false),
    ];
    for (place, is_link) in rows {
        let repo = TestRepo::new();
        let path = match place.split_once('/') {
            Some(("home", rest)) => repo.home().join(rest),
            Some((_, rest)) => repo.path().join(rest),
            None => unreachable!(),
        };
        if *is_link {
            let checkout = repo.parent().join("checkout");
            fs::create_dir_all(&checkout).unwrap();
            symlink(&checkout, &path);
        } else {
            fs::create_dir_all(&path).unwrap();
        }

        let output = ura(&repo, &["init"]);

        assert!(
            !output.stdout.contains("skill"),
            "{place}\n{}",
            output.stdout
        );
        assert_eq!(output.stdout.lines().last(), Some(NEXT), "{place}");
        assert_eq!(output.code, 0, "{}", output.stderr);
    }
}

#[test]
fn home_not_set_prints_the_line() {
    let repo = TestRepo::new();
    let unset = ura_without_home(repo.path(), &["init"]);
    fs::remove_dir_all(repo.path().join("specs")).unwrap();
    let empty = ura_in(repo.path(), &["init"], &[("HOME", "")]);

    for output in [unset, empty] {
        assert_eq!(before_next(&output), Some(NO_SKILL));
        assert_eq!(output.code, 0, "{}", output.stderr);
    }
}

#[test]
fn outside_a_repository() {
    let folder = tempfile::TempDir::new().unwrap();

    let output = ura_in(folder.path(), &["init"], &[]);

    assert_eq!(
        output.stderr,
        "ura: not in a git repository: run git init first\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(fs::read_dir(folder.path()).unwrap().count(), 0);
}
