//! A decision's change between two versions of its file. Each version is cut into parts, each a
//! paragraph, list item at any depth, table row, code block, or quoted paragraph, with its lines
//! joined, so a rewrap is no change. Two parts are the same part when they sit in the same section
//! and keep at least 60% of the shorter one's words: they compare word by word. Otherwise, one is
//! new and the other removed.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::strength::strength;
use crate::files::document::{Block, BlockKind, Document, LineRange, parse, plain};
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

/// Words of a part, joined with single spaces, all `kept`, `added`, or `removed`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub kind: String,
    pub text: String,
}

/// A paragraph or list item of one version.
struct Part {
    text: String,
    item: bool,
    lines: LineRange,
}

/// One version of a decision: its title, and its parts by section, in file order.
#[derive(Default)]
struct Version {
    title: Option<String>,
    sections: Vec<(String, Vec<Part>)>,
}

impl Version {
    fn parts(&self, title: &str) -> &[Part] {
        self.sections
            .iter()
            .find(|(name, _)| name == title)
            .map_or(&[], |(_, parts)| parts.as_slice())
    }

    fn section(&mut self, title: &str) -> &mut Vec<Part> {
        let index = match self.sections.iter().position(|(name, _)| name == title) {
            Some(index) => index,
            None => {
                self.sections.push((title.to_string(), Vec::new()));
                self.sections.len() - 1
            }
        };
        &mut self.sections[index].1
    }
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

/// The parts of a decision's text, its frontmatter left out.
fn version(text: &str) -> Version {
    let document = parse(text, "");
    let mut version = Version::default();
    let mut section = String::new();
    for block in document
        .blocks
        .iter()
        .filter(|block| block.parent.is_none())
    {
        match block.kind {
            BlockKind::Heading if block.level == Some(1) && version.title.is_none() => {
                version.title = Some(plain(&block.spans));
                section.clear();
            }
            BlockKind::Heading if block.level == Some(2) => section = plain(&block.spans),
            _ => {
                let mut parts = Vec::new();
                collect(&document, block, &mut parts);
                version.section(&section).extend(parts);
            }
        }
    }
    version
}

/// The parts of a block, in file order: a paragraph, a list item at any depth, a table row, a
/// code or HTML block, each with its text; a quote or a callout holds its children's.
fn collect(document: &Document, block: &Block, parts: &mut Vec<Part>) {
    let lines = LineRange {
        start: block.start_line,
        end: block.end_line,
    };
    let part = |text: String, item: bool| Part { text, item, lines };
    match block.kind {
        BlockKind::Paragraph => parts.push(part(joined(&plain(&block.spans)), false)),
        BlockKind::Item => {
            parts.push(part(joined(&plain(&block.spans)), true));
            for child in document.children(block.id) {
                collect(document, child, parts);
            }
        }
        BlockKind::Row => {
            let cells: Vec<String> = document
                .children(block.id)
                .map(|cell| joined(&plain(&cell.spans)))
                .collect();
            parts.push(part(cells.join(" | "), false));
        }
        BlockKind::Code | BlockKind::Html => {
            parts.push(part(
                joined(block.text.as_deref().unwrap_or_default()),
                false,
            ));
        }
        BlockKind::Callout => {
            let title = joined(&plain(&block.spans));
            if !title.is_empty() {
                parts.push(part(title, false));
            }
            for child in document.children(block.id) {
                collect(document, child, parts);
            }
        }
        BlockKind::List | BlockKind::Quote | BlockKind::Table => {
            for child in document.children(block.id) {
                collect(document, child, parts);
            }
        }
        BlockKind::Heading | BlockKind::Cell | BlockKind::Rule => {}
    }
}

/// Text with every run of whitespace made one space.
fn joined(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The sections of both versions: the branch's in its order, each section only the merge base has
/// after the section that came before it there.
fn section_titles(old: &Version, new: &Version) -> Vec<String> {
    let mut titles: Vec<String> = new.sections.iter().map(|(t, _)| t.clone()).collect();
    let mut place = 0;
    for (title, _) in &old.sections {
        match titles.iter().position(|t| t == title) {
            Some(index) => place = index + 1,
            None => {
                titles.insert(place, title.clone());
                place += 1;
            }
        }
    }
    titles
}

/// The parts of one section: equal texts matched in order, then equal texts left over matched
/// wherever they moved within the section, kept at the branch's place; between two matches,
/// removed and added parts paired when they are the same part.
fn compare_section(old: &[Part], new: &[Part]) -> Vec<PartChange> {
    let old_texts: Vec<&str> = old.iter().map(|p| p.text.as_str()).collect();
    let new_texts: Vec<&str> = new.iter().map(|p| p.text.as_str()).collect();
    let matches = common(&old_texts, &new_texts);
    let (moved, taken) = moved(old, new, &matches);
    let mut changes = Vec::new();
    let (mut i, mut j) = (0, 0);
    let end = (old.len(), new.len());
    for (mi, mj) in matches.into_iter().chain([end]) {
        let removed: Vec<&Part> = (i..mi).filter(|&k| !taken[k]).map(|k| &old[k]).collect();
        let added: Vec<(&Part, Option<&Part>)> = (j..mj)
            .map(|k| (&new[k], moved[k].map(|r| &old[r])))
            .collect();
        gap(&removed, &added, &mut changes);
        if (mi, mj) != end {
            changes.push(part_change(Some(&old[mi]), Some(&new[mj])));
        }
        (i, j) = (mi + 1, mj + 1);
    }
    changes
}

/// For each of the branch's parts left out of `matches`, the merge base's part left out with the
/// same text, first come first matched; and which of the merge base's parts are matched.
fn moved(
    old: &[Part],
    new: &[Part],
    matches: &[(usize, usize)],
) -> (Vec<Option<usize>>, Vec<bool>) {
    let mut taken = vec![false; old.len()];
    let mut moved = vec![None; new.len()];
    let mut matched = vec![false; new.len()];
    for &(i, j) in matches {
        taken[i] = true;
        matched[j] = true;
    }
    for (j, part) in new.iter().enumerate().filter(|(j, _)| !matched[*j]) {
        let same = (0..old.len()).find(|&i| !taken[i] && old[i].text == part.text);
        if let Some(i) = same {
            taken[i] = true;
            moved[j] = Some(i);
        }
    }
    (moved, taken)
}

/// The parts between two matches: each removed and added pair that keeps at least 60% of the
/// shorter one's words is changed, best pair first; the added parts come in order, a moved one
/// with its match, then the removed ones left.
fn gap(removed: &[&Part], added: &[(&Part, Option<&Part>)], changes: &mut Vec<PartChange>) {
    let mut candidates = Vec::new();
    for (r, old) in removed.iter().enumerate() {
        for (a, (new, _)) in added.iter().enumerate().filter(|(_, (_, m))| m.is_none()) {
            let (before, after) = (words(&old.text), words(&new.text));
            let kept = common(&before, &after).len();
            let shorter = before.len().min(after.len());
            if shorter > 0 && kept * 5 >= shorter * 3 {
                candidates.push((kept, shorter, a, r));
            }
        }
    }
    // Best likeness first, `kept / shorter`, then the earliest pair.
    candidates.sort_by(|x, y| {
        (y.0 * x.1)
            .cmp(&(x.0 * y.1))
            .then((x.2, x.3).cmp(&(y.2, y.3)))
    });
    let mut pair_of: Vec<Option<usize>> = vec![None; added.len()];
    let mut paired = vec![false; removed.len()];
    for (_, _, a, r) in candidates {
        if pair_of[a].is_none() && !paired[r] {
            pair_of[a] = Some(r);
            paired[r] = true;
        }
    }
    for ((new, moved), pair) in added.iter().zip(&pair_of) {
        let old = moved.or(pair.map(|r| removed[r]));
        changes.push(part_change(old, Some(new)));
    }
    for (old, _) in removed.iter().zip(&paired).filter(|(_, p)| !**p) {
        changes.push(part_change(Some(old), None));
    }
}

/// A part's change from its two versions, at least one of them there.
fn part_change(old: Option<&Part>, new: Option<&Part>) -> PartChange {
    let (kind, runs) = match (old, new) {
        (Some(old), Some(new)) if old.text == new.text => ("kept", vec![run("kept", &new.text)]),
        (Some(old), Some(new)) => ("changed", word_runs(&old.text, &new.text)),
        (None, Some(new)) => ("added", vec![run("added", &new.text)]),
        (Some(old), None) => ("removed", vec![run("removed", &old.text)]),
        (None, None) => ("kept", Vec::new()),
    };
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

fn run(kind: &str, text: &str) -> Run {
    Run {
        kind: kind.to_string(),
        text: text.to_string(),
    }
}

fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().collect()
}

/// The words of two texts as runs: between two kept words, the removed ones, then the added ones.
fn word_runs(before: &str, after: &str) -> Vec<Run> {
    let (old, new) = (words(before), words(after));
    let mut runs: Vec<Run> = Vec::new();
    let mut push = |kind: &str, words: &[&str]| {
        for word in words {
            match runs.last_mut() {
                Some(last) if last.kind == kind => {
                    last.text.push(' ');
                    last.text.push_str(word);
                }
                _ => runs.push(run(kind, word)),
            }
        }
    };
    let (mut i, mut j) = (0, 0);
    let end = (old.len(), new.len());
    for (mi, mj) in common(&old, &new).into_iter().chain([end]) {
        push("removed", &old[i..mi]);
        push("added", &new[j..mj]);
        if (mi, mj) != end {
            push("kept", &old[mi..=mi]);
        }
        (i, j) = (mi + 1, mj + 1);
    }
    runs
}

/// The index pairs of a longest common subsequence of `a` and `b`, in order.
fn common<T: PartialEq>(a: &[T], b: &[T]) -> Vec<(usize, usize)> {
    let mut table = vec![vec![0u32; b.len() + 1]; a.len() + 1];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            table[i][j] = if a[i] == b[j] {
                table[i + 1][j + 1] + 1
            } else {
                table[i + 1][j].max(table[i][j + 1])
            };
        }
    }
    let mut pairs = Vec::new();
    let (mut i, mut j) = (0, 0);
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            pairs.push((i, j));
            (i, j) = (i + 1, j + 1);
        } else if table[i + 1][j] >= table[i][j + 1] {
            i += 1;
        } else {
            j += 1;
        }
    }
    pairs
}
