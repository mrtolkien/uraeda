mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::preview::Preview;

const PREVIEW: &str = "specs/decisions/preview.md";
const BRANCH: &str = "2026-10-20-sidebar-resize";

fn decision(command: &str) -> String {
    format!("---\npreview-folder: packages/web\npreview-command: {command}\n---\n\n# Preview\n")
}

fn web(command: &str) -> Option<Preview> {
    Some(Preview {
        folder: "packages/web".into(),
        command: command.into(),
    })
}

/// The runner starts only the command of a decision with both fields valid.
#[test]
fn a_checkout_has_a_preview_only_from_a_valid_decision() {
    let command = "pnpm exec storybook dev --port {port}";
    let rows: &[(&str, Option<String>, Option<Preview>)] = &[
        ("valid", Some(decision(command)), web(command)),
        ("no {port}", Some(decision("pnpm exec storybook dev")), None),
        ("no file", None, None),
    ];
    for (case, text, expected) in rows {
        let repo = TestRepo::new();
        if let Some(text) = text {
            repo.write(PREVIEW, text);
        }

        assert_eq!(&api::preview(repo.path()).unwrap(), expected, "{case}");
    }
}

/// A worktree's preview comes from its own copy of the decision, not the main checkout's.
#[test]
fn a_worktree_reads_its_own_copy() {
    let command = "x --port {port}";
    let repo = TestRepo::new();
    repo.branch(BRANCH);
    repo.add_on_branch(BRANCH, PREVIEW, &decision(command));
    let worktree = repo.path().join(".worktrees").join(BRANCH);
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        BRANCH,
    ]);

    assert_eq!(api::preview(&worktree).unwrap(), web(command));
    assert_eq!(api::preview(repo.path()).unwrap(), None);
}

/// A preview starts again once its checkout's commit moves: each checkout has its own.
#[test]
fn a_checkout_commit_is_its_own_and_moves_with_a_commit() {
    let repo = TestRepo::new();
    repo.branch(BRANCH);
    let worktree = repo.path().join(".worktrees").join(BRANCH);
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        BRANCH,
    ]);
    let main = api::checkout_commit(repo.path()).unwrap();
    let before = api::checkout_commit(&worktree).unwrap();

    let dir = worktree.to_str().unwrap();
    repo.git(&[
        "-C",
        dir,
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "chore: a commit",
    ]);

    let after = api::checkout_commit(&worktree).unwrap();
    assert_eq!(before, main);
    assert_ne!(after, before);
    assert_eq!(after.as_deref().map(str::len), Some(40));
    assert_eq!(api::checkout_commit(repo.path()).unwrap(), main);
}

/// A commit's files, as paths and texts.
type Files = &'static [(&'static str, &'static str)];

/// A Storybook restarts only for a commit outside `specs/`.
#[test]
fn a_code_version_moves_only_outside_specs() {
    let rows: &[(&str, Files, bool)] = &[
        (
            "specs only",
            &[("specs/x/clarifications-01.md", "answered")],
            false,
        ),
        ("code", &[("packages/web/src/A.tsx", "a")], true),
        (
            "both",
            &[
                ("specs/x/spec.md", "s"),
                ("packages/web/.storybook/main.ts", "m"),
            ],
            true,
        ),
    ];
    for (case, files, moves) in rows {
        let repo = TestRepo::new();
        let before = api::code_version(repo.path()).unwrap();
        for (path, text) in *files {
            repo.write(path, text);
        }
        repo.commit("chore: a commit");
        let after = api::code_version(repo.path()).unwrap();
        assert!(before.is_some(), "{case}");
        assert_eq!(before != after, *moves, "{case}");
    }
}
