//! The files a feature's branch changed, from the default branch's merge base to its tip.

mod common;

use std::time::{Duration, Instant};

use common::repo::TestRepo;
use common::texts::{proposal, record};
use uraeda_core::changes::{BranchChanges, ChangedFile, branch_changes};

const FOLDER: &str = "2026-10-14-session-view";
const CHANGE: &str = "2026-10-13-x";

/// A repository on `main`, with the feature's branch holding its committed proposal.
fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(&format!("specs/{FOLDER}/proposal.md"), &proposal());
    repo.commit("proposal");
    repo.switch("main");
    repo
}

/// `count` numbered lines.
fn lines(count: usize, word: &str) -> String {
    (1..=count).map(|n| format!("{word} {n}\n")).collect()
}

/// Commits files on a branch, and comes back to `main`.
fn on_branch(repo: &TestRepo, branch: &str, files: &[(&str, &str)]) {
    repo.switch(branch);
    for (path, text) in files {
        repo.write(path, text);
    }
    repo.commit("work");
    repo.switch("main");
}

/// `src/fNN.rs`, one line each, for `count` files.
fn many(repo: &TestRepo, count: usize) {
    repo.switch(FOLDER);
    for n in 0..count {
        repo.write(&format!("src/f{n:02}.rs"), "fn f() {}\n");
    }
    repo.commit("many files");
    repo.switch("main");
}

fn file(path: &str, added: Option<u32>, removed: Option<u32>) -> ChangedFile {
    ChangedFile {
        path: path.to_string(),
        added,
        removed,
    }
}

fn changes(files: Vec<ChangedFile>, count: u32, added: u32, removed: u32) -> Expected {
    Expected::Changes(BranchChanges {
        files,
        count,
        added,
        removed,
    })
}

enum Expected {
    Changes(BranchChanges),
    Nothing,
    Refused(&'static str),
    /// Refused with git's own message.
    GitFailed,
}

/// Each case builds on [`repo`], and returns the folder asked for.
type Setup = fn(&TestRepo) -> &'static str;

fn code_and_folder(repo: &TestRepo) -> &'static str {
    repo.write("packages/web/src/App.tsx", &lines(19, "old"));
    repo.commit("app");
    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "main"]);
    repo.switch("main");
    let plan = format!("specs/{FOLDER}/plan.md");
    on_branch(
        repo,
        FOLDER,
        &[
            ("crates/core/src/git.rs", &lines(38, "git")),
            ("packages/web/src/App.tsx", &lines(4, "new")),
            (&plan, "# Plan\n"),
        ],
    );
    FOLDER
}

fn only_folder(repo: &TestRepo) -> &'static str {
    let plan = format!("specs/{FOLDER}/plan.md");
    on_branch(repo, FOLDER, &[(&plan, "# Plan\n")]);
    FOLDER
}

fn sixty_files(repo: &TestRepo) -> &'static str {
    many(repo, 60);
    FOLDER
}

fn binary(repo: &TestRepo) -> &'static str {
    on_branch(
        repo,
        FOLDER,
        &[("docs/shot.png", "\u{89}PNG\r\n\u{1a}\n\0\0\0")],
    );
    FOLDER
}

fn renamed(repo: &TestRepo) -> &'static str {
    repo.write("a.txt", &lines(10, "same"));
    repo.commit("a");
    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "main"]);
    repo.git(&["mv", "a.txt", "b.txt"]);
    repo.commit("rename");
    repo.switch("main");
    FOLDER
}

fn code(repo: &TestRepo) -> &'static str {
    on_branch(repo, FOLDER, &[("src/a.rs", "fn a() {}\n")]);
    FOLDER
}

fn main_moves_on(repo: &TestRepo) -> &'static str {
    code(repo);
    repo.write("src/main.rs", "fn main() {}\n");
    repo.commit("main moves on");
    FOLDER
}

fn only_on_origin(repo: &TestRepo) -> &'static str {
    code(repo);
    repo.push(FOLDER);
    repo.delete_branch(FOLDER);
    FOLDER
}

