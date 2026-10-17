mod common;

use std::fs;

use common::*;

#[test]
fn the_skill_example_has_no_problems() {
    let output = ura_in(
        &repository(),
        &["check", "skills/uraeda/assets/example/specs"],
        &[],
    );

    assert_eq!(
        output.stdout,
        "skills/uraeda/assets/example/specs/: no problems\n"
    );
    assert_eq!(output.code, 0);
}

#[test]
fn problems_exit_with_one() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/2026-10-10-x/clarifications-02.md",
        "---\nstatus: done\n---\n\n# Clarifications, round 02: X\n",
    );

    let output = ura(&repo, &["check"]);

    assert!(
        output.stdout.contains(
            "specs/2026-10-10-x/clarifications-02.md:2: status \"done\" is not one of awaiting-human, answered\n"
        ),
        "{}",
        output.stdout
    );
    assert!(output.stdout.ends_with(" problems\n"), "{}", output.stdout);
    assert_eq!(output.code, 1);
}

/// US1.2: a round whose Context has no Sources fails.
#[test]
fn a_round_without_its_sources_fails() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let round = clarifications("awaiting-human", "1 question, about 5 minutes.", &[""]);
    assert!(round.contains("### Sources\n"), "{round}");
    repo.write(
        "specs/2026-10-10-x/clarifications-01.md",
        &round.replacen("### Sources\n", "", 1),
    );

    let output = ura(&repo, &["check", "specs/2026-10-10-x/clarifications-01.md"]);

    assert_eq!(
        output.stdout,
        "specs/2026-10-10-x/clarifications-01.md: missing section \"### Sources\"\n1 problem\n"
    );
    assert_eq!(output.code, 1);
}

/// US1.4: warnings print after the errors, prefixed `warning: `, and alone exit with success.
#[test]
fn warnings_print_after_errors_and_exit_with_success() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    let path = "specs/2026-10-10-x/clarifications-01.md";
    let round = clarifications(
        "awaiting-human",
        "1 question and 1 follow-up, about 5 minutes.",
        &[""],
    );
    repo.write(path, &round);

    let output = ura(&repo, &["check", path]);

    assert_eq!(
        output.stdout,
        format!("warning: {path}:9: the block says 1 follow-up, the round has 0\n1 warning\n")
    );
    assert_eq!(output.code, 0);

    repo.write(path, &round.replacen("### Sources\n", "", 1));

    let output = ura(&repo, &["check", path]);

    assert_eq!(
        output.stdout,
        format!(
            "{path}: missing section \"### Sources\"\n\
             warning: {path}:9: the block says 1 follow-up, the round has 0\n\
             1 problem, 1 warning\n"
        )
    );
    assert_eq!(output.code, 1);

    let output = ura(&repo, &["check", "--json", path]);

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["problems"][0]["severity"], "error");
    assert_eq!(json["problems"][1]["severity"], "warning");
    assert_eq!(json["problems"][1]["rule"], "block.count");
}

#[test]
fn json_lists_problems() {
    let repo = TestRepo::new();
    specs(&repo, "# Priorities\n\n## Now\n\n## Next\n\n## Later\n");

    let output = ura(&repo, &["check", "--json"]);

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["problems"][0]["file"], "specs/PRIORITIES.md");
    assert_eq!(json["problems"][0]["rule"], "sections.missing");
    assert_eq!(
        json["problems"][0]["message"],
        "missing section \"## Blocked\""
    );
    assert_eq!(output.code, 1);
}

#[test]
fn every_broken_fixture_fails() {
    let broken = repository().join("fixtures/broken");
    for entry in fs::read_dir(&broken).unwrap() {
        let path = entry.unwrap().path();
        let relative = format!(
            "fixtures/broken/{}",
            path.file_name().unwrap().to_string_lossy()
        );

        let output = ura_in(&repository(), &["check", &relative], &[]);

        assert_eq!(output.code, 1, "{relative}: {}", output.stdout);
        assert!(
            output.stdout.starts_with(&relative),
            "{relative}: {}",
            output.stdout
        );
    }
}

#[test]
fn missing_target() {
    let output = ura_in(&repository(), &["check", "specs/missing"], &[]);

    assert_eq!(
        output.stderr,
        "ura: specs/missing: no such file or folder\n"
    );
    assert_eq!(output.code, 1);
}

/// Pull request review: a finished feature's check covers its record only.
#[test]
fn a_finished_features_check_covers_its_record_only() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/done/2026-10-10-cli-core.md",
        &record("feature", "CLI core"),
    );
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        "---\nkind: feature\n---\n\n# Record: Web UI\n",
    );
    repo.commit("finish: two features");

    let output = ura(&repo, &["check", "cli-core"]);

    assert_eq!(
        output.stdout,
        "specs/done/2026-10-10-cli-core.md: no problems\n"
    );
    assert_eq!(output.code, 0, "{}", output.stderr);
}

/// Two categories with the same name, written by hand.
#[test]
fn a_repeated_inbox_category_is_a_problem() {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## UI\n\n- a\n\n## UI\n\n- b\n",
    );

    let output = ura(&repo, &["check", "--json"]);

    let json: serde_json::Value = serde_json::from_str(&output.stdout).unwrap();
    assert_eq!(json["problems"][0]["file"], "specs/INBOX.md");
    assert_eq!(json["problems"][0]["line"], 7);
    assert_eq!(json["problems"][0]["rule"], "inbox.category");
    assert_eq!(
        json["problems"][0]["message"],
        "the category \"UI\" is repeated"
    );
    assert_eq!(output.code, 1);
}
