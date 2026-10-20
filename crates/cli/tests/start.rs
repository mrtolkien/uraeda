mod common;

use common::*;

const DRAFT: &str = "specs/drafts/git-listener-process.md";
const PROPOSAL: &str = "specs/2026-10-11-git-listener/proposal.md";
const BRANCH: &str = "2026-10-11-git-listener";
const WORKTREE: &str = ".worktrees/2026-10-11-git-listener";

/// A path in the new feature's worktree.
fn in_worktree(path: &str) -> String {
    format!("{WORKTREE}/{path}")
}

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
        "chore(git-listener): start Git listener process"
    );
    let priorities = repo.git(&["show", "main:specs/PRIORITIES.md"]);
    assert!(priorities.contains(
        "- [CLI](/specs/2026-10-10-cli/proposal.md)\n- [Git listener process](/specs/2026-10-11-git-listener/proposal.md)\n\n## Next\n\n- Runner\n"
    ), "{priorities}");
    assert_eq!(
        repo.changed_in("main"),
        [PROPOSAL, "specs/PRIORITIES.md", DRAFT]
    );
}

/// The entry's link resolves on main: the draft moves into the dated folder there, in the start
/// commit, and the branch starts from it.
#[test]
fn moves_the_draft_on_main_and_branches_from_there() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.read(PROPOSAL), written_draft());
    assert!(!repo.exists(DRAFT));
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "chore(git-listener): start Git listener process"
    );
    assert_eq!(repo.read(&in_worktree(PROPOSAL)), written_draft());
    assert!(!repo.exists(&in_worktree(DRAFT)));
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(
        output.stdout,
        format!(
            "moved   {DRAFT} -> {PROPOSAL}\non main: committed \"chore(git-listener): start Git listener process\"\ncreated branch {BRANCH} in {WORKTREE}\nNext: discovery. Ask an agent, or run ura next.\n"
        )
    );
}

