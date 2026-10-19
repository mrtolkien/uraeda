//! `ura check`: every result at its own severity, as versioned JSON for tools and an exit code for
//! scripts. The problems decision's CLI rule: a note is the UI's reading of an error.

use std::fs;

use serde_json::Value;

use crate::common::*;

const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n";

fn json(repo: &TestRepo, args: &[&str]) -> (Value, i32) {
    let output = ura(repo, args);
    (
        serde_json::from_str(&output.stdout)
            .unwrap_or_else(|error| panic!("{error}: {}", output.stdout)),
        output.code,
    )
}

#[test]
fn the_skills_example_passes_and_every_broken_fixture_fails() {
    let example = ura_in(
        &repository(),
        &["check", "skills/uraeda/assets/example/specs"],
        &[],
    );
    assert_eq!(example.code, 0, "{}", example.stdout);

    let broken = repository().join("fixtures/broken");
    let mut checked = 0;
    for entry in fs::read_dir(&broken).unwrap() {
        let relative = format!(
            "fixtures/broken/{}",
            entry.unwrap().file_name().to_string_lossy()
        );

        let output = ura_in(&repository(), &["check", &relative], &[]);

        assert_eq!(output.code, 1, "{relative}: {}", output.stdout);
        assert!(
            output.stdout.starts_with(&relative),
            "{relative}: {}",
            output.stdout
        );
        checked += 1;
    }
    assert!(checked > 0, "the fixtures were found");
}

#[test]
fn json_lists_every_result_with_its_rule_file_and_severity() {
    let repo = TestRepo::new();
    specs(&repo, "# Priorities\n\n## Now\n\n## Next\n\n## Later\n");
    repo.write(
        "specs/INBOX.md",
        "# Inbox\n\n## UI\n\n- a\n\n## UI\n\n- b\n",
    );

    let (json, code) = json(&repo, &["check", "--json"]);

    assert_eq!(json["version"], 1);
    assert_eq!(code, 1, "an error fails the check");
    let problems = json["problems"].as_array().unwrap();
    let rule = |name: &str| {
        problems
            .iter()
            .find(|p| p["rule"] == name)
            .unwrap_or_else(|| panic!("no {name} in {problems:?}"))
    };
    assert_eq!(rule("sections.missing")["file"], "specs/PRIORITIES.md");
    assert_eq!(rule("inbox.category")["file"], "specs/INBOX.md");
    assert!(
        problems
            .iter()
            .all(|p| p["severity"] == "error" || p["severity"] == "warning")
    );
}

#[test]
fn a_warning_alone_succeeds_and_an_error_beside_it_fails() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    let path = "specs/2026-10-10-x/clarifications-01.md";
    let round = clarifications(
        "awaiting-human",
        "1 question and 1 follow-up, about 5 minutes.",
        &[""],
    );
    repo.write(path, &round);

    let (alone, code) = json(&repo, &["check", "--json", path]);
    assert_eq!(code, 0, "{alone}");
    assert_eq!(alone["problems"][0]["severity"], "warning");

    repo.write(path, &round.replacen("### Sources\n", "", 1));
    let (both, code) = json(&repo, &["check", "--json", path]);

    assert_eq!(code, 1);
    let severities: Vec<&str> = both["problems"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["severity"].as_str().unwrap())
        .collect();
    assert!(
        severities.contains(&"error") && severities.contains(&"warning"),
        "{severities:?}"
    );
}

#[test]
fn a_target_is_a_folder_a_file_or_a_name_and_a_missing_one_is_refused() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    repo.write(
        "specs/done/2026-10-10-cli-core.md",
        &record("feature", "CLI core"),
    );
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        "---\nkind: feature\n---\n\n# Record: Web UI\n",
    );
    repo.commit("finish: two features");

    let by_name = ura(&repo, &["check", "cli-core"]);

    assert_eq!(
        by_name.code, 0,
        "a finished feature's check covers its record only: {}",
        by_name.stdout
    );
    assert_eq!(ura(&repo, &["check", "specs/missing"]).code, 1);
    assert_eq!(
        ura(&TestRepo::new(), &["check"]).code,
        1,
        "no specs/ folder: run ura init"
    );
}

#[test]
fn a_feature_whose_files_break_a_rule_that_stops_the_workflow_is_reported_by_status_too() {
    let repo = TestRepo::new();
    specs(&repo, PRIORITIES);
    feature(
        &repo,
        "2026-10-10-x",
        &[
            ("proposal.md", proposal()),
            (
                "clarifications-01.md",
                clarifications("awaiting-human", "1 question.", &[""])
                    .replace("status: awaiting-human", "status: done"),
            ),
        ],
    );

    let (status, _) = json(&repo, &["status", "--json"]);

    let feature = status["features"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["folder"] == "2026-10-10-x")
        .unwrap();
    assert_eq!(feature["step"]["name"], "none", "the step cannot be found");
    assert!(!feature["problems"].as_array().unwrap().is_empty());
}
