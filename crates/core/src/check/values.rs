//! `frontmatter.*`: the fields each kind of file has, and their values, from the skill's status
//! table.

use serde::Serialize;

use crate::files::frontmatter::{self, Frontmatter, Value};
use crate::files::preview;
use crate::workspace::{FileKind, Problem};

use super::{Checked, File};

/// The fields of a kind of file: required ones, then optional ones. `None` for files without
/// frontmatter. A file with optional fields only may have no frontmatter.
fn fields(kind: Checked) -> Option<(&'static [&'static str], &'static [&'static str])> {
    match kind {
        Checked::Workflow(FileKind::Proposal) => Some((&[], &["discovery"])),
        Checked::Workflow(FileKind::Clarifications) | Checked::Triage => Some((&["status"], &[])),
        Checked::Workflow(FileKind::Spec) => Some((
            &["status", "revision", "clarifications", "risk-tier"],
            &["plan-review"],
        )),
        Checked::Workflow(FileKind::Plan) => Some((&["status", "spec-revision"], &[])),
        Checked::Workflow(FileKind::Review) => Some((&["verdict", "commit"], &[])),
        Checked::Decision => Some((&["status", "approved-by"], &[])),
        Checked::PreviewDecision => Some((
            &["status", "approved-by"],
            &["preview-folder", "preview-command"],
        )),
        Checked::Record => Some((&["kind", "finished"], &["pull-request"])),
        _ => None,
    }
}

fn allowed(kind: Checked, key: &str) -> Option<&'static [&'static str]> {
    match (kind, key) {
        (Checked::Workflow(kind), "status") => Some(kind.statuses()),
        (Checked::Triage, "status") => Some(FileKind::Clarifications.statuses()),
        (Checked::Decision | Checked::PreviewDecision, "status") => Some(&["proposed", "active"]),
        (Checked::Record, "kind") => Some(&["feature", "change"]),
        (_, "risk-tier" | "discovery") => Some(&["low", "medium", "high"]),
        (_, "verdict") => Some(&["pending", "approved", "changes-requested"]),
        _ => None,
    }
}

/// The values a field of a workflow file may hold, the one list `check` checks against: the
/// discovery efforts of a proposal, the risk tiers of a spec, a file's statuses. Empty for a field
/// that is not a choice.
pub fn allowed_values(kind: FileKind, key: &str) -> &'static [&'static str] {
    allowed(Checked::Workflow(kind), key).unwrap_or_default()
}

/// A frontmatter field of a file, with what can be written in it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    pub name: String,
    /// 1-based; `None` when the field is missing.
    pub line: Option<u32>,
    /// As written, without quotes or a trailing comment.
    pub value: Option<String>,
    pub kind: FieldKind,
    /// The allowed values: empty unless `Choice` or `Boolean`.
    pub values: Vec<Choice>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FieldKind {
    Choice,
    Integer,
    Boolean,
    Date,
    Text,
}

/// An allowed value of a field.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    pub value: String,
    /// The human's action that sets this value, from the skill's status table.
    pub action: Option<Action>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Action {
    Approve,
    RequestChanges,
    Submit,
}

fn field_kind(kind: Checked, key: &str) -> FieldKind {
    if allowed(kind, key).is_some() {
        return FieldKind::Choice;
    }
    match key {
        "revision" | "clarifications" | "spec-revision" => FieldKind::Integer,
        "plan-review" => FieldKind::Boolean,
        "finished" => FieldKind::Date,
        _ => FieldKind::Text,
    }
}

/// The human's action that sets a value, from the skill's status table.
fn action(kind: Checked, key: &str, value: &str) -> Option<Action> {
    let kind = match kind {
        Checked::Workflow(kind) => kind,
        Checked::Triage => FileKind::Clarifications,
        _ => return None,
    };
    match (kind, key, value) {
        (FileKind::Clarifications, "status", "answered") => Some(Action::Submit),
        (FileKind::Spec | FileKind::Plan, "status", "approved") => Some(Action::Approve),
        (FileKind::Spec | FileKind::Plan, "status", "changes-requested") => {
            Some(Action::RequestChanges)
        }
        _ => None,
    }
}

/// The fields of a kind of file, required then optional, as they stand in `text`: the one list
/// `check` checks against.
pub(super) fn field_list(kind: Checked, text: &str) -> Vec<Field> {
    let Some((required, optional)) = fields(kind) else {
        return Vec::new();
    };
    let front = frontmatter::parse(text).ok();
    required
        .iter()
        .chain(optional)
        .map(|&key| {
            let field_kind = field_kind(kind, key);
            let values: Vec<&str> = match field_kind {
                FieldKind::Choice => allowed(kind, key).unwrap_or_default().to_vec(),
                FieldKind::Boolean => vec!["true", "false"],
                _ => Vec::new(),
            };
            Field {
                name: key.to_string(),
                line: front
                    .as_ref()
                    .and_then(|front| front.line(key))
                    .and_then(|line| u32::try_from(line).ok()),
                value: front
                    .as_ref()
                    .and_then(|front| front.raw(key))
                    .map(str::to_string),
                kind: field_kind,
                values: values
                    .into_iter()
                    .map(|value| Choice {
                        value: value.to_string(),
                        action: action(kind, key, value),
                    })
                    .collect(),
            }
        })
        .collect()
}

