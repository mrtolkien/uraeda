//! The sample project's `origin`: a bare repository beside it, with a commit to pull and one to
//! push, and its branches brought up to date with `main`, as GitHub's "Update branch" does; and
//! two changes left uncommitted in the main checkout.

use std::fs;

use super::git::{Commit, Repo, git_in, text};

/// Merges `main` into a branch, as GitHub's "Update branch" does.
pub(super) fn merge_main(repo: &Repo, branch: &str) -> Result<(), String> {
    let worktree = repo.path.join(".git").join("sandbox-merge");
    let folder = worktree.to_string_lossy().into_owned();
    repo.git(&["worktree", "add", "--quiet", &folder, branch])?;
    let merged = git_in(
        &worktree,
        &["merge", "--quiet", "--no-verify", "--no-edit", "main"],
        None,
    );
    repo.git(&["worktree", "remove", "--force", &folder])?;
    merged.map(drop)
}

/// `origin`, a bare repository beside the project: one commit to pull, and one to push, each
/// changing the same line, so a pull stops on a conflict.
pub(super) fn origin(repo: &Repo) -> Result<(), String> {
    let parent = repo
        .path
        .parent()
        .ok_or("the project has no parent folder")?;
    let origin = parent.join("sample-origin.git");
    let upstream = parent.join(".sample-upstream");
    let (origin_text, upstream_text) = (origin.to_string_lossy(), upstream.to_string_lossy());
    git_in(
        parent,
        &[
            "init",
            "--quiet",
            "--bare",
            "--initial-branch",
            "main",
            &origin_text,
        ],
        None,
    )?;
    repo.git(&["remote", "add", "origin", &origin_text])?;
    repo.git(&[
        "push",
        "--quiet",
        "--no-verify",
        "--set-upstream",
        "origin",
        "main",
    ])?;
    git_in(
        parent,
        &["clone", "--quiet", &origin_text, &upstream_text],
        None,
    )?;
    let other = Repo {
        path: upstream.clone(),
    };
    change_priority(
        &other,
        "- Claude Code runner (triggered from the web UI)",
        "docs: the runner is triggered from the web UI",
    )?;
    other.git(&["push", "--quiet", "--no-verify", "origin", "main"])?;
    fs::remove_dir_all(&upstream).map_err(|error| error.to_string())?;
    repo.git(&["fetch", "--quiet", "origin"])?;
    change_priority(
        repo,
        "- Claude Code runner (triggered by a git hook)",
        "chore: the runner is triggered by a git hook",
    )
}

/// Writes a line of `NOTES.md` in a checkout of `main`, and commits it: the sample's own commit
/// and its `origin`'s each write one.
fn change_priority(repo: &Repo, line: &str, message: &str) -> Result<(), String> {
    let files = vec![text("NOTES.md", format!("{line}\n"))];
    repo.commits("main", vec![Commit::new(message, None, files)])
}

/// Two changes left in the main checkout, for the Git page: a file changed, and one new.
pub(super) fn uncommitted(repo: &Repo) -> Result<(), String> {
    let readme = repo.path.join("specs/README.md");
    let read = fs::read_to_string(&readme).map_err(|error| error.to_string())?;
    let written =
        format!("{read}\nEach feature has a folder of its own, named by its date and slug.\n");
    fs::write(&readme, written).map_err(|error| error.to_string())?;
    let notes = repo.path.join("notes");
    fs::create_dir_all(&notes).map_err(|error| error.to_string())?;
    let standup = "# Standup\n\n- Snooze times: spec approved, waiting for a start.\n- Due dates: the spec's status is misspelt.\n";
    fs::write(notes.join("standup.md"), standup).map_err(|error| error.to_string())
}
