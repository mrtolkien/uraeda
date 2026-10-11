//! `frontmatter.*`: the fields each kind of file has, and their values, from the skill's status
//! table.

use crate::files::frontmatter::{self, Frontmatter, Value};
use crate::workspace::{FileKind, Problem};

use super::{Checked, File};

/// The fields of a kind of file: required ones, then optional ones. `None` for files without
/// frontmatter.
fn fields(kind: Checked) -> Option<(&'static [&'static str], &'static [&'static str])> {
    match kind {
        Checked::Workflow(FileKind::Clarifications | FileKind::Assessment) => {
            Some((&["status"], &[]))
        }
        Checked::Workflow(FileKind::Spec) => Some((
            &["status", "revision", "clarifications", "risk-tier"],
            &["plan-review"],
        )),
        Checked::Workflow(FileKind::Plan) => Some((&["status", "spec-revision"], &[])),
        Checked::Workflow(FileKind::Review) => Some((&["verdict", "commit"], &[])),
        Checked::Decision => Some((&["status", "approved-by"], &[])),
        _ => None,
    }
}

fn allowed(kind: Checked, key: &str) -> Option<&'static [&'static str]> {
    match (kind, key) {
        (Checked::Workflow(kind), "status") => Some(kind.statuses()),
        (Checked::Decision, "status") => Some(&["proposed", "active"]),
        (_, "risk-tier") => Some(&["low", "medium", "high"]),
        (_, "verdict") => Some(&["pending", "approved", "changes-requested"]),
        _ => None,
    }
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
    if let Some(value) = front.get("plan-review") {
        if front.text("risk-tier") != Some("medium") {
            problems.push(file.problem(
                front.line("plan-review"),
                "frontmatter.plan-review",
                "plan-review is only for risk-tier: medium",
            ));
        } else if !matches!(value, Value::Bool(_)) {
            problems.push(file.problem(
                front.line("plan-review"),
                "frontmatter.plan-review",
                format!("plan-review {} is not true or false", shown(value)),
            ));
        }
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
