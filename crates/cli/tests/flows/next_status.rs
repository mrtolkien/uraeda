//! `ura status` and `ura next`: where every feature stands, as versioned JSON that tools read, and
//! how a feature is named. Messages are for humans; these flows read the data.

use std::os::unix::fs::PermissionsExt;

use serde_json::Value;

use crate::common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [Waiting](/specs/2026-10-10-waiting/proposal.md)\n- [Building](/specs/2026-10-06-recurring-tasks/proposal.md)\n\n## Next\n\n- Claude Code runner\n";

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-08.", &["A"])
}

fn waiting() -> String {
    clarifications("awaiting-human", "1 question, about 3 minutes.", &[""])
}

fn json(repo: &TestRepo, args: &[&str]) -> Value {
    let output = ura(repo, args);
    assert_eq!(output.code, 0, "{}", output.stderr);
    serde_json::from_str(&output.stdout)
        .unwrap_or_else(|error| panic!("{error}: {}", output.stdout))
}

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", waiting()),
        ],
    );
    let tasks = [("One", 1, 1), ("Repeat menu", 0, 3)];
    feature(
        &repo,
        "2026-10-06-recurring-tasks",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan("auto-approved", 1, &tasks)),
        ],
    );
    repo
}

fn find<'a>(status: &'a Value, folder: &str) -> &'a Value {
    status["features"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["folder"] == folder)
        .unwrap()
}

#[test]
fn status_is_versioned_data_naming_each_item_its_step_and_who_it_waits_on() {
    let repo = repo();

    let status = json(&repo, &["status", "--json"]);

    assert_eq!(status["version"], 1);
    assert_eq!(status["default-branch"], "main");
    let waiting = find(&status, "2026-10-10-waiting");
    assert_eq!(
        (
            waiting["slug"].as_str(),
            waiting["step"]["waits-on"].as_str()
        ),
        (Some("waiting"), Some("human"))
    );
    let building = find(&status, "2026-10-06-recurring-tasks");
    assert_eq!(
        (
            building["step"]["name"].as_str(),
            building["step"]["waits-on"].as_str()
        ),
        (Some("implementation"), Some("agent"))
    );
    assert!(
        status["priorities"]
            .as_array()
            .unwrap()
            .iter()
            .any(|entry| entry["feature"] == "2026-10-10-waiting")
    );
    let human = ura(&repo, &["status"]);
    assert_eq!(
        human.code, 0,
        "the table for humans is not the data: {}",
        human.stderr
    );
}

#[test]
fn a_gate_saved_and_not_committed_leaves_the_step_where_the_commit_has_it() {
    let repo = repo();
    repo.switch("2026-10-10-waiting");
    repo.write(
        "specs/2026-10-10-waiting/clarifications-01.md",
        &clarifications("awaiting-human", "1 question, about 3 minutes.", &["B"]),
    );

    let status = json(&repo, &["status", "--json"]);

    let waiting = find(&status, "2026-10-10-waiting");
    assert_eq!(waiting["step"]["waits-on"], "human");
    assert_eq!(waiting["uncommitted"], true);
}

#[test]
fn next_names_the_first_item_of_now_with_work_for_an_agent_or_says_nothing_is() {
    let repo = repo();

    let next = json(&repo, &["next", "--json"]);

    assert_eq!(next["version"], 1);
    assert_eq!(next["feature"], "2026-10-06-recurring-tasks");
    assert_eq!(next["step"]["name"], "implementation");
    assert!(
        next["step"]["reference"].is_string(),
        "an agent's step names the reference to follow"
    );

    let gate = json(&repo, &["next", "waiting", "--json"]);
    assert_eq!(gate["step"]["waits-on"], "human");
    assert_eq!(gate["step"]["file"], "clarifications-01.md");

    let only_waiting = TestRepo::new();
    specs(&only_waiting, PRIORITIES);
    feature(
        &only_waiting,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", waiting()),
        ],
    );
    let none = json(&only_waiting, &["next", "--json"]);
    assert_eq!(none["step"]["name"], "none");
    assert!(none["feature"].is_null());
}

