mod common;

use common::*;

const WEB_UI: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n";

/// A repository where the given features were finished on their branches and merged into `main`,
/// their branches kept.
fn repo_with_merged(folders: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    for folder in folders {
        feature(&repo, folder, &[("proposal.md", proposal())]);
        finish_and_merge(&repo, folder);
    }
    repo
}

fn with_worktree(repo: &TestRepo, branch: &str) {
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        &format!(".worktrees/{branch}"),
        branch,
    ]);
}

/// US3.1
#[test]
fn cleans_one_merged_feature() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  removed the worktree .worktrees/2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(!repo.exists(WORKTREE));
}

/// US3.2
#[test]
fn reports_a_worktree_with_untracked_files() {
    let repo = repo_with_merged(&[WEB_UI]);
    with_worktree(&repo, WEB_UI);
    repo.write(&format!("{WORKTREE}/notes.txt"), "notes");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the worktree .worktrees/2026-10-11-web-ui: it has uncommitted or untracked files. Commit or\n  remove them, then run ura clean again\n  left the branch 2026-10-11-web-ui: its worktree is still there\n"
    );
    assert_eq!(output.code, 1);
}

/// US3.3
#[test]
fn reports_commits_the_default_branch_lacks() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);
    for n in 1..=2 {
        repo.write(&format!("more-{n}.txt"), "more");
        repo.commit("more");
    }
    repo.switch("main");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: 2 commits are not on main. Delete it with git branch -D\n  2026-10-11-web-ui if they are not needed\n"
    );
    assert_eq!(output.code, 1);

    repo.push("main");

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: 2 commits are on neither main nor origin/main. Delete it with\n  git branch -D 2026-10-11-web-ui if they are not needed\n"
    );
}

/// US3.5
#[test]
fn reports_the_checkout_on_the_branch() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.switch(WEB_UI);

    let output = ura(&repo, &["clean", "web-ui"]);

    assert_eq!(
        output.stdout,
        "2026-10-11-web-ui\n  left the branch 2026-10-11-web-ui: your checkout is on it. Switch it to main, then run ura clean\n  again\n"
    );
    assert_eq!(output.code, 1);
}

/// US3.6
#[test]
fn several_candidates_need_a_target_or_all() {
    let repo = repo_with_merged(&["2026-10-10-cli-core", WEB_UI]);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stderr,
        "ura: 2 merged features have a worktree, a branch, or a line of the priorities left: name one, or pass --all\n  2026-10-10-cli-core\n  2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 1);
    assert!(repo.git(&["branch", "--list", WEB_UI]).contains(WEB_UI));
}

/// US3.6
#[test]
fn a_dry_run_with_all_prints_what_it_would_do() {
    let repo = repo_with_merged(&["2026-10-10-cli-core", WEB_UI]);
    with_worktree(&repo, WEB_UI);

    let output = ura(&repo, &["clean", "--all", "--dry-run"]);

    assert_eq!(
        output.stdout,
        "2026-10-10-cli-core\n  would delete the branch 2026-10-10-cli-core\n2026-10-11-web-ui\n  would remove the worktree .worktrees/2026-10-11-web-ui\n  would delete the branch 2026-10-11-web-ui\n"
    );
    assert_eq!(output.code, 0);
    assert!(repo.exists(WORKTREE));
}

/// US3.7
#[test]
fn refuses_a_feature_not_merged() {
    let repo = repo_with_merged(&[]);
    feature(
        &repo,
        "2026-10-12-finish-feature",
        &[("proposal.md", proposal())],
    );

    let output = ura(&repo, &["clean", "finish-feature"]);

    assert_eq!(
        output.stderr,
        "ura: 2026-10-12-finish-feature is not merged: only merged features are cleaned\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn nothing_to_clean() {
    let repo = repo_with_merged(&[WEB_UI]);
    repo.delete_branch(WEB_UI);

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stdout,
        "Nothing to clean: no merged feature has a worktree, a branch, or a line of the priorities left.\n"
    );
    assert_eq!(output.code, 0);
}

/// A repository where `folder`, a feature or a change (`change/<folder>`), was finished on its
/// branch and merged into `main`, its branch kept, and `priorities` lists it.
fn repo_with_merged_line(folder: &str, priorities: &str) -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, priorities);
    feature(&repo, folder, &[("proposal.md", proposal())]);
    let (kind, done) = match folder.strip_prefix("change/") {
        Some(change) => ("change", change),
        None => ("feature", folder),
    };
    repo.switch(folder);
    repo.git(&["rm", "-r", "--quiet", &feature_path(folder)]);
    repo.write(&format!("specs/done/{done}.md"), &record(kind, "Web UI"));
    repo.commit(&format!("finish: {folder}"));
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", folder]);
    repo
}

