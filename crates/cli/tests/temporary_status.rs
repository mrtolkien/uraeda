// TEMPORARY: replaced by the CLI feature.
mod common;

use common::{fixture, ura};

#[test]
fn prints_statuses_aligned() {
    let output = ura(&["status", &fixture("specs/2026-10-10-stack-decision")]);

    assert_eq!(
        output.stdout,
        "clarifications-01.md  answered\n\
         clarifications-02.md  awaiting-human\n\
         spec.md               awaiting-human\n"
    );
    assert_eq!(output.code, 0);
}

#[test]
fn invalid_file_exits_with_one() {
    let output = ura(&["status", &fixture("specs/2026-10-06-recurring-tasks")]);

    assert!(
        output
            .stdout
            .ends_with("plan.md               invalid: unknown status \"done\"\n"),
        "{}",
        output.stdout
    );
    assert_eq!(output.code, 1);
}

#[test]
fn missing_folder() {
    let output = ura(&["status", "missing/"]);

    assert_eq!(output.stderr, "ura: missing/: no such folder\n");
    assert_eq!(output.code, 1);
}

#[test]
fn not_a_folder() {
    let path = fixture("broken/spec.md");

    let output = ura(&["status", &path]);

    assert_eq!(output.stderr, format!("ura: {path}: not a folder\n"));
    assert_eq!(output.code, 1);
}

#[test]
fn no_workflow_files() {
    let path = fixture("empty");

    let output = ura(&["status", &path]);

    assert_eq!(output.stdout, format!("No workflow files in {path}\n"));
    assert_eq!(output.code, 0);
}

#[test]
fn help_marks_status_temporary() {
    let output = ura(&["--help"]);

    let line = output
        .stdout
        .lines()
        .find(|line| line.trim_start().starts_with("status"))
        .unwrap();
    assert!(line.ends_with("(temporary)"), "{line}");
}

#[test]
fn unknown_command_exits_with_two() {
    let output = ura(&["nope"]);

    assert_eq!(output.code, 2);
}
