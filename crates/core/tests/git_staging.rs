//! Staging, committing, and discarding the files the Git page names, and nothing else.

mod common;

use common::repo::TestRepo;
use uraeda_core::git::{Git, GitError};

/// A repository with `specs/INBOX.md`, `specs/PRIORITIES.md`, and `docs/web-ui.md` committed,
/// then all three changed.
fn changed_files() -> TestRepo {
    let repo = TestRepo::new();
    for path in ["specs/INBOX.md", "specs/PRIORITIES.md", "docs/web-ui.md"] {
        repo.write(path, "# Base\n");
    }
    repo.commit("chore: files");
    for path in ["specs/INBOX.md", "specs/PRIORITIES.md", "docs/web-ui.md"] {
        repo.write(path, "# Changed\n");
    }
    repo
}

fn paths(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|path| path.to_string()).collect()
}

fn refusal(result: Result<(), GitError>) -> String {
    match result {
        Err(GitError::Refused(text)) => text,
        other => panic!("not refused: {other:?}"),
    }
}

/// US3 1, 2, more 3; Review focus 1 and 2. Breaks: `git add -A` without the paths, which stages
/// the other files too; a path outside the checkout passed on to git.
#[test]
fn staging_moves_only_the_named_files() {
    let repo = changed_files();
    repo.write("notes/a b ü.md", "A note\n");
    std::fs::write(repo.parent().join("outside"), "Not the repository's\n").unwrap();
    let git = Git::discover(repo.path()).unwrap();

    git.stage_paths(&paths(&["specs/INBOX.md"])).unwrap();
    assert_eq!(repo.staged(), ["specs/INBOX.md"]);

    git.stage_paths(&paths(&["specs"])).unwrap();
    assert_eq!(repo.staged(), ["specs/INBOX.md", "specs/PRIORITIES.md"]);

    git.unstage_paths(&paths(&["specs/INBOX.md", "specs/PRIORITIES.md"]))
        .unwrap();
    assert!(repo.staged().is_empty());

    git.stage_paths(&paths(&["notes/a b ü.md"])).unwrap();
    assert_eq!(repo.staged(), ["notes/a b ü.md"]);

    let before = repo.porcelain();
    for path in ["../outside", "/etc/passwd"] {
        let refused = format!("{path} is not in this checkout.");
        assert_eq!(refusal(git.stage_paths(&paths(&[path]))), refused);
        assert_eq!(refusal(git.discard_path(path)), refused);
    }
    assert_eq!(repo.porcelain(), before);
    assert!(repo.parent().join("outside").exists());
}

/// US3 3, more 6; Review focus 5. Breaks: `--no-verify`, which skips the hook; `git commit -a`,
/// which takes `docs/web-ui.md` along.
#[test]
fn a_commit_holds_the_staged_files_through_the_hooks() {
    let repo = changed_files();
    let git = Git::discover(repo.path()).unwrap();
    git.stage_paths(&paths(&["specs/INBOX.md"])).unwrap();

    let committed = git.commit_index("chore: notes", None).unwrap();

    assert_eq!(
        repo.git(&["rev-parse", "HEAD"]).trim(),
        committed.to_string()
    );
    assert_eq!(repo.subjects("HEAD")[0], "chore: notes");
    assert_eq!(repo.changed_in("HEAD"), ["specs/INBOX.md"]);
    assert_eq!(repo.hook_runs(), 1);

    repo.set_hook("echo 'refused by the hook'; exit 1");
    git.stage_paths(&paths(&["specs/PRIORITIES.md"])).unwrap();
    let head = repo.git(&["rev-parse", "HEAD"]);
    let refused = git.commit_index("chore: priorities", None).unwrap_err();
    assert!(
        refused.to_string().contains("git commit failed"),
        "{refused}"
    );
    assert_eq!(repo.staged(), ["specs/PRIORITIES.md"]);
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);

    let empty = git.commit_index("  \n", None).map(drop);
    assert_eq!(refusal(empty), "Write a commit message first.");
    git.unstage_paths(&paths(&["specs/PRIORITIES.md"])).unwrap();
    let nothing = git.commit_index("chore: nothing", None).map(drop);
    assert_eq!(refusal(nothing), "Nothing is staged.");
    assert_eq!(repo.git(&["rev-parse", "HEAD"]), head);
}

