mod common;

use common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [CLI](/specs/2026-10-10-cli-core/proposal.md)\n\n## Next\n\n- [Git listener](drafts/git-listener.md)\n- Claude Code runner\n\n## Later\n\n## Blocked\n";

fn repo_with_priorities() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo
}

#[test]
fn waiting_on_you_across_branches() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "16 questions, about 50 minutes.", &[""]),
            ),
        ],
    );

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-10-cli-core"),
        [
            "2026-10-10-cli-core",
            "you",
            "clarifications-01.md: 16 questions, about 50 minutes."
        ]
    );
    let now = output.stdout.find("Now").unwrap();
    assert!(now < output.stdout.find("2026-10-10-cli-core").unwrap());
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn waiting_on_an_agent() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("answered", "Answered on 2026-10-08.", &["A"]),
            ),
            ("spec.md", spec("approved", 1, 1)),
        ],
    );

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-10-cli-core"),
        ["2026-10-10-cli-core", "agent", "plan"]
    );
}

#[test]
fn not_started_entry() {
    let repo = repo_with_priorities();

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("git-listener"),
        ["git-listener", "-", "not started (drafts/git-listener.md)"]
    );
    assert_eq!(
        output.row("Claude Code runner"),
        ["Claude Code runner", "-", "not started"]
    );
    let next = output.stdout.find("Next").unwrap();
    assert!(next < output.stdout.find("git-listener").unwrap());
}

#[test]
fn uncommitted_changes_on_the_current_branch() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "16 questions, about 50 minutes.", &[""]),
            ),
        ],
    );
    repo.switch("2026-10-10-cli-core");
    repo.write(
        "specs/2026-10-10-cli-core/clarifications-01.md",
        &clarifications("awaiting-human", "16 questions, about 50 minutes.", &["B"]),
    );

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-10-cli-core")[2],
        "clarifications-01.md: 16 questions, about 50 minutes. (uncommitted changes)"
    );
}

/// US1.3: merged features show once, under Done, read from the default branch, even with their
/// remote branch left.
#[test]
fn merged_features_are_done() {
    let repo = repo_with_priorities();
    for folder in ["2026-10-10-stack-decision", "2026-10-10-cli-core"] {
        feature(&repo, folder, &[("proposal.md", proposal())]);
        repo.git(&["merge", "--quiet", "--no-edit", folder]);
    }
    repo.push("2026-10-10-stack-decision");
    repo.delete_branch("2026-10-10-stack-decision");

    let output = ura(&repo, &["status"]);

    assert!(output.stdout.contains("\nDone\n"), "{}", output.stdout);
    let rows: Vec<&str> = output
        .stdout
        .lines()
        .filter(|line| line.contains("stack-decision") || line.contains("cli-core"))
        .collect();
    assert_eq!(rows.len(), 2, "{}", output.stdout);
    assert!(
        rows[0].ends_with("-      merged: branch left, run ura clean"),
        "{rows:?}"
    );
    assert!(rows[1].ends_with("-      merged"), "{rows:?}");

    let json = ura(&repo, &["status", "--json"]);
    let json: serde_json::Value = serde_json::from_str(&json.stdout).unwrap();
    assert_eq!(json["version"], 1);
    let done: Vec<&serde_json::Value> = json["features"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|f| f["step"]["name"] == "done")
        .collect();
    assert_eq!(done.len(), 2);
    assert!(
        done.iter()
            .all(|f| f["source"] == "default-branch" && f["branch"].is_null())
    );
}

#[test]
fn json_has_version_and_features() {
    let repo = repo_with_priorities();
    feature(&repo, "2026-10-10-cli-core", &[("proposal.md", proposal())]);

    let output = ura(&repo, &["status", "--json"]);

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["default-branch"], "main");
    let feature = &json["features"][0];
    assert_eq!(feature["folder"], "2026-10-10-cli-core");
    assert_eq!(feature["slug"], "cli-core");
    assert_eq!(feature["step"]["name"], "discovery");
    assert_eq!(feature["step"]["waits-on"], "agent");
    assert_eq!(json["priorities"][0]["feature"], "2026-10-10-cli-core");
}