#[test]
fn a_listed_decision_still_proposed_sends_the_next_step_to_approval() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    let approved = spec("approved", 1, 1).replace(
        "- None.",
        "- **Changed: [Git](../decisions/git.md)**. Tools run the system git.",
    );
    repo.switch_new("2026-10-10-cli-core");
    repo.write("specs/decisions/git.md", &decision("proposed"));
    for (name, text) in [
        ("proposal.md", proposal()),
        ("clarifications-01.md", answered()),
        ("spec.md", approved),
    ] {
        repo.write(&format!("specs/2026-10-10-cli-core/{name}"), &text);
    }
    repo.commit("spec");
    repo.switch("main");

    let next = json(&repo, &["next", "cli-core", "--json"]);

    assert_eq!(next["step"]["name"], "approval");
}

#[test]
fn the_pull_request_state_comes_from_gh_run_in_the_repository_or_is_unknown() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    let tasks = [("One", 2, 2)];
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan("approved", 1, &tasks)),
        ],
    );

    let without = ura_in(
        repo.path(),
        &["next", "cli-core", "--json"],
        &[("PATH", "/nonexistent")],
    );
    let without: Value = serde_json::from_str(&without.stdout).unwrap();
    assert_eq!(without["step"]["name"], "pull-request-unknown");

    let bin = repo.parent().join("bin");
    std::fs::create_dir(&bin).unwrap();
    let gh = bin.join("gh");
    let root = std::fs::canonicalize(repo.path()).unwrap();
    std::fs::write(
        &gh,
        format!(
            "#!/bin/sh\n[ \"$(pwd -P)\" = \"{}\" ] || exit 1\necho '[{{\"headRefName\":\"2026-10-10-cli-core\",\"number\":31,\"url\":\"https://github.com/o/r/pull/31\",\"isDraft\":true,\"reviewDecision\":\"\"}}]'\n",
            root.display()
        ),
    )
    .unwrap();
    std::fs::set_permissions(&gh, std::fs::Permissions::from_mode(0o755)).unwrap();
    let path = format!(
        "{}:{}",
        bin.display(),
        std::env::var("PATH").unwrap_or_default()
    );

    let from_a_subfolder = ura_in(
        &repo.path().join("specs"),
        &["next", "cli-core", "--json"],
        &[("PATH", &path)],
    );

    let known: Value = serde_json::from_str(&from_a_subfolder.stdout).unwrap();
    assert_eq!(
        known["step"]["name"], "finish",
        "{}",
        from_a_subfolder.stdout
    );
    assert_eq!(known["step"]["pull-request"], "draft");
}

#[test]
fn merged_features_are_done_once_and_reminded_on_stderr_when_they_left_something() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    for folder in ["2026-10-10-stack-decision", "2026-10-11-web-ui"] {
        feature(&repo, folder, &[("proposal.md", proposal())]);
        finish_and_merge(&repo, folder);
    }
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/2026-10-11-web-ui",
        "2026-10-11-web-ui",
    ]);

    let status = json(&repo, &["status", "--json"]);
    let next = ura(&repo, &["next"]);

    let done: Vec<&Value> = status["features"]
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
    assert_eq!(next.code, 0);
    assert!(
        next.stderr.contains("2026-10-11-web-ui"),
        "a merged feature with a worktree left is reminded: {}",
        next.stderr
    );
}

#[test]
fn an_item_is_named_by_slug_folder_or_path_and_a_name_that_is_not_one_item_is_refused() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    for folder in ["2026-10-10-web-ui", "2026-10-12-web-editing"] {
        feature(
            &repo,
            folder,
            &[
                ("proposal.md", proposal()),
                ("clarifications-01.md", waiting()),
            ],
        );
    }
    repo.write("crates/a.txt", "a\n");
    repo.commit("crates");

    let by_slug = ura(&repo, &["next", "web-ui", "--json"]);
    let by_folder = ura(&repo, &["next", "2026-10-10-web-ui", "--json"]);
    let by_path = ura_in(
        &repo.path().join("crates"),
        &["next", "../specs/2026-10-10-web-ui", "--json"],
        &[],
    );

    assert_eq!(by_slug.code, 0, "{}", by_slug.stderr);
    assert_eq!(
        (&by_slug.stdout, &by_slug.stdout),
        (&by_folder.stdout, &by_path.stdout)
    );
    assert_eq!(
        ura(&repo, &["next", "web"]).code,
        1,
        "a name matching two items is refused"
    );
    assert_eq!(ura(&repo, &["next", "nothing"]).code, 1);
    assert_eq!(
        ura(&repo, &["answer", "--submit"]).code,
        1,
        "two items wait: the target must be named"
    );
}
