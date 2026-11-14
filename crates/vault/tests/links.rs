//! The links of a real repository: its main checkout's constitution and decisions, and the feature
//! folder of a worktree, which goes when the worktree does. Only tests run git.

use std::fs;
use std::path::Path;
use std::process::Command;

use uraeda_vault::Vault;
use uraeda_vault::links::{self, Link};

const FOLDER: &str = "2026-10-10-recurring-tasks";

fn git(dir: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn links_follow_the_worktrees() {
    let dir = tempfile::tempdir().unwrap();
    let base = fs::canonicalize(dir.path()).unwrap();
    let main = base.join("todo");
    fs::create_dir_all(main.join("specs/decisions")).unwrap();
    git(&main, &["init", "--quiet", "--initial-branch", "main"]);
    fs::write(main.join("specs/CONSTITUTION.md"), "# Constitution\n").unwrap();
    fs::write(main.join("specs/decisions/stack.md"), "# Stack\n").unwrap();
    // A folder committed on the default branch: every branch inherits it, none works on it.
    fs::create_dir_all(main.join("specs/changes/2026-09-02-old")).unwrap();
    fs::write(
        main.join("specs/changes/2026-09-02-old/proposal.md"),
        "# Old\n",
    )
    .unwrap();
    git(&main, &["add", "."]);
    git(&main, &["commit", "--quiet", "-m", "chore: start"]);
    let worktree = base.join("todo-recurring");
    git(
        &main,
        &[
            "worktree",
            "add",
            "--quiet",
            "-b",
            "light",
            worktree.to_str().unwrap(),
        ],
    );
    // The branch's name says nothing of its folders, and a merged one has its record.
    fs::create_dir_all(worktree.join("specs/2026-09-01-merged")).unwrap();
    fs::create_dir_all(worktree.join("specs/done")).unwrap();
    fs::write(
        worktree.join("specs/done/2026-09-01-merged.md"),
        "# Merged\n",
    )
    .unwrap();
    fs::create_dir_all(worktree.join("specs").join(FOLDER)).unwrap();
    fs::write(
        worktree.join("specs").join(FOLDER).join("proposal.md"),
        "# Recurring\n",
    )
    .unwrap();
    git(&worktree, &["add", "."]);
    git(&worktree, &["commit", "--quiet", "-m", "chore: proposal"]);

    let found = links::of_repository(&main).unwrap();
    let names: Vec<&str> = found.iter().map(|l| l.name.as_str()).collect();
    assert_eq!(names, ["CONSTITUTION.md", "decisions", FOLDER]);
    assert!(found.contains(&Link {
        name: FOLDER.into(),
        target: worktree.join("specs").join(FOLDER)
    }));

    let vault = Vault::new(base.join("Uraeda"));
    links::apply(&vault, "todo", &found).unwrap();
    let specs = links::folder(&vault, "todo");
    assert_eq!(
        fs::read_to_string(specs.join(FOLDER).join("proposal.md")).unwrap(),
        "# Recurring\n"
    );
    assert_eq!(
        fs::read_to_string(specs.join("decisions/stack.md")).unwrap(),
        "# Stack\n"
    );

    git(
        &main,
        &["worktree", "remove", "--force", worktree.to_str().unwrap()],
    );
    let found = links::of_repository(&main).unwrap();
    links::apply(&vault, "todo", &found).unwrap();
    assert!(fs::symlink_metadata(specs.join(FOLDER)).is_err());
    assert!(specs.join("CONSTITUTION.md").is_file());
}
