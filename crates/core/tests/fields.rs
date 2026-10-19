mod common;

use std::path::{Path, PathBuf};

use common::texts;
use tempfile::TempDir;
use uraeda_core::check::{self, Action, Field, FieldKind};

const FEATURE: &str = "specs/2026-10-13-x";

/// The fields of a file at `path` from the root, holding `text`.
fn fields_of(root: &Path, path: &str, text: &str) -> Vec<Field> {
    check::fields(root, &root.join(path), text)
}

fn root() -> (TempDir, PathBuf) {
    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();
    (dir, root)
}

fn names(fields: &[Field]) -> Vec<&str> {
    fields.iter().map(|field| field.name.as_str()).collect()
}

fn values(field: &Field) -> Vec<&str> {
    field
        .values
        .iter()
        .map(|choice| choice.value.as_str())
        .collect()
}

#[test]
fn a_spec_lists_its_fields_with_their_values_and_actions() {
    let (_dir, root) = root();
    let text = texts::spec("awaiting-human", 1, 1);

    let fields = fields_of(&root, &format!("{FEATURE}/spec.md"), &text);

    assert_eq!(
        names(&fields),
        [
            "status",
            "revision",
            "clarifications",
            "risk-tier",
            "plan-review"
        ]
    );
    let status = &fields[0];
    assert_eq!(status.line, Some(2));
    assert_eq!(status.value.as_deref(), Some("awaiting-human"));
    assert_eq!(status.kind, FieldKind::Choice);
    assert_eq!(
        values(status),
        ["awaiting-human", "approved", "changes-requested"]
    );
    assert_eq!(status.values[0].action, None);
    assert_eq!(status.values[1].action, Some(Action::Approve));
    assert_eq!(status.values[2].action, Some(Action::RequestChanges));
    assert_eq!(fields[1].kind, FieldKind::Integer);
    assert_eq!(fields[1].value.as_deref(), Some("1"));
    assert!(fields[1].values.is_empty());
    assert_eq!(fields[2].kind, FieldKind::Integer);
    assert_eq!(fields[3].kind, FieldKind::Choice);
    assert_eq!(values(&fields[3]), ["low", "medium", "high"]);
    assert_eq!(fields[4].kind, FieldKind::Boolean);
    assert_eq!(fields[4].line, None);
    assert_eq!(fields[4].value, None);
    assert_eq!(values(&fields[4]), ["true", "false"]);
}

#[test]
fn a_round_offers_submit_on_answered() {
    let (_dir, root) = root();
    let text = texts::clarifications("awaiting-human", "Questions.", &[""]);

    let fields = fields_of(&root, &format!("{FEATURE}/clarifications-01.md"), &text);

    assert_eq!(names(&fields), ["status", "resumes"]);
    assert_eq!(values(&fields[0]), ["awaiting-human", "answered"]);
    assert_eq!(values(&fields[1]), ["implementation"]);
    assert_eq!(fields[0].values[0].action, None);
    assert_eq!(fields[0].values[1].action, Some(Action::Submit));
}

#[test]
fn a_proposal_without_its_optional_field_lists_it_without_a_line() {
    let (_dir, root) = root();

    let fields = fields_of(&root, &format!("{FEATURE}/proposal.md"), "# Proposal\n");

    assert_eq!(names(&fields), ["discovery"]);
    assert_eq!(fields[0].line, None);
    assert_eq!(fields[0].value, None);
    assert_eq!(fields[0].kind, FieldKind::Choice);
    assert_eq!(values(&fields[0]), ["low", "medium", "high"]);
    assert!(
        fields[0]
            .values
            .iter()
            .all(|choice| choice.action.is_none())
    );
}

#[test]
fn a_value_is_read_without_its_comment() {
    let (_dir, root) = root();
    let text = "---\ndiscovery: high # low, medium, or high\n---\n\n# Proposal\n";

    let fields = fields_of(&root, &format!("{FEATURE}/proposal.md"), text);

    assert_eq!(fields[0].line, Some(2));
    assert_eq!(fields[0].value.as_deref(), Some("high"));
}

/// A field's name, kind, and allowed values joined with commas.
type Shape<'a> = (&'a str, (FieldKind, String));