fn change(repo: &TestRepo) -> &'static str {
    repo.switch_new(&format!("change/{CHANGE}"));
    repo.write(&format!("specs/changes/{CHANGE}/proposal.md"), "# Crash\n");
    repo.write("src/fix.rs", "fn fix() {}\n");
    repo.commit("fix");
    repo.switch("main");
    CHANGE
}

fn merged(repo: &TestRepo) -> &'static str {
    code(repo);
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", FOLDER]);
    // A folder on the default branch is its branch's while the branch is there.
    repo.delete_branch(FOLDER);
    FOLDER
}

fn no_branch(repo: &TestRepo) -> &'static str {
    repo.write("specs/2026-10-14-draft/proposal.md", &proposal());
    "2026-10-14-draft"
}

fn uncommitted(repo: &TestRepo) -> &'static str {
    code(repo);
    let worktree = repo.parent().join("worktree");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        FOLDER,
    ]);
    std::fs::write(worktree.join("src/a.rs"), "fn a() {}\nfn b() {}\n").unwrap();
    std::fs::write(worktree.join("src/c.rs"), "fn c() {}\n").unwrap();
    FOLDER
}

fn default_unknown(repo: &TestRepo) -> &'static str {
    code(repo);
    repo.git(&["branch", "--quiet", "-m", "main", "trunk"]);
    // The core reads the user's global git config, where `init.defaultBranch` could name `trunk`:
    // the repository's own value, naming no branch, overrides it.
    repo.git(&["config", "init.defaultBranch", "none"]);
    FOLDER
}

fn unknown_folder(_: &TestRepo) -> &'static str {
    "2026-10-14-nope"
}

/// The feature finished on its branch: its folder replaced by its record, and another record of
/// `specs/done/` changed beside it.
fn finished(repo: &TestRepo) -> &'static str {
    repo.switch(FOLDER);
    // `git rm`, unlike removing the file, also removes its folder from the disk.
    let proposal = format!("specs/{FOLDER}/proposal.md");
    repo.git(&["rm", "--quiet", &proposal]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Session view"),
    );
    repo.write("specs/done/2026-10-01-other.md", "# Other\n");
    repo.write("src/a.rs", "fn a() {}\n");
    repo.commit("finish");
    repo.switch("main");
    FOLDER
}

/// A file of the feature's folder at the merge base, moved to `src/` on the branch. `main` drops
/// the folder afterwards, so the feature is not merged.
fn moved_out(repo: &TestRepo) -> &'static str {
    let notes = format!("specs/{FOLDER}/notes.txt");
    repo.write(&notes, &lines(10, "note"));
    repo.commit("notes");
    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "main"]);
    std::fs::create_dir_all(repo.path().join("src")).unwrap();
    repo.git(&["mv", &notes, "src/notes.txt"]);
    repo.commit("move out");
    repo.switch("main");
    repo.git(&["rm", "--quiet", "-r", &format!("specs/{FOLDER}")]);
    repo.commit("drop the folder");
    FOLDER
}

/// A file of `main` moved into the feature's folder.
fn moved_in(repo: &TestRepo) -> &'static str {
    repo.write("src/old.txt", &lines(10, "old"));
    repo.commit("old");
    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "main"]);
    repo.git(&["mv", "src/old.txt", &format!("specs/{FOLDER}/old.txt")]);
    repo.commit("move in");
    repo.switch("main");
    FOLDER
}

/// A feature branch with no history in common with `main`: git finds no merge base.
fn orphan(repo: &TestRepo) -> &'static str {
    repo.git(&["switch", "--quiet", "--orphan", "2026-10-14-orphan"]);
    repo.write("specs/2026-10-14-orphan/proposal.md", &proposal());
    repo.commit("orphan");
    repo.switch("main");
    "2026-10-14-orphan"
}