/// US5.7
#[test]
fn switch_switches_the_checkout_as_before() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", DRAFT, "--switch"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.current_branch(), BRANCH);
    assert_eq!(repo.read(PROPOSAL), written_draft());
    assert!(!repo.exists(DRAFT));
    assert!(!repo.exists(WORKTREE));
    assert!(
        output
            .stdout
            .contains(&format!("created branch {BRANCH}\n"))
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
        assert!(
            repo.exists(&format!(
                ".worktrees/2026-10-11-benchmarks/specs/2026-10-11-benchmarks/{name}"
            )),
            "{name}"
        );
        assert!(
            !repo.exists(&format!(
                ".worktrees/2026-10-11-benchmarks/specs/backlog/benchmarks/{name}"
            )),
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

    assert_eq!(repo.current_branch(), "main");
    assert!(repo.exists(".worktrees/2026-10-11-listener/specs/2026-10-11-listener/proposal.md"));
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
    assert_eq!(repo.changed_in("main"), [PROPOSAL, "specs/PRIORITIES.md"]);
    assert_eq!(
        repo.git(&["rev-parse", "main"]),
        repo.git(&["rev-parse", BRANCH])
    );
    assert!(!repo.exists(DRAFT));
    assert!(
        repo.git(&["log", "--all", "--format=%H", "--", DRAFT])
            .is_empty()
    );
    assert_eq!(repo.porcelain(), "");
}

/// A change's proposal is no draft: `ura start` refuses it as it refuses any other file.
#[test]
fn a_changes_proposal_is_not_a_draft() {
    let repo = repo_with_a_draft();
    let started = ura(&repo, &["start", DRAFT, "--change"]);
    assert_eq!(started.code, 0, "{}", started.stderr);
    let proposal = "specs/changes/2026-10-11-git-listener/proposal.md";
    assert!(repo.path().join(in_worktree(proposal)).is_file());

    let output = ura_in(&repo.path().join(WORKTREE), &["start", proposal], &[]);

    assert_eq!(output.code, 1, "{}", output.stderr);
    assert!(output.stderr.contains("not a draft"), "{}", output.stderr);
    assert_eq!(
        repo.subjects("main")[0],
        "chore(git-listener): start Git listener process"
    );
    assert_eq!(
        repo.subjects("change/2026-10-11-git-listener")[0],
        "chore(git-listener): start Git listener process"
    );
}

/// A failed start commit leaves the draft moved, and says what is left.
#[test]
fn a_failed_start_commit() {
    let repo = repo_with_a_draft();
    repo.set_hook(
        "if git diff --cached --name-only | grep -q proposal.md; then echo boom >&2; exit 1; fi",
    );

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 1);
    assert_eq!(repo.subjects("main")[0], "draft");
    assert_eq!(repo.read(PROPOSAL), written_draft());
    assert!(output.stderr.ends_with(&format!(
        "ura: git commit failed: boom\nDone: the move of the draft.\nLeft: commit specs/PRIORITIES.md, the removal of {DRAFT}, and specs/2026-10-11-git-listener/ on main as \"chore(git-listener): start Git listener process\", then create the branch {BRANCH} in {WORKTREE}.\n"
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

/// Edge case: a record holds the name.
#[test]
fn refuses_a_name_a_record_holds() {
    let repo = repo_with_a_draft();
    repo.write(
        "specs/done/2026-10-11-git-listener.md",
        &record("feature", "Git listener process"),
    );
    repo.commit("finish: an earlier git listener");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        "ura: specs/done/2026-10-11-git-listener.md exists: choose another slug with --slug\n"
    );
}

#[test]
fn a_refused_switch_returns_to_the_branch_it_left() {
    let repo = repo_with_a_draft();
    repo.switch_new("elsewhere");

    let output = ura(&repo, &["start", DRAFT, "--switch", "--slug", "Not A Slug"]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        "ura: \"Not A Slug\" is not a slug: lowercase letters, digits, and hyphens; choose one with --slug\n"
    );
    assert_eq!(repo.current_branch(), "elsewhere");
    assert_eq!(repo.subjects("main")[0], "draft");
}

#[test]
fn refuses_a_folder_where_the_worktree_goes() {
    let repo = repo_with_a_draft();
    repo.write(&in_worktree("left-over.txt"), "x\n");

    let output = ura(&repo, &["start", DRAFT]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        format!("ura: cannot create the worktree: {WORKTREE} exists\n")
    );
    assert_eq!(repo.subjects("main")[0], "draft");
}

/// US1.3: `--change` starts the draft as a change, in its own folder and branch.
#[test]
fn a_draft_starts_as_a_change() {
    let repo = repo_with_a_draft();

    let output = ura(&repo, &["start", "git-listener-process", "--change"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let branch = "change/2026-10-11-git-listener";
    let proposal = "specs/changes/2026-10-11-git-listener/proposal.md";
    assert_eq!(
        repo.changed_in(branch),
        ["specs/PRIORITIES.md", proposal, DRAFT]
    );
    assert_eq!(repo.read(proposal), written_draft());
    assert_eq!(repo.read(&in_worktree(proposal)), written_draft());
    assert_eq!(
        output.stdout,
        format!(
            "moved   {DRAFT} -> {proposal}\non main: committed \"chore(git-listener): start Git listener process\"\ncreated branch {branch} in {WORKTREE}\nNext: change. Ask an agent, or run ura next.\n"
        )
    );
}

/// Edge case: a postponed feature's folder holds files a change has no place for, so `--change`
/// refuses it, and nothing is committed.
#[test]
fn a_postponed_feature_is_refused_as_a_change() {
    let repo = repo_with_a_draft();
    let folder = "specs/backlog/benchmarks";
    for name in ["proposal.md", "clarifications-01.md", "spec.md"] {
        repo.write(&format!("{folder}/{name}"), &format!("# {name}\n"));
    }
    repo.commit("postponed");

    let output = ura(&repo, &["start", folder, "--change"]);

    assert_eq!(output.code, 1, "{}", output.stdout);
    assert_eq!(
        output.stderr,
        format!(
            "ura: {folder} holds spec.md, which has no place in a change: start it as a feature, \
             without --change\n"
        )
    );
    assert_eq!(repo.subjects("main")[0], "postponed");
    assert_eq!(repo.git(&["branch", "--list", "change/*"]), "");
}
