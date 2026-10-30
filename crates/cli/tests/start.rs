mod common;

use common::*;

const PROPOSAL_FILE: &str = "specs/proposals/git-listener-process.md";
const PROPOSAL: &str = "specs/2026-10-11-git-listener/proposal.md";
const BRANCH: &str = "2026-10-11-git-listener";
const WORKTREE: &str = ".worktrees/2026-10-11-git-listener";

/// A path in the new feature's worktree.
fn in_worktree(path: &str) -> String {
    format!("{WORKTREE}/{path}")
}

fn written_proposal_file() -> String {
    "# Git listener process\n\n## What\n\nListen to pushes.\n\n## Why\n\nTo run agents.\n\n## Notes\n\n[Optional: constraints, ideas.]\n".to_string()
}

fn repo_with_a_proposal_file() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli/proposal.md)\n\n## Next\n\n- [Git listener process](proposals/git-listener-process.md)\n- Runner\n\n## Later\n\n## Blocked\n",
    );
    repo.write(PROPOSAL_FILE, &written_proposal_file());
    repo.commit("draft");
    repo
}

#[test]
fn commits_the_start_on_main() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

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
        [PROPOSAL, "specs/PRIORITIES.md", PROPOSAL_FILE]
    );
}

/// The proposal's link resolves on main: the proposal file moves into the dated folder there, in
/// the start commit, and the branch starts from it.
#[test]
fn moves_the_proposal_file_on_main_and_branches_from_there() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(repo.current_branch(), "main");
    assert_eq!(repo.read(PROPOSAL), written_proposal_file());
    assert!(!repo.exists(PROPOSAL_FILE));
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "chore(git-listener): start Git listener process"
    );
    assert_eq!(repo.read(&in_worktree(PROPOSAL)), written_proposal_file());
    assert!(!repo.exists(&in_worktree(PROPOSAL_FILE)));
    assert_eq!(repo.porcelain(), "");
    assert_eq!(repo.hook_runs(), 1);
    assert_eq!(
        output.stdout,
        format!(
            "moved   {PROPOSAL_FILE} -> {PROPOSAL}\non main: committed \"chore(git-listener): start Git listener process\"\ncreated branch {BRANCH} in {WORKTREE}\nNext: discovery. Ask an agent, or run ura next.\n"
        )
    );
}

/// US5.7
#[test]
fn switch_switches_the_checkout_as_before() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", PROPOSAL_FILE, "--switch"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.current_branch(), BRANCH);
    assert_eq!(repo.read(PROPOSAL), written_proposal_file());
    assert!(!repo.exists(PROPOSAL_FILE));
    assert!(!repo.exists(WORKTREE));
    assert!(
        output
            .stdout
            .contains(&format!("created branch {BRANCH}\n"))
    );
}

#[test]
fn a_proposal_file_no_line_links() {
    let repo = repo_with_a_proposal_file();
    repo.write(
        "specs/proposals/slack-integration.md",
        &written_proposal_file().replace("Git listener process", "Slack integration"),
    );
    repo.commit("slack");

    ura(&repo, &["start", "specs/proposals/slack-integration.md"]);

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
    let repo = repo_with_a_proposal_file();
    for name in ["proposal.md", "discovery-01.md", "clarifications-01.md"] {
        repo.write(
            &format!("specs/proposals/benchmarks/{name}"),
            &format!("# {name}\n\n## What\n\nA thing.\n\n## Why\n\nA reason.\n"),
        );
    }
    repo.commit("postponed");

    let output = ura(&repo, &["start", "specs/proposals/benchmarks"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    for name in ["proposal.md", "discovery-01.md", "clarifications-01.md"] {
        assert!(
            repo.exists(&format!("specs/2026-10-11-benchmarks/{name}")),
            "{name}"
        );
        assert!(
            !repo.exists(&format!("specs/proposals/benchmarks/{name}")),
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
                ".worktrees/2026-10-11-benchmarks/specs/proposals/benchmarks/{name}"
            )),
            "{name}"
        );
    }
}

#[test]
fn an_existing_branch() {
    let repo = repo_with_a_proposal_file();
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
    let repo = repo_with_a_proposal_file();
    repo.branch(BRANCH);

    ura(
        &repo,
        &["start", "git-listener-process", "--slug", "listener"],
    );

    assert_eq!(repo.current_branch(), "main");
    assert!(repo.exists(".worktrees/2026-10-11-listener/specs/2026-10-11-listener/proposal.md"));
}

