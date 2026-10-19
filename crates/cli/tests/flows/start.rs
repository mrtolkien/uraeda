//! A line of the priorities becomes a draft, a draft becomes a feature or a change in its own
//! worktree, and a repository joins the web UI's list: each through the command, never prompting.

use crate::common::*;

const DRAFT: &str = "specs/drafts/git-listener-process.md";
const PROPOSAL: &str = "specs/2026-10-11-git-listener/proposal.md";
const BRANCH: &str = "2026-10-11-git-listener";
const WORKTREE: &str = ".worktrees/2026-10-11-git-listener";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli/proposal.md)\n\n## Next\n\n- [Git listener process](drafts/git-listener-process.md)\n- Runner\n\n## Later\n\n## Blocked\n";
const DRAFT_TEXT: &str =
    "# Git listener process\n\n## What\n\nListen to pushes.\n\n## Why\n\nTo run agents.\n";

fn repo_with_a_draft() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo.write(DRAFT, DRAFT_TEXT);
    repo.commit("draft");
    repo
}

#[test]
fn a_priorities_line_becomes_a_draft_without_a_terminal_or_an_editor() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- Git listener process\n- Web UI for editing\n- Web UI for viewing\n\n## Later\n\n## Blocked\n",
    );

    let ambiguous = ura(&repo, &["draft", "web ui"]);
    let drafted = ura(&repo, &["draft", "listener"]);

    assert_eq!(ambiguous.code, 1, "two lines match: nothing is drafted");
    assert_eq!(drafted.code, 0, "{}", drafted.stderr);
    assert!(repo.exists(DRAFT));
    assert!(
        repo.read("specs/PRIORITIES.md")
            .contains("(drafts/git-listener-process.md)")
    );
    assert_eq!(
        ura(&repo, &["draft", "listener"]).code,
        1,
        "a line that links a draft is not drafted twice"
    );
}

#[test]
fn a_draft_becomes_a_feature_in_its_own_worktree_and_main_is_not_left() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.current_branch(),
        "main",
        "the checkout is not switched"
    );
    assert_eq!(
        repo.changed_in("main"),
        ["specs/PRIORITIES.md"],
        "main commits the start alone"
    );
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(
        priorities.contains("(/specs/2026-10-11-git-listener/proposal.md)"),
        "{priorities}"
    );
    assert_eq!(
        repo.changed_in(BRANCH),
        [PROPOSAL, DRAFT],
        "the branch moves the draft into its folder"
    );
    assert_eq!(repo.read(&format!("{WORKTREE}/{PROPOSAL}")), DRAFT_TEXT);
    assert_eq!(repo.porcelain(), "");
    assert_eq!(
        repo.hook_runs(),
        2,
        "both commits went through the user's hook"
    );
}

#[test]
fn start_can_switch_the_checkout_and_start_a_change_or_a_postponed_folder() {
    let repo = repo_with_a_draft();
    let switched = ura(&repo, &["start", DRAFT, "--switch"]);
    assert_eq!(switched.code, 0, "{}", switched.stderr);
    assert_eq!(repo.current_branch(), BRANCH);
    assert!(repo.exists(PROPOSAL) && !repo.exists(DRAFT) && !repo.exists(WORKTREE));

    let repo = repo_with_a_draft();
    repo.write(".gitignore", ".DS_Store\n");
    for name in ["proposal.md", "discovery-01.md"] {
        repo.write(
            &format!("specs/backlog/benchmarks/{name}"),
            "# Benchmarks\n\n## What\n\nA.\n\n## Why\n\nB.\n",
        );
    }
    repo.commit("postponed");
    repo.write("specs/backlog/benchmarks/.DS_Store", "x");
    assert_eq!(ura(&repo, &["start", "specs/backlog/benchmarks"]).code, 0);
    let folder = ".worktrees/2026-10-11-benchmarks/specs/2026-10-11-benchmarks";
    assert!(
        repo.exists(&format!("{folder}/proposal.md"))
            && repo.exists(&format!("{folder}/discovery-01.md"))
    );
    assert_eq!(repo.porcelain(), "");

    let repo = repo_with_a_draft();
    assert_eq!(ura(&repo, &["start", DRAFT, "--change"]).code, 0);
    assert!(repo.exists(
        ".worktrees/2026-10-11-git-listener/specs/changes/2026-10-11-git-listener/proposal.md"
    ));
    assert!(
        repo.git(&["branch", "--list", "change/2026-10-11-git-listener"])
            .contains("change/")
    );
}

#[test]
fn a_start_is_refused_before_anything_is_written_when_files_are_staged() {
    let repo = repo_with_a_draft();
    repo.write("other.md", "x\n");
    repo.git(&["add", "other.md"]);
    let before = repo.subjects("main").len();

    let refused = ura(&repo, &["start", DRAFT]);

    assert_eq!(refused.code, 1);
    assert_eq!(repo.subjects("main").len(), before);
    assert_eq!(repo.read("specs/PRIORITIES.md"), PRIORITIES);
    repo.git(&["reset", "--quiet"]);
    assert_eq!(ura(&repo, &["start", DRAFT]).code, 0);
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert_eq!(
        priorities
            .matches("2026-10-11-git-listener/proposal.md")
            .count(),
        1,
        "started once"
    );
}

#[test]
fn a_start_the_hook_refuses_leaves_the_checkout_on_its_branch_and_the_work_to_finish() {
    let repo = repo_with_a_draft();
    repo.switch_new("other");
    repo.set_hook("echo boom >&2; exit 1");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 1);
    assert_eq!(
        repo.current_branch(),
        "other",
        "the human's checkout is not switched"
    );
    assert!(
        repo.read(".worktrees/main/specs/PRIORITIES.md")
            .contains("2026-10-11-git-listener/proposal.md"),
        "what was written is kept for the human to commit"
    );
}

#[test]
fn a_repository_is_added_to_the_list_once_from_any_folder_of_it() {
    let repo = TestRepo::named("todo-app");
    repo.write("src/main.rs", "fn main() {}\n");
    let data = tempfile::TempDir::new().unwrap();
    let env = [("URAEDA_DATA_DIR", data.path().to_str().unwrap())];
    let elsewhere = tempfile::TempDir::new().unwrap();

    let first = ura_in(&repo.path().join("src"), &["add"], &env);
    let again = ura_in(
        elsewhere.path(),
        &["add", repo.path().to_str().unwrap()],
        &env,
    );
    let outside = ura_in(elsewhere.path(), &["add"], &env);

    assert_eq!((first.code, again.code), (0, 0));
    assert_eq!(outside.code, 1, "a folder outside git is refused");
    let list: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(data.path().join("repositories.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(list["repositories"].as_array().unwrap().len(), 1);
    assert_eq!(
        list["repositories"][0]["path"],
        repo.path().to_str().unwrap()
    );
}

#[test]
fn a_list_that_cannot_be_read_is_kept_when_adding() {
    let repo = TestRepo::named("todo-app");
    let data = tempfile::TempDir::new().unwrap();
    std::fs::write(data.path().join("repositories.json"), "{not json").unwrap();

    let output = ura_in(
        repo.path(),
        &["add"],
        &[("URAEDA_DATA_DIR", data.path().to_str().unwrap())],
    );

    assert_eq!(output.code, 1);
    assert_eq!(
        std::fs::read_to_string(data.path().join("repositories.json")).unwrap(),
        "{not json"
    );
}
