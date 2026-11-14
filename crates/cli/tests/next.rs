mod common;

use common::*;

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-08.", &["A"])
}

#[test]
fn step_of_one_feature() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
        ],
    );

    let output = ura(&repo, &["next", "cli-core"]);

    assert_eq!(
        output.stdout,
        "2026-10-10-cli-core: spec\n  branch     2026-10-10-cli-core\n  follow     skills/uraeda/references/spec.md\n  pick       the session's own\n  session    join: run it in this session\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn first_feature_with_work_for_an_agent() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
            ),
        ],
    );
    feature(
        &repo,
        "2026-10-06-recurring-tasks",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            (
                "plan.md",
                plan(
                    "auto-approved",
                    1,
                    &[("One", 1, 1), ("Two", 1, 1), ("Repeat menu", 0, 3)],
                ),
            ),
        ],
    );

    let output = ura(&repo, &["next"]);

    assert_eq!(
        output.stdout.lines().next(),
        Some("2026-10-06-recurring-tasks: implementation, Task 3: Repeat menu")
    );
}

#[test]
fn pull_request_state_unknown_without_gh() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan("approved", 1, &[("One", 2, 2)])),
        ],
    );

    let output = ura_in(
        repo.path(),
        &["next", "cli-core"],
        &[("PATH", "/nonexistent")],
    );

    assert_eq!(
        output.stdout.lines().next(),
        Some("2026-10-10-cli-core: pull-request-unknown")
    );
}

/// `gh` finds the repository from its current folder, so it runs at the repository's top level,
/// whatever folder `ura` runs from: a fake `gh` answers only there.
#[test]
fn gh_runs_in_the_repository() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan("approved", 1, &[("One", 2, 2)])),
        ],
    );
    let path = fake_gh(
        &repo,
        &format!(
            "[ \"$(pwd -P)\" = \"{}\" ] || exit 1\necho '[{{\"headRefName\":\"2026-10-10-cli-core\",\"headRefOid\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"number\":31,\"url\":\"https://github.com/o/r/pull/31\",\"isDraft\":true,\"reviewDecision\":\"\"}}]'",
            std::fs::canonicalize(repo.path()).unwrap().display()
        ),
    );

    let output = ura_in(
        &repo.path().join("specs"),
        &["next", "cli-core", "--json"],
        &[("PATH", &path)],
    );

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["step"]["name"], "finish", "{}", output.stdout);
    assert_eq!(json["step"]["pull-request"], "draft", "{}", output.stdout);
}

/// US5.1: an open pull request whose head lacks the branch's latest commit names the push, not the
/// human's review.
#[test]
fn push_when_the_pull_request_lacks_the_latest_commit() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
            ("spec.md", spec("approved", 1, 1)),
            ("plan.md", plan("approved", 1, &[("One", 2, 2)])),
        ],
    );
    let head = repo.git(&["rev-parse", "2026-10-10-cli-core"]);
    repo.write_in(
        "2026-10-10-cli-core",
        "src/fix.rs",
        "// a fix after the review\n",
    );
    repo.commit_in("2026-10-10-cli-core", "fix: after the review");
    let path = fake_gh(
        &repo,
        &format!(
            "[ \"$4\" = open ] || {{ echo '[]'; exit 0; }}\necho '[{{\"headRefName\":\"2026-10-10-cli-core\",\"headRefOid\":\"{}\",\"number\":31,\"url\":\"https://github.com/o/r/pull/31\",\"isDraft\":false,\"reviewDecision\":\"\"}}]'",
            head.trim()
        ),
    );

    let output = ura_in(repo.path(), &["next", "cli-core"], &[("PATH", &path)]);

    assert_eq!(
        output.stdout,
        "2026-10-10-cli-core: push\n  branch     2026-10-10-cli-core\n  follow     skills/uraeda/references/implementation.md\n  pick       the session's own\n  session    join: run it in this session\n"
    );
}

/// A `gh` in a new folder, running `script` after its shebang, and the `PATH` that finds it first.
fn fake_gh(repo: &TestRepo, script: &str) -> String {
    let bin = repo.parent().join("bin");
    std::fs::create_dir(&bin).unwrap();
    let gh = bin.join("gh");
    std::fs::write(&gh, format!("#!/bin/sh\n{script}\n")).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&gh, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    format!(
        "{}:{}",
        bin.display(),
        std::env::var("PATH").unwrap_or_default()
    )
}

#[test]
fn nothing_for_an_agent() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
            ),
        ],
    );

    let output = ura(&repo, &["next", "--json"]);

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["step"]["name"], "none");
    assert_eq!(json["feature"], serde_json::Value::Null);
    assert_eq!(output.code, 0);
}

#[test]
fn nothing_for_an_agent_in_words() {
    let repo = TestRepo::new();
    specs(&repo);

    let output = ura(&repo, &["next"]);

    assert_eq!(
        output.stdout,
        "Nothing for an agent: every feature waits on you. Run ura status.\n"
    );
}

#[test]
fn a_gate_says_who_it_waits_on() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-waiting",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
            ),
        ],
    );

    let output = ura(&repo, &["next", "waiting"]);

    assert_eq!(
        output.stdout,
        "2026-10-10-waiting: clarifications-01.md: 1 question, about 3 minutes.\n  branch     2026-10-10-waiting\n  waits on   you\n"
    );
}

/// The step's pick and session come from the human's settings: the plan starts a new session by
/// default, and the build names its implementers and reviewers.
#[test]
fn the_pick_and_session_come_from_the_settings() {
    let repo = TestRepo::new();
    specs(&repo);
    feature(
        &repo,
        "2026-10-10-cli-core",
        &[
            ("proposal.md", proposal()),
            ("clarifications-01.md", answered()),
        ],
    );
    let config = tempfile::TempDir::new().unwrap();
    std::fs::write(
        config.path().join("config.toml"),
        "[runs.steps.spec]\nagent = \"claude\"\nmodel = \"opus\"\neffort = \"high\"\nnew_session = true\n",
    )
    .unwrap();
    let dir = config.path().to_str().unwrap();

    let output = ura_in(
        repo.path(),
        &["next", "cli-core"],
        &[("URAEDA_CONFIG_DIR", dir)],
    );
    let json = ura_in(
        repo.path(),
        &["next", "cli-core", "--json"],
        &[("URAEDA_CONFIG_DIR", dir)],
    );

    assert!(
        output.stdout.contains("  pick       claude, opus, high\n"),
        "{}",
        output.stdout
    );
    assert!(
        output.stdout.contains("  session    new:"),
        "{}",
        output.stdout
    );
    let json: serde_json::Value = serde_json::from_str(&json.stdout).unwrap();
    assert_eq!(json["run"]["setting"], "spec");
    assert_eq!(json["run"]["session"], "new");
    assert_eq!(json["run"]["pick"]["model"], "opus");
}