/// Uncommitted changes elsewhere stay as they were, out of the start's commit.
#[test]
fn uncommitted_changes_elsewhere() {
    let repo = repo_with_a_proposal_file();
    repo.write("README.md", "# Changed\n");

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        repo.changed_in("main"),
        [PROPOSAL, "specs/PRIORITIES.md", PROPOSAL_FILE]
    );
    assert_eq!(repo.porcelain(), " M README.md\n");
}

#[test]
fn not_a_proposal_file() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", "specs/2026-10-10-cli-core/proposal.md"]);

    assert_eq!(
        output.stderr,
        "ura: not a proposal: ura start takes a file or folder in specs/proposals/\n"
    );
}

#[test]
fn an_uncommitted_proposal_file_is_committed_as_the_proposal() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n- Git listener process\n\n## Later\n\n## Blocked\n",
    );
    repo.write(PROPOSAL_FILE, &written_proposal_file());
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n## Next\n\n- [Git listener process](proposals/git-listener-process.md)\n\n## Later\n\n## Blocked\n",
    );

    let output = ura(&repo, &["start", "git-listener-process"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(repo.changed_in("main"), [PROPOSAL, "specs/PRIORITIES.md"]);
    assert_eq!(
        repo.git(&["rev-parse", "main"]),
        repo.git(&["rev-parse", BRANCH])
    );
    assert!(!repo.exists(PROPOSAL_FILE));
    assert!(
        repo.git(&["log", "--all", "--format=%H", "--", PROPOSAL_FILE])
            .is_empty()
    );
    assert_eq!(repo.porcelain(), "");
}

/// A change's proposal is no proposal file: `ura start` refuses it as it refuses any other file.
#[test]
fn a_changes_proposal_is_not_a_proposal_file() {
    let repo = repo_with_a_proposal_file();
    let started = ura(&repo, &["start", PROPOSAL_FILE, "--change"]);
    assert_eq!(started.code, 0, "{}", started.stderr);
    let proposal = "specs/changes/2026-10-11-git-listener/proposal.md";
    assert!(repo.path().join(in_worktree(proposal)).is_file());

    let output = ura_in(&repo.path().join(WORKTREE), &["start", proposal], &[]);

    assert_eq!(output.code, 1, "{}", output.stderr);
    assert!(
        output.stderr.contains("not a proposal"),
        "{}",
        output.stderr
    );
    assert_eq!(
        repo.subjects("main")[0],
        "chore(git-listener): start Git listener process"
    );
    assert_eq!(
        repo.subjects("change/2026-10-11-git-listener")[0],
        "chore(git-listener): start Git listener process"
    );
}

/// A failed start commit leaves the proposal file moved, and says what is left.
#[test]
fn a_failed_start_commit() {
    let repo = repo_with_a_proposal_file();
    repo.set_hook(
        "if git diff --cached --name-only | grep -q proposal.md; then echo boom >&2; exit 1; fi",
    );

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(output.code, 1);
    assert_eq!(repo.subjects("main")[0], "draft");
    assert_eq!(repo.read(PROPOSAL), written_proposal_file());
    assert!(output.stderr.ends_with(&format!(
        "ura: git commit failed: boom\nDone: the move of the proposal file.\nLeft: commit specs/PRIORITIES.md, the removal of {PROPOSAL_FILE}, and specs/2026-10-11-git-listener/ on main as \"chore(git-listener): start Git listener process\", then create the branch {BRANCH} in {WORKTREE}.\n"
    )), "{}", output.stderr);
}

#[test]
fn a_proposal_file_two_lines_link() {
    let repo = repo_with_a_proposal_file();
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Listener](proposals/git-listener-process.md)\n\n## Next\n\n- [Git listener process](proposals/git-listener-process.md)\n\n## Later\n\n## Blocked\n",
    );
    repo.commit("two");

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(
        output.stderr,
        format!(
            "ura: 2 proposals link {PROPOSAL_FILE}:\n  Now   Listener\n  Next  Git listener process\n"
        )
    );
    assert_eq!(output.code, 1);
}

/// Edge case: a record holds the name.
#[test]
fn refuses_a_name_a_record_holds() {
    let repo = repo_with_a_proposal_file();
    repo.write(
        "specs/done/2026-10-11-git-listener.md",
        &record("feature", "Git listener process"),
    );
    repo.commit("finish: an earlier git listener");

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        "ura: specs/done/2026-10-11-git-listener.md exists: choose another slug with --slug\n"
    );
}

