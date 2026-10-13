mod common;

use common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n- [Waiting](/specs/2026-10-10-waiting/proposal.md)\n- [Building](/specs/2026-10-06-recurring-tasks/proposal.md)\n\n## Next\n";

fn answered() -> String {
    clarifications("answered", "Answered on 2026-10-08.", &["A"])
}

#[test]
fn step_of_one_feature() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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
        "2026-10-10-cli-core: spec\n  branch     2026-10-10-cli-core\n  follow     skills/uraeda/references/spec.md\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

#[test]
fn first_feature_of_now_with_work_for_an_agent() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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
fn approval_when_a_linked_decision_is_proposed() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    let approved = spec("approved", 1, 1).replace(
        "- None.",
        "- [Git](../decisions/git.md): tools run the system git.",
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

    let output = ura(&repo, &["next", "2026-10-10-cli-core"]);

    assert!(
        output.stdout.starts_with("2026-10-10-cli-core: approval\n"),
        "{}",
        output.stdout
    );
}

#[test]
fn pull_request_state_unknown_without_gh() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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
        Some("2026-10-10-cli-core: pull-request (pull request state unknown)")
    );
}

/// `gh` finds the repository from its current folder, so it runs at the repository's top level,
/// whatever folder `ura` runs from: a fake `gh` answers only there.
#[test]
fn gh_runs_in_the_repository() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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
    let bin = repo.parent().join("bin");
    std::fs::create_dir(&bin).unwrap();
    let gh = bin.join("gh");
    std::fs::write(
        &gh,
        format!(
            "#!/bin/sh\n[ \"$(pwd -P)\" = \"{}\" ] || exit 1\necho '[{{\"reviewDecision\":\"\",\"isDraft\":true}}]'\n",
            std::fs::canonicalize(repo.path()).unwrap().display()
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

    let output = ura_in(
        &repo.path().join("specs"),
        &["next", "cli-core", "--json"],
        &[("PATH", &path)],
    );

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["step"]["name"], "finish", "{}", output.stdout);
    assert_eq!(json["step"]["pull-request"], "draft", "{}", output.stdout);
}

#[test]
fn nothing_for_an_agent() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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
    specs(&repo, PRIORITIES);

    let output = ura(&repo, &["next"]);

    assert_eq!(
        output.stdout,
        "Nothing for an agent: every feature in Now waits on you. Run ura status.\n"
    );
}

#[test]
fn a_gate_says_who_it_waits_on() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
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

/// US2.3
#[test]
fn leftovers_are_reminded_on_stderr() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(&repo, "2026-10-11-web-ui", &[("proposal.md", proposal())]);
    finish_and_merge(&repo, "2026-10-11-web-ui");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        ".worktrees/2026-10-11-web-ui",
        "2026-10-11-web-ui",
    ]);

    let output = ura(&repo, &["next"]);

    assert_eq!(
        output.stderr,
        "ura: 2026-10-11-web-ui is merged, with its worktree and branch left: run ura clean\n"
    );
    assert_eq!(output.code, 0);
}
