mod common;

use common::*;

const DRAFT: &str = "specs/drafts/git-listener-process.md";
const PROPOSAL: &str = "specs/2026-10-11-git-listener-process/proposal.md";
const BRANCH: &str = "2026-10-11-git-listener-process";

fn written_draft() -> String {
    "# Git listener process\n\n## What\n\nListen to pushes.\n\n## Why\n\nTo run agents.\n\n## Notes\n\n[Optional: constraints, ideas.]\n".to_string()
}

fn repo_with_a_draft() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli/proposal.md)\n\n## Next\n\n- [Git listener process](drafts/git-listener-process.md)\n- Runner\n\n## Later\n\n## Blocked\n",
    );
    repo.write(DRAFT, &written_draft());
    repo.commit("draft");
    repo
}

#[test]
fn commits_the_start_on_main() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(git-listener-process): start Git listener process"
    );
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(priorities.contains(
        "- [CLI](/specs/2026-10-10-cli/proposal.md)\n- [Git listener process](/specs/2026-10-11-git-listener-process/proposal.md)\n\n## Next\n\n- Runner\n"
    ), "{priorities}");
    assert_eq!(repo.changed_in("main"), ["specs/PRIORITIES.md"]);
}

#[test]
fn moves_the_draft_on_the_new_branch() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(repo.current_branch(), BRANCH);
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "chore(git-listener-process): proposal"
    );
    assert_eq!(
        repo.subjects(BRANCH)[1],
        "chore(git-listener-process): start Git listener process"
    );
    assert_eq!(repo.changed_in("HEAD"), [PROPOSAL, DRAFT]);
    assert_eq!(repo.read(PROPOSAL), written_draft());
    assert!(!repo.exists(DRAFT));
    assert_eq!(repo.porcelain(), "");
    assert_eq!(
        output.stdout,
        format!(
            "on main: committed \"chore(git-listener-process): start Git listener process\"\ncreated branch {BRANCH}\nmoved   {DRAFT} -> {PROPOSAL}\ncommitted \"chore(git-listener-process): proposal\"\nNext: discovery. Ask an agent, or run ura next.\n"
        )
    );
}

#[test]
fn a_draft_no_line_links() {
    let repo = repo_with_a_draft();
    repo.write(
        "specs/drafts/slack-integration.md",
        &written_draft().replace("Git listener process", "Slack integration"),
    );
    repo.commit("slack");

    ura(&repo, &["start", "specs/drafts/slack-integration.md"]);

    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(
        priorities.contains(
            "- [Slack integration](/specs/2026-10-11-slack-integration/proposal.md)\n\n## Next"
        ),
        "{priorities}"
    );
}

#[test]
fn a_postponed_folder() {
    let repo = repo_with_a_draft();
    for name in ["proposal.md", "discovery-01.md", "clarifications-01.md"] {
        repo.write(
            &format!("specs/backlog/benchmarks/{name}"),
            &format!("# {name}\n\n## What\n\nA thing.\n\n## Why\n\nA reason.\n"),
        );
    }
    repo.commit("postponed");

    let output = ura(&repo, &["start", "specs/backlog/benchmarks"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    for name in ["proposal.md", "discovery-01.md", "clarifications-01.md"] {
        assert!(
            repo.exists(&format!("specs/2026-10-11-benchmarks/{name}")),
            "{name}"
        );
        assert!(
            !repo.exists(&format!("specs/backlog/benchmarks/{name}")),
            "{name}"
        );
    }
}

#[test]
fn an_existing_branch() {
    let repo = repo_with_a_draft();
    repo.branch(BRANCH);

    let output = ura(&repo, &["start", "git-listener-process"]);

    assert_eq!(
        output.stderr,
        format!("ura: {BRANCH} exists: choose another slug with --slug\n")
    );
    assert_eq!(output.code, 1);
    assert_eq!(repo.subjects("main")[0], "draft");
}

#[test]
fn another_slug() {
    let repo = repo_with_a_draft();
    repo.branch(BRANCH);

    ura(
        &repo,
        &["start", "git-listener-process", "--slug", "listener"],
    );

    assert_eq!(repo.current_branch(), "2026-10-11-listener");
    assert!(repo.exists("specs/2026-10-11-listener/proposal.md"));
}

#[test]
fn uncommitted_changes_elsewhere() {
    let repo = repo_with_a_draft();
    repo.write("README.md", "# Changed\n");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(
        output.stderr,
        "ura: cannot start: uncommitted changes in README.md\n"
    );
    assert_eq!(output.code, 1);
    assert_eq!(repo.subjects("main")[0], "draft");
}

#[test]
fn not_a_draft() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", "specs/2026-10-10-cli-core/proposal.md"]);

    assert_eq!(
        output.stderr,
        "ura: not a draft: ura start takes a file or folder in specs/drafts/ or specs/backlog/\n"
    );
}

#[test]
fn a_draft_with_the_template_placeholders() {
    let repo = repo_with_a_draft();
    repo.write(DRAFT, "# Git listener process\n\n## What\n\n[What the feature does, from the user's point of view.]\n\n## Why\n\n[The problem it solves, and for whom.]\n");
    repo.commit("template");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(
        output.stderr,
        format!("ura: {DRAFT} still holds the template's placeholders: write it first\n")
    );
    assert_eq!(output.code, 1);
}

#[test]
fn an_uncommitted_draft_is_committed_as_the_proposal() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- Git listener process\n\n## Later\n\n## Blocked\n",
    );
    repo.write(DRAFT, &written_draft());
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n## Next\n\n- [Git listener process](drafts/git-listener-process.md)\n\n## Later\n\n## Blocked\n",
    );

    let output = ura(&repo, &["start", "git-listener-process"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.changed_in("main"), ["specs/PRIORITIES.md"]);
    assert_eq!(repo.changed_in("HEAD"), [PROPOSAL]);
    assert!(
        repo.git(&["log", "--all", "--format=%H", "--", DRAFT])
            .is_empty()
    );
    assert_eq!(repo.porcelain(), "");
}

#[test]
fn a_bug() {
    let repo = repo_with_a_draft();

    let output = ura(
        &repo,
        &[
            "start",
            "specs/bugs/2026-10-14-completed-tasks-reappear/report.md",
        ],
    );

    assert_eq!(output.code, 101);
    assert!(
        output
            .stderr
            .contains("not implemented: starting a bug, until the bug flow has its spec"),
        "{}",
        output.stderr
    );
    assert_eq!(repo.subjects("main")[0], "draft");
}

#[test]
fn a_failure_after_the_first_commit() {
    let repo = repo_with_a_draft();
    repo.set_hook(
        "if git diff --cached --name-only | grep -q proposal.md; then echo boom >&2; exit 1; fi",
    );

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 1);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(git-listener-process): start Git listener process"
    );
    assert!(output.stderr.ends_with(&format!(
        "ura: git commit failed: boom\nDone: the start commit on main, the branch {BRANCH}, the move of the draft.\nLeft: commit {PROPOSAL} as \"chore(git-listener-process): proposal\".\n"
    )), "{}", output.stderr);
}

#[test]
fn a_draft_two_lines_link() {
    let repo = repo_with_a_draft();
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Listener](drafts/git-listener-process.md)\n\n## Next\n\n- [Git listener process](drafts/git-listener-process.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.commit("two");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(
        output.stderr,
        format!("ura: 2 lines link {DRAFT}:\n  Now   Listener\n  Next  Git listener process\n")
    );
    assert_eq!(output.code, 1);
}
