use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use uraeda_core::api::ApiError;
use uraeda_core::settings::{self, ReviewerOptions, RunOptions, RunPick, StepOptions};

fn tempdir() -> TempDir {
    TempDir::new().expect("a temporary folder")
}

fn file(dir: &Path) -> PathBuf {
    dir.join("config.toml")
}

fn write(dir: &Path, text: &str) {
    fs::write(file(dir), text).unwrap();
}

fn text(dir: &Path) -> String {
    fs::read_to_string(file(dir)).unwrap()
}

fn refused(message: &str) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

fn step(name: &str) -> StepOptions {
    StepOptions {
        step: name.into(),
        ..StepOptions::default()
    }
}

fn agent_reviewer(agent: &str) -> ReviewerOptions {
    ReviewerOptions {
        agent: Some(agent.into()),
        ..ReviewerOptions::default()
    }
}

fn command_reviewer(command: &str) -> ReviewerOptions {
    ReviewerOptions {
        command: Some(command.into()),
        ..ReviewerOptions::default()
    }
}

#[test]
fn writes_a_step_in_its_own_table() {
    let dir = tempdir();
    write(dir.path(), "# mine\n[runs]\nkept = false\n");
    let options = RunOptions {
        steps: vec![StepOptions {
            agent: Some("claude".into()),
            model: Some("opus".into()),
            effort: Some("high".into()),
            new_session: Some(true),
            ..step("spec")
        }],
        ..RunOptions::default()
    };

    let saved = settings::set_run_options(dir.path(), &options).unwrap();

    assert_eq!(
        text(dir.path()),
        "# mine\n[runs]\nkept = false\n\n[runs.steps.spec]\nagent = \"claude\"\nmodel = \"opus\"\neffort = \"high\"\nnew_session = true\n"
    );
    assert_eq!(saved.runs, options);
    assert_eq!(settings::read(dir.path()).unwrap().runs, options);
}

#[test]
fn writes_the_implementers_and_reviewers_and_reads_them_back() {
    let dir = tempdir();
    write(dir.path(), "[runs]\nkept = 3\n");
    let options = RunOptions {
        steps: vec![],
        implementers: Some(RunPick {
            agent: Some("codex".into()),
            ..RunPick::default()
        }),
        reviewers: Some(vec![
            ReviewerOptions {
                instructions: Some("Check the tests.".into()),
                ..agent_reviewer("claude")
            },
            command_reviewer("cargo clippy"),
        ]),
        review_depth: Some("branch".into()),
    };

    settings::set_run_options(dir.path(), &options).unwrap();

    assert_eq!(
        text(dir.path()),
        "[runs]\nkept = 3\nreview_depth = \"branch\"\n\n[runs.implementers]\nagent = \"codex\"\n\n[[runs.reviewers]]\nagent = \"claude\"\ninstructions = \"Check the tests.\"\n\n[[runs.reviewers]]\ncommand = \"cargo clippy\"\n"
    );
    assert_eq!(settings::read(dir.path()).unwrap().runs, options);
    let cleared = settings::set_run_options(dir.path(), &RunOptions::default()).unwrap();
    assert_eq!(cleared.runs, RunOptions::default());
    assert_eq!(text(dir.path()), "[runs]\nkept = 3\n");
}

#[test]
fn reports_where_a_run_option_is_wrong() {
    let dir = tempdir();
    let rows: [(&str, &str); 8] = [
        (
            "# mine\n\n[runs.steps.spec]\neffort = 3\n",
            "line 4, runs.steps.spec.effort: The effort is a name.",
        ),
        (
            "[runs.steps.plan]\nnew_session = \"yes\"\n",
            "line 2, runs.steps.plan.new_session: Starting a new session is true or false.",
        ),
        (
            "[runs.steps.tests]\nagent = \"codex\"\n",
            "line 1, runs.steps.tests: tests is not a step: discovery, spec, plan, build, review, or comments.",
        ),
        (
            "[runs]\nsteps = 1\n",
            "line 2, runs.steps: [runs.steps] is a table of steps.",
        ),
        (
            "[runs]\nreview_depth = \"deep\"\n",
            "line 2, runs.review_depth: deep is not a review depth: waves or branch.",
        ),
        (
            "[runs.implementers]\nmodel = true\n",
            "line 2, runs.implementers.model: The model is a name.",
        ),
        (
            "[[runs.reviewers]]\nagent = \"codex\"\ncommand = \"make\"\n",
            "line 1, runs.reviewers: A reviewer runs an agent or a command, not both.",
        ),
        (
            "[runs]\nreviewers = [1]\n",
            "line 2, runs.reviewers: The reviewers are tables, each under [[runs.reviewers]].",
        ),
    ];
    for (contents, problem) in rows {
        write(dir.path(), contents);

        let error = settings::read(dir.path()).unwrap_err();

        assert_eq!(error.code, "unreadable", "for {contents:?}");
        assert!(
            error.message.ends_with(&format!(": {problem}")),
            "for {contents:?}: {}",
            error.message
        );
    }
}