fn shown(value: &Value) -> String {
    match value {
        Value::Text(text) => format!("\"{text}\""),
        Value::Integer(number) => number.to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Null => "empty".to_string(),
        Value::Other => "a list or a map".to_string(),
    }
}

/// Checks a file's frontmatter, and returns it when it parses.
pub(super) fn check_frontmatter(
    file: &File<'_>,
    problems: &mut Vec<Problem>,
) -> Option<Frontmatter> {
    let (required, optional) = fields(file.kind)?;
    let front = match frontmatter::parse(file.text) {
        Ok(front) => front,
        Err(frontmatter::FrontmatterError::Missing) if required.is_empty() => return None,
        Err(error) => {
            problems.push(file.problem(Some(1), "frontmatter.parse", error.to_string()));
            return None;
        }
    };
    for key in required {
        if front.get(key).is_none() {
            problems.push(file.problem(None, "frontmatter.missing", format!("no \"{key}\" field")));
        }
    }
    for (key, value) in &front.fields {
        let line = front.line(key);
        if !required.contains(&key.as_str()) && !optional.contains(&key.as_str()) {
            problems.push(file.problem(
                line,
                "frontmatter.unknown",
                format!("unknown field \"{key}\""),
            ));
            continue;
        }
        if let Some(values) = allowed(file.kind, key) {
            let valid = matches!(value, Value::Text(text) if values.contains(&text.as_str()));
            if !valid {
                problems.push(file.problem(
                    line,
                    &format!("frontmatter.{key}"),
                    format!("{key} {} is not one of {}", shown(value), values.join(", ")),
                ));
            }
        }
    }
    if file.kind == Checked::Workflow(FileKind::Spec) {
        check_spec_numbers(file, &front, problems);
    }
    if file.kind == Checked::Workflow(FileKind::Plan) {
        check_plan_revision(file, &front, problems);
    }
    if file.kind == Checked::Record {
        check_finished(file, &front, problems);
    }
    if file.kind == Checked::PreviewDecision {
        for (rule, message) in preview::field_problems(&front) {
            problems.push(file.problem(None, rule, message));
        }
    }
    Some(front)
}

fn positive(
    file: &File<'_>,
    front: &Frontmatter,
    key: &str,
    problems: &mut Vec<Problem>,
) -> Option<i64> {
    match front.get(key)? {
        Value::Integer(number) if *number >= 1 => Some(*number),
        other => {
            problems.push(file.problem(
                front.line(key),
                &format!("frontmatter.{key}"),
                format!("{key} {} is not a number from 1", shown(other)),
            ));
            None
        }
    }
}

fn check_spec_numbers(file: &File<'_>, front: &Frontmatter, problems: &mut Vec<Problem>) {
    positive(file, front, "revision", problems);
    if let Some(included) = positive(file, front, "clarifications", problems) {
        let last = file
            .folder
            .keys()
            .filter_map(|name| match FileKind::of(name) {
                Some((FileKind::Clarifications, round)) => round,
                _ => None,
            })
            .max();
        if let Some(last) = last
            && included > i64::from(last)
        {
            problems.push(file.problem(
                front.line("clarifications"),
                "frontmatter.clarifications",
                format!("clarifications is {included}, but the last round is {last:02}"),
            ));
        }
    }
    if let Some(value) = front.get("plan-review")
        && !matches!(value, Value::Bool(_))
    {
        problems.push(file.problem(
            front.line("plan-review"),
            "frontmatter.plan-review",
            format!("plan-review {} is not true or false", shown(value)),
        ));
    }
}

fn check_plan_revision(file: &File<'_>, front: &Frontmatter, problems: &mut Vec<Problem>) {
    let Some(planned) = positive(file, front, "spec-revision", problems) else {
        return;
    };
    let spec_revision = file
        .folder
        .get("spec.md")
        .and_then(|spec| super::parse_frontmatter(spec))
        .and_then(|spec| spec.integer("revision"));
    if let Some(revision) = spec_revision
        && planned > revision
    {
        problems.push(file.problem(
            front.line("spec-revision"),
            "frontmatter.spec-revision",
            format!("spec-revision is {planned}, but the spec's revision is {revision}"),
        ));
    }
}

/// A record's `finished` is a real `YYYY-MM-DD` date.
fn check_finished(file: &File<'_>, front: &Frontmatter, problems: &mut Vec<Problem>) {
    let Some(value) = front.get("finished") else {
        return;
    };
    let valid = matches!(value, Value::Text(text) if crate::today::Date::parse(text).is_some());
    if !valid {
        problems.push(file.problem(
            front.line("finished"),
            "frontmatter.finished",
            format!("finished {} is not a date: YYYY-MM-DD", shown(value)),
        ));
    }
}
