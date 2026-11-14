mod common;

use common::*;

fn repo_with_specs() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo);
    repo
}

#[test]
fn waiting_on_you_across_branches() {
    let repo = repo_with_specs();
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
    let working = output.stdout.find("In progress").unwrap();
    assert!(working < output.stdout.find("2026-10-10-cli-core").unwrap());
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn waiting_on_an_agent() {
    let repo = repo_with_specs();
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
fn uncommitted_changes_on_the_current_branch() {
    let repo = repo_with_specs();
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

/// US1.3: merged features are read from the default branch, even with their remote branch left,
/// and shown only with their local branch left.
#[test]
fn merged_features_are_done() {
    let repo = repo_with_specs();
    for folder in ["2026-10-10-stack-decision", "2026-10-10-cli-core"] {
        feature(&repo, folder, &[("proposal.md", proposal())]);
        finish(&repo, folder);
        repo.git(&["merge", "--quiet", "--no-edit", folder]);
        repo.remove_worktree(folder);
    }
    repo.push("2026-10-10-stack-decision");
    repo.delete_branch("2026-10-10-stack-decision");

    let output = ura(&repo, &["status"]);

    assert!(
        output
            .stdout
            .contains("\nMerged, with a worktree or a branch left\n"),
        "{}",
        output.stdout
    );
    let rows: Vec<&str> = output
        .stdout
        .lines()
        .filter(|line| line.contains("stack-decision") || line.contains("cli-core"))
        .collect();
    assert_eq!(rows.len(), 1, "{}", output.stdout);
    assert!(
        rows[0].ends_with("-      merged: its branch left"),
        "{rows:?}"
    );

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
    let repo = repo_with_specs();
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
}

#[test]
fn behind_its_remote() {
    let repo = repo_with_specs();
    feature(
        &repo,
        "2026-10-12-git-listener",
        &[("proposal.md", proposal())],
    );
    let branch = "2026-10-12-git-listener";
    repo.push(branch);
    repo.write_in(branch, "x.md", "1\n");
    repo.commit_in(branch, "one");
    repo.write_in(branch, "x.md", "2\n");
    repo.commit_in(branch, "two");
    repo.push(branch);
    repo.git_in(branch, &["reset", "--quiet", "--hard", "HEAD~2"]);

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
    let repo = repo_with_specs();
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
    let repo = repo_with_specs();
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
    let repo = repo_with_specs();
    feature(
        &repo,
        "change/2026-10-14-reappear",
        &[("proposal.md", "# Reappear\n\nIt breaks.\n".to_string())],
    );

    let output = ura(&repo, &["status"]);

    let working = output.stdout.find("In progress").unwrap();
    assert!(working < output.stdout.find("change/2026-10-14-reappear").unwrap());
    assert_eq!(
        output.row("change/2026-10-14-reappear")[1..],
        ["agent", "change"]
    );
}

/// A worktree's folder is read from its disk: a proposal never committed is an item, waiting on
/// its commit.
#[test]
fn an_uncommitted_proposal_is_an_item_of_its_worktree() {
    let repo = repo_with_specs();
    repo.switch_new("2026-10-11-runner");
    repo.write("specs/2026-10-11-runner/proposal.md", &proposal());

    let output = ura(&repo, &["status"]);

    assert_eq!(output.code, 0, "{}", output.stderr);
    assert!(
        output.stdout.contains("2026-10-11-runner")
            && output.stdout.contains("(uncommitted changes)"),
        "{}",
        output.stdout
    );
}

const WEB_UI: &str = "2026-10-11-web-ui";

fn merged_web_ui() -> TestRepo {
    let repo = repo_with_specs();
    feature(&repo, WEB_UI, &[("proposal.md", proposal())]);
    finish_and_merge(&repo, WEB_UI);
    repo.remove_worktree(WEB_UI);
    repo
}

/// US2.1
#[test]
fn a_merged_record_is_done() {
    let repo = merged_web_ui();
    repo.delete_branch(WEB_UI);

    let output = ura(&repo, &["status"]);

    assert!(!output.stdout.contains(WEB_UI), "{}", output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&ura(&repo, &["status", "--json"]).stdout).unwrap();
    assert_eq!(json["features"][0]["step"]["name"], "done");
}

/// US2.2
#[test]
fn a_merged_feature_with_leftovers_says_so() {
    let repo = merged_web_ui();
    repo.worktree(WEB_UI);

    let output = ura(&repo, &["status"]);

    assert_eq!(
        output.row(WEB_UI),
        [WEB_UI, "-", "merged: its worktree and branch left"]
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

    assert_eq!(output.row(WEB_UI), [WEB_UI, "-", "merged: its branch left"]);
}

/// US1.5: without `gh`, a finished branch's step is the pull request's unknown state.
#[test]
fn a_finished_branch_without_gh_has_its_pull_request_unknown() {
    let repo = repo_with_specs();
    feature(&repo, WEB_UI, &[("proposal.md", proposal())]);
    finish(&repo, WEB_UI);

    let output = ura_in(repo.path(), &["status"], &[("PATH", "/nonexistent")]);

    assert_eq!(
        output.row(WEB_UI),
        [WEB_UI, "agent", "pull-request-unknown"]
    );
}

/// US5.1: a project just set up by `ura init` ends its status with the required files it lacks,
/// never the optional preview decision, and a set-up project prints no setup at all. Catches a
/// status that never prints the setup, or prints the preview decision.
#[test]
fn setup_lists_what_the_project_lacks() {
    let after_init = TestRepo::new();
    let init = ura(&after_init, &["init"]);
    assert_eq!(init.code, 0, "{}", init.stderr);

    let output = ura(&after_init, &["status"]);

    let lines: Vec<&str> = output.stdout.lines().collect();
    assert_eq!(
        lines[lines.len().saturating_sub(5)..],
        [
            "",
            "Setup: 3 files missing",
            "  Constitution: still the template",
            "  Code-quality decision: missing",
            "  Testing decision: missing",
        ],
        "{}",
        output.stdout
    );
    let json: serde_json::Value =
        serde_json::from_str(&ura(&after_init, &["status", "--json"]).stdout).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(
        json["setup"][0],
        serde_json::json!({
            "key": "constitution",
            "name": "Constitution",
            "state": "template",
            "required": true,
        })
    );
    assert_eq!(json["setup"].as_array().unwrap().len(), 4, "{json}");

    let set_up = repo_with_specs();
    set_up.write(
        "specs/CONSTITUTION.md",
        "# Todo constitution\n\n- Keep it small.\n",
    );
    set_up.write("specs/decisions/code-quality.md", "# Code quality\n");
    set_up.write("specs/decisions/testing.md", "# Testing\n");
    set_up.commit("docs: setup");

    let output = ura(&set_up, &["status"]);

    assert!(!output.stdout.contains("Setup:"), "{}", output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&ura(&set_up, &["status", "--json"]).stdout).unwrap();
    assert_eq!(json["setup"], serde_json::json!([]));
}