#[test]
fn checks_a_set_of_run_options() {
    let with_steps = |names: &[&str]| RunOptions {
        steps: names.iter().map(|name| step(name)).collect(),
        ..RunOptions::default()
    };
    let with_reviewer = |reviewer: ReviewerOptions| RunOptions {
        reviewers: Some(vec![reviewer]),
        ..RunOptions::default()
    };
    let empty_agent = || Some(" ".to_owned());
    let rows: [(RunOptions, Result<(), ApiError>); 11] = [
        (
            with_steps(&["discovery", "spec", "plan", "build", "review", "comments"]),
            Ok(()),
        ),
        (with_reviewer(command_reviewer("make check")), Ok(())),
        (
            with_steps(&["tests"]),
            Err(refused(
                "tests is not a step: discovery, spec, plan, build, review, or comments.",
            )),
        ),
        (
            with_steps(&["spec", "plan", "spec"]),
            Err(refused("The spec's options are set twice.")),
        ),
        (
            RunOptions {
                review_depth: Some("deep".into()),
                ..RunOptions::default()
            },
            Err(refused("deep is not a review depth: waves or branch.")),
        ),
        (
            with_reviewer(ReviewerOptions {
                command: Some("make".into()),
                ..agent_reviewer("codex")
            }),
            Err(refused("A reviewer runs an agent or a command, not both.")),
        ),
        (
            with_reviewer(ReviewerOptions::default()),
            Err(refused("A reviewer runs an agent or a command.")),
        ),
        (
            with_reviewer(command_reviewer("  ")),
            Err(refused("A reviewer's command is empty.")),
        ),
        (
            with_reviewer(agent_reviewer("")),
            Err(refused("The agent is empty.")),
        ),
        (
            RunOptions {
                steps: vec![StepOptions {
                    agent: empty_agent(),
                    ..step("spec")
                }],
                ..RunOptions::default()
            },
            Err(refused("The agent is empty.")),
        ),
        (
            RunOptions {
                implementers: Some(RunPick {
                    agent: empty_agent(),
                    ..RunPick::default()
                }),
                ..RunOptions::default()
            },
            Err(refused("The agent is empty.")),
        ),
    ];
    for (options, expected) in rows {
        assert_eq!(
            settings::check_run_options(&options),
            expected,
            "for {options:?}"
        );
    }
}

#[test]
fn refuses_to_write_options_that_do_not_pass_the_check() {
    let dir = tempdir();
    write(dir.path(), "# mine\n");

    let written = settings::set_run_options(
        dir.path(),
        &RunOptions {
            review_depth: Some("deep".into()),
            ..RunOptions::default()
        },
    );

    assert_eq!(
        written,
        Err(refused("deep is not a review depth: waves or branch."))
    );
    assert_eq!(text(dir.path()), "# mine\n");
}

#[test]
fn a_write_keeps_the_unknown_keys_and_comments() {
    let dir = tempdir();
    let reviewers = "[runs]\nkept = 3\n\n# the first\n[[runs.reviewers]]\nagent = \"claude\"\nnotes = \"one\"\n\n# the second\n[[runs.reviewers]]\ncommand = \"make check\"\nnotes = \"two\"\n";
    let rows: [(&str, RunOptions, &str); 3] = [
        (
            "# my spec\n[runs.steps.spec]\nagent = \"claude\"\nnotes = \"keep\"\n\n[runs.implementers]\nagent = \"codex\"\nnotes = \"keep too\"\n",
            RunOptions::default(),
            "# my spec\n[runs.steps.spec]\nnotes = \"keep\"\n\n[runs.implementers]\nnotes = \"keep too\"\n",
        ),
        (
            reviewers,
            RunOptions {
                reviewers: Some(vec![
                    command_reviewer("make check"),
                    agent_reviewer("claude"),
                ]),
                ..RunOptions::default()
            },
            "[runs]\nkept = 3\n\n# the second\n[[runs.reviewers]]\ncommand = \"make check\"\nnotes = \"two\"\n\n# the first\n[[runs.reviewers]]\nagent = \"claude\"\nnotes = \"one\"\n",
        ),
        (
            reviewers,
            RunOptions {
                reviewers: Some(vec![
                    agent_reviewer("codex"),
                    command_reviewer("make check"),
                    ReviewerOptions {
                        model: Some("opus".into()),
                        ..agent_reviewer("claude")
                    },
                ]),
                ..RunOptions::default()
            },
            "[runs]\nkept = 3\n\n[[runs.reviewers]]\nagent = \"codex\"\n\n# the second\n[[runs.reviewers]]\ncommand = \"make check\"\nnotes = \"two\"\n\n# the first\n[[runs.reviewers]]\nagent = \"claude\"\nnotes = \"one\"\nmodel = \"opus\"\n",
        ),
    ];
    for (before, options, after) in rows {
        write(dir.path(), before);

        settings::set_run_options(dir.path(), &options).unwrap();

        assert_eq!(text(dir.path()), after, "for {before:?}");
        assert_eq!(
            settings::read(dir.path()).unwrap().runs,
            options,
            "for {before:?}"
        );
    }
}