/// The cases of what the feature's own files are.
fn own_files_cases() -> Vec<(&'static str, Setup, Expected)> {
    vec![
        (
            "the feature finished on its branch",
            finished,
            changes(
                vec![
                    file("specs/done/2026-10-01-other.md", Some(1), Some(0)),
                    file("src/a.rs", Some(1), Some(0)),
                ],
                2,
                2,
                0,
            ),
        ),
        (
            "a file moved out of the feature's folder",
            moved_out,
            changes(vec![file("src/notes.txt", Some(0), Some(0))], 1, 0, 0),
        ),
        (
            "a file moved into the feature's folder",
            moved_in,
            changes(vec![], 0, 0, 0),
        ),
        ("no merge base", orphan, Expected::GitFailed),
    ]
}

fn cases() -> Vec<(&'static str, Setup, Expected)> {
    let a = || vec![file("src/a.rs", Some(1), Some(0))];
    vec![
        (
            "code and the feature's folder changed",
            code_and_folder,
            changes(
                vec![
                    file("crates/core/src/git.rs", Some(38), Some(0)),
                    file("packages/web/src/App.tsx", Some(4), Some(19)),
                ],
                2,
                42,
                19,
            ),
        ),
        (
            "only the feature's folder changed",
            only_folder,
            changes(vec![], 0, 0, 0),
        ),
        (
            "60 files changed",
            sixty_files,
            changes(
                (0..50)
                    .map(|n| file(&format!("src/f{n:02}.rs"), Some(1), Some(0)))
                    .collect(),
                60,
                60,
                0,
            ),
        ),
        (
            "a binary file",
            binary,
            changes(vec![file("docs/shot.png", None, None)], 1, 0, 0),
        ),
        (
            "a renamed file",
            renamed,
            changes(vec![file("b.txt", Some(0), Some(0))], 1, 0, 0),
        ),
        (
            "a commit on main after the branch started",
            main_moves_on,
            changes(a(), 1, 1, 0),
        ),
        (
            "the branch only on origin",
            only_on_origin,
            changes(a(), 1, 1, 0),
        ),
        (
            "a change's branch, with a slash",
            change,
            changes(vec![file("src/fix.rs", Some(1), Some(0))], 1, 1, 0),
        ),
        ("the feature merged into main", merged, Expected::Nothing),
        (
            "a dated folder with no branch, no item (R7)",
            no_branch,
            Expected::Refused("no feature 2026-10-14-draft"),
        ),
        (
            "uncommitted code in the feature's worktree",
            uncommitted,
            changes(a(), 1, 1, 0),
        ),
        (
            "the default branch unknown",
            default_unknown,
            Expected::Nothing,
        ),
        (
            "an unknown folder",
            unknown_folder,
            Expected::Refused("no feature 2026-10-14-nope"),
        ),
    ]
}

#[test]
fn branch_changes_lists_the_files_changed_outside_the_feature() {
    for (name, setup, expected) in cases().into_iter().chain(own_files_cases()) {
        let repo = repo();
        let folder = setup(&repo);
        let found = branch_changes(repo.path(), folder);
        match expected {
            Expected::Changes(expected) => assert_eq!(found, Ok(Some(expected)), "{name}"),
            Expected::Nothing => assert_eq!(found, Ok(None), "{name}"),
            Expected::Refused(message) => {
                let error = found.expect_err(name);
                assert_eq!(
                    (error.code, error.message.as_str()),
                    ("refused", message),
                    "{name}"
                );
            }
            Expected::GitFailed => {
                let error = found.expect_err(name);
                assert_eq!(error.code, "refused", "{name}");
                assert!(
                    error.message.starts_with("git diff failed: "),
                    "{name}: {error}"
                );
            }
        }
    }
}

/// SC-005, a benchmark run by hand:
/// `cargo test --release -p uraeda-core --test branch_changes -- --ignored`.
#[test]
#[ignore = "a benchmark of SC-005, run by hand in release"]
fn branch_changes_takes_under_100_ms() {
    let repo = repo();
    many(&repo, 60);

    let start = Instant::now();
    let found = branch_changes(repo.path(), FOLDER).unwrap().unwrap();
    let took = start.elapsed();

    assert_eq!(found.count, 60);
    assert!(took < Duration::from_millis(100), "took {took:?}");
}