#[test]
fn behind_its_remote() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "2026-10-12-git-listener",
        &[("proposal.md", proposal())],
    );
    repo.switch("2026-10-12-git-listener");
    repo.push("2026-10-12-git-listener");
    repo.write("x.md", "1\n");
    repo.commit("one");
    repo.write("x.md", "2\n");
    repo.commit("two");
    repo.push("2026-10-12-git-listener");
    repo.git(&["reset", "--quiet", "--hard", "HEAD~2"]);
    repo.switch("main");

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-12-git-listener")[2],
        "discovery (behind origin by 2)"
    );
    assert!(
        output.stdout.starts_with("Remote branches fetched "),
        "{}",
        output.stdout
    );
}

#[test]
fn invalid_files_instead_of_a_step() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                "---\nstatus: done\n---\n# C\n".to_string(),
            ),
        ],
    );

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-10-cli-core"),
        ["2026-10-10-cli-core", "-", "invalid files: run ura check"]
    );
}

#[test]
fn impossible_date_is_skipped() {
    let repo = repo_with_priorities();
    feature(&repo, "2026-13-99-x", &[("proposal.md", proposal())]);

    let output = ura(&repo, &["status"]);

    assert!(!output.stdout.contains("2026-13-99-x"), "{}", output.stdout);
}

#[test]
fn no_specs_folder() {
    let repo = TestRepo::new();

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.stderr,
        format!(
            "ura: no specs/ folder at {}: run ura init\n",
            repo.path().display()
        )
    );
    assert_eq!(output.code, 1);
}

#[test]
fn branch_with_a_slash() {
    let repo = repo_with_priorities();
    feature(
        &repo,
        "fix/2026-10-14-reappear",
        &[("report.md", "# Report\n\nIt breaks.\n".to_string())],
    );

    let output = ura(&repo, &["status"]);

    let not_in_priorities = output.stdout.find("Not in priorities").unwrap();
    assert!(not_in_priorities < output.stdout.find("fix/2026-10-14-reappear").unwrap());
    assert_eq!(
        output.row("fix/2026-10-14-reappear")[1..],
        ["agent", "assess"]
    );
}

#[test]
fn uncommitted_proposal_waits_on_you() {
    let repo = repo_with_priorities();
    repo.switch_new("2026-10-11-runner");
    repo.write("specs/2026-10-11-runner/proposal.md", &proposal());

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("2026-10-11-runner")[1..],
        [
            "you",
            "proposal.md: write it, then commit it (uncommitted changes)"
        ]
    );
}

#[test]
fn long_entries_are_cut() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n- Use a small model for one-shot classification of decisions: is it relevant?\n\n## Next\n",
    );

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row("Use a small"),
        ["Use a small model for one-shot…", "-", "not started"]
    );
}

const WEB_UI: &str = "2026-10-11-web-ui";

fn merged_web_ui() -> TestRepo {
    let repo = repo_with_priorities();
    feature(&repo, WEB_UI, &[("proposal.md", proposal())]);
    finish_and_merge(&repo, WEB_UI);
    repo
}

/// US2.1
#[test]
fn a_merged_record_is_done() {
    let repo = merged_web_ui();
    repo.delete_branch(WEB_UI);

    let output = ura(&repo, &["status"]);

    assert_eq!(output.row(WEB_UI), [WEB_UI, "-", "merged"]);
}

/// US2.2
#[test]
fn a_merged_feature_with_leftovers_says_so() {
    let repo = merged_web_ui();
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/2026-10-11-web-ui",
        WEB_UI,
    ]);

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row(WEB_UI),
        [
            WEB_UI,
            "-",
            "merged: worktree and branch left, run ura clean"
        ]
    );
    let json: serde_json::Value =
        serde_json::from_str(&ura(&repo, &["status", "--json"]).stdout).unwrap();
    let feature = json["features"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["folder"] == WEB_UI)
        .unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(feature["left-worktree"], ".worktrees/2026-10-11-web-ui");
    assert_eq!(feature["left-branch"], WEB_UI);
}

#[test]
fn a_merged_feature_with_only_its_branch_left() {
    let repo = merged_web_ui();

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row(WEB_UI),
        [WEB_UI, "-", "merged: branch left, run ura clean"]
    );
}

/// US1.6, review focus 5
#[test]
fn a_finished_branch_waits_for_its_pull_request() {
    let repo = repo_with_priorities();
    feature(&repo, WEB_UI, &[("proposal.md", proposal())]);
    finish(&repo, WEB_UI);

    let output = ura(&repo, &["status"]);

    assert_eq!(output.row(WEB_UI)[1], "agent");
}