/// US3 more 4; edge "Discard of an untracked file"; Review focus 4: each row restores or deletes
/// its file alone. Break: `git checkout -- .`, which restores `docs/web-ui.md` too.
#[test]
fn discard_restores_one_file_as_git_does() {
    type Arrange = fn(&TestRepo);
    let rows: [(&str, Arrange); 3] = [
        ("specs/INBOX.md", |repo| {
            repo.git(&["add", "specs/INBOX.md"]);
            repo.write("specs/INBOX.md", "# Changed again\n");
        }),
        ("notes/new note.md", |repo| {
            repo.write("notes/new note.md", "A note\n")
        }),
        ("notes/staged.md", |repo| {
            repo.write("notes/staged.md", "Staged\n");
            repo.git(&["add", "notes/staged.md"]);
        }),
    ];
    for (path, arrange) in rows {
        let repo = changed_files();
        arrange(&repo);

        Git::discover(repo.path())
            .unwrap()
            .discard_path(path)
            .unwrap();

        let status = repo.git(&["status", "--porcelain", "--", path]);
        assert_eq!(status, "", "{path}");
        if path == "specs/INBOX.md" {
            assert_eq!(repo.read(path), "# Base\n");
        } else {
            assert!(!repo.exists(path), "{path}");
        }
        assert_eq!(repo.read("docs/web-ui.md"), "# Changed\n", "{path}");
    }
}

/// Review focus 4: discard takes one file, never a folder or a conflict. Breaks: checking out a
/// folder `HEAD` has, which wipes every edit under it; prefix-matching the index for a folder
/// `HEAD` lacks, which unstages its files and then fails to delete it; checking out `HEAD` over a
/// conflicted file, which takes a side unasked.
#[test]
fn discard_refuses_a_folder_and_a_conflict() {
    let repo = changed_files();
    repo.write("notes/staged.md", "Staged\n");
    repo.git(&["add", "notes/staged.md"]);
    let git = Git::discover(repo.path()).unwrap();

    for folder in ["docs", "notes"] {
        let refused = format!("{folder} is a folder: discard its files one by one.");
        assert_eq!(refusal(git.discard_path(folder)), refused);
    }
    assert_eq!(repo.read("docs/web-ui.md"), "# Changed\n");
    assert_eq!(repo.staged(), ["notes/staged.md"]);

    let repo = TestRepo::new();
    repo.stopped_merge();
    let before = repo.read("specs/PRIORITIES.md");
    let git = Git::discover(repo.path()).unwrap();

    let refused = refusal(git.discard_path("specs/PRIORITIES.md"));

    assert_eq!(refused, "specs/PRIORITIES.md conflicts: take a side.");
    assert_eq!(repo.read("specs/PRIORITIES.md"), before);
    assert_eq!(repo.unmerged(), ["specs/PRIORITIES.md"]);
}

/// Review focus 1 and 4: a path names one file, inside the checkout. Breaks: dropping
/// `--literal-pathspecs`, so `*.md` stages every Markdown file; discarding a file git ignores,
/// which deletes `.env`; following a symbolic link to a folder outside the checkout.
#[test]
fn a_path_names_one_file_of_this_checkout() {
    let repo = changed_files();
    repo.write("*.md", "A star\n");
    repo.write(".gitignore", ".env\n");
    repo.write(".env", "SECRET=1\n");
    std::os::unix::fs::symlink(repo.parent(), repo.path().join("up")).unwrap();
    std::fs::write(repo.parent().join("outside.md"), "Not the repository's\n").unwrap();
    let git = Git::discover(repo.path()).unwrap();

    git.stage_paths(&paths(&["*.md"])).unwrap();
    assert_eq!(repo.staged(), ["*.md"]);

    assert_eq!(
        refusal(git.discard_path(".env")),
        ".env has no changes to discard."
    );
    assert_eq!(repo.read(".env"), "SECRET=1\n");

    let refused = "up/outside.md is not in this checkout.";
    assert_eq!(
        refusal(git.stage_paths(&paths(&["up/outside.md"]))),
        refused
    );
    assert_eq!(refusal(git.discard_path("up/outside.md")), refused);
    assert!(repo.parent().join("outside.md").exists());
}
