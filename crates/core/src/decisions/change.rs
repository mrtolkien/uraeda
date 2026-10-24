//! A decision's change between two versions of its file, its parts compared as `compare` matches
//! them, each rule with its strength and its check apart.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::strength::strength;
use crate::compare::{Part, Run, Version, diff, matched, section_titles, version};
use crate::files::document::LineRange;
use crate::files::frontmatter;

/// The change of one decision, from its version at the merge base to the branch's.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionChange {
    /// The file's name, without `.md`.
    pub name: String,
    /// Its `# ` heading, from the branch's version when it has one.
    pub title: String,
    /// `new`, `changed`, or `removed`.
    pub kind: String,
    /// Whether the spec's `## Decisions` lists it.
    pub listed: bool,
    /// Whether both versions could be read.
    pub compared: bool,
    /// The title and the frontmatter fields whose value differs, for a changed decision.
    pub fields: Vec<FieldChange>,
    pub sections: Vec<SectionChange>,
}

/// A field of a decision that differs between two versions: its `title`, or a frontmatter key.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub name: String,
    /// Its value in the merge base's version, `None` when it had none.
    pub before: Option<String>,
    /// Its value in the branch's version, `None` when it has none.
    pub after: Option<String>,
}

/// A section of a decision: the intent before the first `##`, titled `""`, then each `##`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionChange {
    pub title: String,
    pub parts: Vec<PartChange>,
}

/// A paragraph or a list item of a decision, compared.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartChange {
    /// `kept`, `changed`, `added`, or `removed`.
    pub kind: String,
    /// A list item's strength, as `Strength::as_str` names it.
    pub strength: Option<String>,
    /// Its lines in the merge base's version, from the file's first line.
    pub before: Option<LineRange>,
    /// Its lines in the branch's version, from the file's first line.
    pub after: Option<LineRange>,
    /// The part's words. For a rule, the words before its check.
    pub runs: Vec<Run>,
    /// For a rule, the words of its check, from "Checked by"; empty for any other part.
    pub check: Vec<Run>,
}

/// Compares the two versions of the decision `name`: `None` before for a new decision, `None`
/// after for a removed one. Parts keep the order of the branch's version, removed parts at the
/// place they held.
pub fn compare(name: &str, before: Option<&str>, after: Option<&str>) -> DecisionChange {
    let kind = match (before, after) {
        (Some(_), None) => "removed",
        (None, _) => "new",
        (Some(_), Some(_)) => "changed",
    };
    let old = before.map(version).unwrap_or_default();
    let new = after.map(version).unwrap_or_default();
    let sections = section_titles(&old, &new)
        .into_iter()
        .filter_map(|title| {
            let parts = compare_section(old.parts(&title), new.parts(&title));
            (!parts.is_empty()).then_some(SectionChange { title, parts })
        })
        .collect();
    let fields = match (before, after) {
        (Some(before), Some(after)) => field_changes(before, after, &old, &new),
        _ => Vec::new(),
    };
    DecisionChange {
        name: name.to_string(),
        title: new.title.or(old.title).unwrap_or_else(|| name.to_string()),
        kind: kind.to_string(),
        listed: false,
        compared: true,
        fields,
        sections,
    }
}

/// The title and the frontmatter fields that differ, the title first, then the fields by name.
fn field_changes(before: &str, after: &str, old: &Version, new: &Version) -> Vec<FieldChange> {
    let mut changes = Vec::new();
    if old.title != new.title {
        changes.push(FieldChange {
            name: "title".to_string(),
            before: old.title.clone(),
            after: new.title.clone(),
        });
    }
    let values = |text: &str| -> Vec<(String, String)> {
        let Ok(front) = frontmatter::parse(text) else {
            return Vec::new();
        };
        front
            .fields
            .iter()
            .map(|(name, _)| {
                (
                    name.clone(),
                    front.raw(name).unwrap_or_default().to_string(),
                )
            })
            .collect()
    };
    let (old, new) = (values(before), values(after));
    let mut names: Vec<&String> = old.iter().chain(&new).map(|(name, _)| name).collect();
    names.sort();
    names.dedup();
    for name in names {
        let find = |values: &[(String, String)]| {
            values
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, v)| v.clone())
        };
        let (before, after) = (find(&old), find(&new));
        if before != after {
            changes.push(FieldChange {
                name: name.clone(),
                before,
                after,
            });
        }
    }
    changes
}

/// The parts of one section, compared.
fn compare_section(old: &[Part], new: &[Part]) -> Vec<PartChange> {
    matched(old, new)
        .into_iter()
        .map(|(old, new)| part_change(old, new))
        .collect()
}

/// A part's change from its two versions, at least one of them there.
fn part_change(old: Option<&Part>, new: Option<&Part>) -> PartChange {
    let (kind, runs) = diff((old, new));
    let shown = new.or(old);
    let strength = shown
        .filter(|part| part.item)
        .and_then(|part| strength(&part.text))
        .map(|strength| strength.as_str().to_string());
    let (runs, check) = match strength {
        Some(_) => split_check(runs),
        None => (runs, Vec::new()),
    };
    PartChange {
        kind: kind.to_string(),
        strength,
        before: old.map(|part| part.lines),
        after: new.map(|part| part.lines),
        runs,
        check,
    }
}

/// The words that start a rule's check, as decisions write it.
const CHECK: &str = "Checked by";

/// A rule's runs, split where its check starts: the runs before, and the check's. A run holding
/// both is cut in two of its kind.
fn split_check(runs: Vec<Run>) -> (Vec<Run>, Vec<Run>) {
    let Some((at, cut)) = runs
        .iter()
        .enumerate()
        .find_map(|(at, run)| check_start(&run.text).map(|cut| (at, cut)))
    else {
        return (runs, Vec::new());
    };
    let mut rule = runs;
    let mut check = rule.split_off(at);
    let before = check[0].text[..cut].trim_end().to_string();
    check[0].text = check[0].text[cut..].to_string();
    if !before.is_empty() {
        rule.push(Run {
            kind: check[0].kind.clone(),
            text: before,
        });
    }
    (rule, check)
}

/// Where "Checked by" starts in a text: at its start, or after a space.
fn check_start(text: &str) -> Option<usize> {
    text.match_indices(CHECK).find_map(|(at, _)| {
        let starts = text[..at]
            .chars()
            .next_back()
            .is_none_or(char::is_whitespace);
        let ends = !text[at + CHECK.len()..].starts_with(|c: char| c.is_alphanumeric() || c == '_');
        (starts && ends).then_some(at)
    })
}