#[test]
fn a_refused_switch_returns_to_the_branch_it_left() {
    let repo = repo_with_a_proposal_file();
    repo.switch_new("elsewhere");

    let output = ura(
        &repo,
        &["start", PROPOSAL_FILE, "--switch", "--slug", "Not A Slug"],
    );

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
    let repo = repo_with_a_proposal_file();
    repo.write(&in_worktree("left-over.txt"), "x\n");

    let output = ura(&repo, &["start", PROPOSAL_FILE]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        format!("ura: cannot create the worktree: {WORKTREE} exists\n")
    );
    assert_eq!(repo.subjects("main")[0], "draft");
}

/// US1.3: `--change` starts the proposal file as a change, in its own folder and branch.
#[test]
fn a_proposal_file_starts_as_a_change() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", "git-listener-process", "--change"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    let branch = "change/2026-10-11-git-listener";
    let proposal = "specs/changes/2026-10-11-git-listener/proposal.md";
    assert_eq!(
        repo.changed_in(branch),
        ["specs/PRIORITIES.md", proposal, PROPOSAL_FILE]
    );
    assert_eq!(repo.read(proposal), written_proposal_file());
    assert_eq!(repo.read(&in_worktree(proposal)), written_proposal_file());
    assert_eq!(
        output.stdout,
        format!(
            "moved   {PROPOSAL_FILE} -> {proposal}\non main: committed \"chore(git-listener): start Git listener process\"\ncreated branch {branch} in {WORKTREE}\nNext: change. Ask an agent, or run ura next.\n"
        )
    );
}

/// Edge case: a postponed feature's folder holds files a change has no place for, so `--change`
/// refuses it, and nothing is committed.
#[test]
fn a_postponed_feature_is_refused_as_a_change() {
    let repo = repo_with_a_proposal_file();
    let folder = "specs/proposals/benchmarks";
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

/// US4.1: `ura start <change> --feature` makes the change a feature, in place.
#[test]
fn feature_moves_a_change() {
    let repo = repo_with_a_proposal_file();
    let started = ura(&repo, &["start", PROPOSAL_FILE, "--change"]);
    assert_eq!(started.code, 0, "{}", started.stderr);

    let output = ura(&repo, &["start", "git-listener", "--feature"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert_eq!(
        output.stdout,
        format!("Started {BRANCH} as a feature, on {BRANCH}.\n")
    );
    assert_eq!(
        repo.subjects(BRANCH)[0],
        "chore(git-listener): upgrade to a feature"
    );
    assert!(repo.exists(&in_worktree(PROPOSAL)));
    assert_eq!(repo.git(&["branch", "--list", "change/*"]), "");
}

/// US4 more 2: a change whose pull request `gh` lists keeps its branch's name, the pull requests
/// asked of `gh` before the move.
#[test]
fn feature_on_a_change_with_a_pull_request_is_refused() {
    let repo = repo_with_a_proposal_file();
    let started = ura(&repo, &["start", PROPOSAL_FILE, "--change"]);
    assert_eq!(started.code, 0, "{}", started.stderr);
    let bin = repo.parent().join("bin");
    std::fs::create_dir(&bin).unwrap();
    let gh = bin.join("gh");
    std::fs::write(
        &gh,
        format!(
            "#!/bin/sh\necho '[{{\"headRefName\":\"change/{BRANCH}\",\"number\":7,\"url\":\"https://github.com/o/r/pull/7\",\"isDraft\":false,\"reviewDecision\":\"\"}}]'\n"
        ),
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&gh, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let path = format!(
        "{}:{}",
        bin.display(),
        std::env::var("PATH").unwrap_or_default()
    );
    let home = repo.home();

    let output = ura_in(
        repo.path(),
        &["start", "git-listener", "--feature"],
        &[("PATH", &path), ("HOME", home.to_str().unwrap())],
    );

    assert_eq!(output.code, 1, "{}", output.stdout);
    assert_eq!(
        output.stderr,
        "ura: This change has a pull request: close it first, since its branch would be renamed\n"
    );
    assert_eq!(
        repo.git(&["branch", "--list", &format!("change/{BRANCH}")])
            .trim(),
        format!("+ change/{BRANCH}")
    );
}

#[test]
fn feature_on_a_proposal_file_is_refused() {
    let repo = repo_with_a_proposal_file();

    let output = ura(&repo, &["start", PROPOSAL_FILE, "--feature"]);

    assert_eq!(output.code, 1);
    assert_eq!(
        output.stderr,
        "ura: --feature takes a change: start a proposal as a feature without it\n"
    );
    assert_eq!(repo.subjects("main")[0], "draft");
}
