//! The matching of two versions' parts, section by section, and the word diff of a matched pair.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::parts::{Part, Version};

/// Words of a part, joined with single spaces, all `kept`, `added`, or `removed`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub kind: String,
    pub text: String,
}

/// A part's two versions, at least one of them there: `None` before for an added part, `None`
/// after for a removed one.
pub(crate) type Pair<'a> = (Option<&'a Part>, Option<&'a Part>);

/// The sections of both versions: the newer's in its order, each section only the older has after
/// the section that came before it there.
pub(crate) fn section_titles(old: &Version, new: &Version) -> Vec<String> {
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

/// The parts of one section, paired: equal texts matched in order, then equal texts left over
/// matched wherever they moved within the section, kept at the newer's place; between two
/// matches, removed and added parts paired when they are the same part.
pub(crate) fn matched<'a>(old: &'a [Part], new: &'a [Part]) -> Vec<Pair<'a>> {
    let old_texts: Vec<&str> = old.iter().map(|p| p.text.as_str()).collect();
    let new_texts: Vec<&str> = new.iter().map(|p| p.text.as_str()).collect();
    let matches = common(&old_texts, &new_texts);
    let (moved, taken) = moved(old, new, &matches);
    let mut pairs = Vec::new();
    let (mut i, mut j) = (0, 0);
    let end = (old.len(), new.len());
    for (mi, mj) in matches.into_iter().chain([end]) {
        let removed: Vec<&Part> = (i..mi).filter(|&k| !taken[k]).map(|k| &old[k]).collect();
        let added: Vec<(&Part, Option<&Part>)> = (j..mj)
            .map(|k| (&new[k], moved[k].map(|r| &old[r])))
            .collect();
        gap(&removed, &added, &mut pairs);
        if (mi, mj) != end {
            pairs.push((Some(&old[mi]), Some(&new[mj])));
        }
        (i, j) = (mi + 1, mj + 1);
    }
    pairs
}

/// For each of the newer's parts left out of `matches`, the older's part left out with the same
/// text, first come first matched; and which of the older's parts are matched.
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
fn gap<'a>(
    removed: &[&'a Part],
    added: &[(&'a Part, Option<&'a Part>)],
    pairs: &mut Vec<Pair<'a>>,
) {
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
        pairs.push((old, Some(new)));
    }
    for (old, _) in removed.iter().zip(&paired).filter(|(_, p)| !**p) {
        pairs.push((Some(old), None));
    }
}

/// A pair's kind, `kept`, `changed`, `added`, or `removed`, and its words as runs.
pub(crate) fn diff((old, new): Pair) -> (&'static str, Vec<Run>) {
    match (old, new) {
        (Some(old), Some(new)) if old.text == new.text => ("kept", vec![run("kept", &new.text)]),
        (Some(old), Some(new)) => ("changed", word_runs(&old.text, &new.text)),
        (None, Some(new)) => ("added", vec![run("added", &new.text)]),
        (Some(old), None) => ("removed", vec![run("removed", &old.text)]),
        (None, None) => ("kept", Vec::new()),
    }
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