/// One row per kind of file: its fields, kinds, and values, as `check` requires them.
#[test]
fn every_kind_lists_the_fields_check_requires() {
    let (_dir, root) = root();
    let choice = |values: &[&str]| (FieldKind::Choice, values.join(","));
    let plain = |kind: FieldKind| (kind, String::new());
    let human = ["awaiting-human", "approved", "changes-requested"];
    let rows: Vec<(String, Vec<Shape<'_>>)> = vec![
        (
            format!("{FEATURE}/proposal.md"),
            vec![("discovery", choice(&["low", "medium", "high"]))],
        ),
        (
            format!("{FEATURE}/clarifications-02.md"),
            vec![
                ("status", choice(&["awaiting-human", "answered"])),
                ("resumes", choice(&["implementation"])),
            ],
        ),
        (
            format!("{FEATURE}/spec.md"),
            vec![
                ("status", choice(&human)),
                ("revision", plain(FieldKind::Integer)),
                ("clarifications", plain(FieldKind::Integer)),
                ("risk-tier", choice(&["low", "medium", "high"])),
                ("plan-review", (FieldKind::Boolean, "true,false".into())),
            ],
        ),
        (
            format!("{FEATURE}/plan.md"),
            vec![
                (
                    "status",
                    choice(&[
                        "awaiting-human",
                        "auto-approved",
                        "approved",
                        "changes-requested",
                    ]),
                ),
                ("spec-revision", plain(FieldKind::Integer)),
            ],
        ),
        (
            format!("{FEATURE}/spec-review.md"),
            vec![
                (
                    "verdict",
                    choice(&["pending", "approved", "changes-requested"]),
                ),
                ("commit", plain(FieldKind::Text)),
            ],
        ),
        (
            "specs/decisions/storage.md".into(),
            vec![
                ("status", choice(&["proposed", "active"])),
                ("approved-by", plain(FieldKind::Text)),
                ("icon", plain(FieldKind::Text)),
            ],
        ),
        (
            "specs/done/2026-10-11-x.md".into(),
            vec![
                ("kind", choice(&["feature", "change"])),
                ("finished", plain(FieldKind::Date)),
                ("pull-request", plain(FieldKind::Text)),
            ],
        ),
        (
            "specs/changes/2026-10-12-y/clarifications-01.md".into(),
            vec![
                ("status", choice(&["awaiting-human", "answered"])),
                ("resumes", choice(&["implementation"])),
            ],
        ),
        ("specs/changes/2026-10-12-y/assessment.md".into(), vec![]),
        ("specs/PRIORITIES.md".into(), vec![]),
        ("specs/drafts/an-idea.md".into(), vec![]),
        (format!("{FEATURE}/rulings.md"), vec![]),
    ];
    for (path, expected) in rows {
        let fields = fields_of(&root, &path, "");
        let found: Vec<Shape<'_>> = fields
            .iter()
            .map(|field| (field.name.as_str(), (field.kind, values(field).join(","))))
            .collect();
        assert_eq!(found, expected, "{path}");
    }
}

#[test]
fn verdicts_of_specs_and_plans_are_actions() {
    let (_dir, root) = root();
    for path in [format!("{FEATURE}/spec.md"), format!("{FEATURE}/plan.md")] {
        let fields = fields_of(&root, &path, "");
        let actions: Vec<(&str, Option<Action>)> = fields[0]
            .values
            .iter()
            .filter(|choice| choice.action.is_some())
            .map(|choice| (choice.value.as_str(), choice.action))
            .collect();
        assert_eq!(
            actions,
            [
                ("approved", Some(Action::Approve)),
                ("changes-requested", Some(Action::RequestChanges))
            ],
            "{path}"
        );
    }
}

#[test]
fn fields_serialize_in_camel_case() {
    let (_dir, root) = root();
    let fields = fields_of(
        &root,
        &format!("{FEATURE}/spec.md"),
        &texts::spec("awaiting-human", 1, 1),
    );

    let json = serde_json::to_value(&fields[0]).unwrap();

    assert_eq!(json["name"], "status");
    assert_eq!(json["line"], 2);
    assert_eq!(json["kind"], "choice");
    assert_eq!(json["values"][1]["value"], "approved");
    assert_eq!(json["values"][1]["action"], "approve");
    assert_eq!(json["values"][2]["action"], "requestChanges");
}