/// A row of `clean_removes_the_merged_line`: the merged folder, `ura clean`'s target, its line in
/// Now, whether `PRIORITIES.md` is edited first, then what `ura clean` prints, the priorities after,
/// and the subject of the commit it adds to `main`, if any.
struct Row {
    folder: &'static str,
    target: &'static str,
    line: &'static str,
    edited: bool,
    stdout: &'static str,
    after: String,
    subject: Option<&'static str>,
}

/// US1.3, and more scenarios 2 and 3
#[test]
fn clean_removes_the_merged_line() {
    const NOW: &str = "# Priorities\n\n## Now\n\n";
    const REST: &str = "- Other thing\n\n## Next\n\n## Later\n\n## Blocked\n";
    let feature_line = "- [Web UI](2026-10-11-web-ui/proposal.md)\n";
    let change_line = "- [Fix the bug](/specs/changes/2026-10-14-fix-bug/proposal.md)\n";
    let without = format!("{NOW}{REST}");
    let rows = [
        Row {
            folder: WEB_UI,
            target: "web-ui",
            line: feature_line,
            edited: false,
            stdout: "2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n  removed \"Web UI\" from the priorities\n",
            after: without.clone(),
            subject: Some("chore(web-ui): remove \"Web UI\" from the priorities"),
        },
        Row {
            folder: "change/2026-10-14-fix-bug",
            target: "fix-bug",
            line: change_line,
            edited: false,
            stdout: "change/2026-10-14-fix-bug\n  deleted the branch change/2026-10-14-fix-bug\n  removed \"Fix the bug\" from the priorities\n",
            after: without.clone(),
            subject: Some("chore(fix-bug): remove \"Fix the bug\" from the priorities"),
        },
        Row {
            folder: WEB_UI,
            target: "web-ui",
            line: feature_line,
            edited: true,
            stdout: "2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n  removed \"Web UI\" from the priorities\n  PRIORITIES.md had uncommitted changes: the line is removed but not committed.\n",
            after: format!("{NOW}{REST}- Edited\n"),
            subject: None,
        },
        Row {
            folder: WEB_UI,
            target: "web-ui",
            line: "",
            edited: false,
            stdout: "2026-10-11-web-ui\n  removed the worktree .worktrees/2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n",
            after: without.clone(),
            subject: None,
        },
    ];
    for Row {
        folder,
        target,
        line,
        edited,
        stdout,
        after,
        subject,
    } in rows
    {
        let repo = repo_with_merged_line(folder, &format!("{NOW}{line}{REST}"));
        let with_worktree_left = line.is_empty();
        if with_worktree_left {
            with_worktree(&repo, folder);
        }
        if edited {
            let text = repo.read("specs/PRIORITIES.md");
            repo.write("specs/PRIORITIES.md", &format!("{text}- Edited\n"));
        }
        let before = repo.subjects("main");

        let output = ura(&repo, &["clean", target]);

        assert_eq!(output.stdout, stdout, "{folder}: {}", output.stderr);
        assert_eq!(output.code, 0, "{folder}: {}", output.stderr);
        assert_eq!(repo.read("specs/PRIORITIES.md"), after, "{folder}");
        let subjects = repo.subjects("main");
        match subject {
            Some(subject) => {
                assert_eq!(subjects[0], subject, "{folder}");
                assert_eq!(subjects[1..], before[..], "{folder}");
                assert_eq!(repo.porcelain(), "", "{folder}");
            }
            None => assert_eq!(subjects, before, "{folder}"),
        }
        assert!(!repo.exists(&format!(".worktrees/{folder}")), "{folder}");
    }
}

/// US1.3: a merged feature whose line is still in the priorities has something to clean.
#[test]
fn a_merged_line_alone_is_something_to_clean() {
    let repo = repo_with_merged_line(
        WEB_UI,
        "# Priorities\n\n## Now\n\n- [Web UI](2026-10-11-web-ui/proposal.md)\n\n## Next\n",
    );
    repo.delete_branch(WEB_UI);

    let dry = ura(&repo, &["clean", "--dry-run"]);
    assert_eq!(
        dry.stdout, "2026-10-11-web-ui\n  would remove \"Web UI\" from the priorities\n",
        "{}",
        dry.stderr
    );

    let output = ura(&repo, &["clean"]);

    assert_eq!(
        output.stdout, "2026-10-11-web-ui\n  removed \"Web UI\" from the priorities\n",
        "{}",
        output.stderr
    );
    assert_eq!(
        repo.read("specs/PRIORITIES.md"),
        "# Priorities\n\n## Now\n\n## Next\n"
    );
    assert_eq!(
        ura(&repo, &["clean"]).stdout,
        "Nothing to clean: no merged feature has a worktree, a branch, or a line of the priorities left.\n"
    );
}
