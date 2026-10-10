// TEMPORARY: replaced by the CLI feature.
mod common;

use common::{fixture, rows, summary};
use uraeda_core::temporary_status::{CoreError, temporary_read_folder, temporary_read_specs};

#[test]
fn reads_statuses_in_workflow_order() {
    let folder = temporary_read_folder(&fixture("specs/2026-10-10-stack-decision")).unwrap();

    assert_eq!(folder.name, "2026-10-10-stack-decision");
    assert_eq!(
        summary(&folder),
        rows(&[
            ("clarifications-01.md", "answered"),
            ("clarifications-02.md", "awaiting-human"),
            ("spec.md", "awaiting-human"),
        ])
    );
}

#[test]
fn plan_with_unknown_status_is_invalid() {
    let folder = temporary_read_folder(&fixture("specs/2026-10-06-recurring-tasks")).unwrap();

    assert_eq!(
        summary(&folder),
        rows(&[
            ("clarifications-01.md", "answered"),
            ("spec.md", "approved"),
            ("plan.md", "invalid: unknown status \"done\""),
        ])
    );
}

#[test]
fn reports_each_invalid_file() {
    let folder = temporary_read_folder(&fixture("broken")).unwrap();
    let mut actual = summary(&folder);
    let (_, yaml) = actual.remove(1);

    assert!(
        yaml.starts_with("invalid: frontmatter is not valid YAML: "),
        "{yaml}"
    );
    assert_eq!(
        actual,
        rows(&[
            ("clarifications-01.md", "invalid: no frontmatter"),
            ("clarifications-03.md", "invalid: no status field"),
            ("clarifications-04.md", "invalid: status is not a string"),
            (
                "clarifications-05.md",
                "invalid: unknown status \"approved\""
            ),
            (
                "clarifications-06.md",
                "invalid: unknown status \"Approved\""
            ),
            ("clarifications-07.md", "invalid: not UTF-8"),
            ("spec.md", "approved"),
        ])
    );
}

#[test]
fn folder_without_workflow_files_is_empty() {
    let folder = temporary_read_folder(&fixture("empty")).unwrap();

    assert_eq!(folder.files, []);
}

#[test]
fn missing_folder_is_an_error() {
    let error = temporary_read_folder(&fixture("missing")).unwrap_err();

    assert!(matches!(error, CoreError::NoSuchFolder(_)));
    assert!(error.to_string().ends_with("missing: no such folder"));
}

#[test]
fn file_is_not_a_folder() {
    let error = temporary_read_folder(&fixture("broken/spec.md")).unwrap_err();

    assert!(error.to_string().ends_with("spec.md: not a folder"));
}

#[test]
fn lists_feature_folders_newest_first() {
    let specs = temporary_read_specs(&fixture("specs")).unwrap();

    let names: Vec<_> = specs.iter().map(|folder| folder.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "2026-13-99-not-a-date",
            "2026-10-12-keyboard-shortcuts",
            "2026-10-10-stack-decision",
            "2026-10-06-recurring-tasks",
        ]
    );
}

#[test]
fn no_feature_folders_is_empty() {
    let specs = temporary_read_specs(&fixture("no-features/specs")).unwrap();

    assert_eq!(specs, []);
}
