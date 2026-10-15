mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::files::preview::Preview;

const PREVIEW: &str = "specs/decisions/preview.md";
const BRANCH: &str = "2026-10-20-sidebar-resize";

fn decision(status: &str, command: &str) -> String {
    format!(
        "---\nstatus: {status}\napproved-by: me\npreview-folder: packages/web\n\
         preview-command: {command}\n---\n\n# Preview\n"
    )
}

fn web(command: &str) -> Option<Preview> {
    Some(Preview {
        folder: "packages/web".into(),
        command: command.into(),
    })
}

/// The runner starts only the command of an active decision, with both fields valid.
#[test]
fn a_checkout_has_a_preview_only_from_its_active_decision() {
    let command = "pnpm exec storybook dev --port {port}";
    let rows: &[(&str, Option<String>, Option<Preview>)] = &[
        ("active", Some(decision("active", command)), web(command)),
        ("proposed", Some(decision("proposed", command)), None),
        (
            "no {port}",
            Some(decision("active", "pnpm exec storybook dev")),
            None,
        ),
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
    repo.add_on_branch(BRANCH, PREVIEW, &decision("active", command));
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
