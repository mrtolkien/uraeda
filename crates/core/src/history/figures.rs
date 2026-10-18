//! What a feature or a change produced: its total time, the lines it changed outside its own
//! files, and the decisions a done one changed, read from its runs of commits or its merge (R1).

use std::collections::{BTreeMap, HashMap};

use super::{LinesView, Stage, scope_type};
use crate::changes::outside;
use crate::decisions::{DecisionChange, compare};
use crate::git::{CommitInfo, Git, GitError, ObjectId, Range};
use crate::workspace::Feature;

const DECISIONS: &str = "specs/decisions/";

/// The two commits whose diff holds what an item changed.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Diff {
    pub base: ObjectId,
    pub tip: ObjectId,
    pub range: Range,
}

/// How a done item reached the default branch: when, and the diffs of what it brought, oldest
/// first.
pub(crate) struct Merge {
    /// The committer time of the commit through which it arrived.
    pub at: i64,
    pub diffs: Vec<Diff>,
}

/// How a done item reached the default branch, from its tip, read from its finish commit. On the
/// first-parent line, as a rebase or a fast-forward leaves it, the finish arrived at its own
/// committer time, and brought every run of the item's commits on that line, an unscoped commit
/// between two runs left out (R80); otherwise the oldest first-parent merge commit that has it
/// brought it, with its branch. A later commit of the item, made on the default branch, moves
/// neither.
pub(crate) fn merge(
    git: &Git,
    tip: ObjectId,
    commits: &[CommitInfo],
    scoped: &[(&str, &CommitInfo)],
    slug: &str,
    since: i64,
) -> Result<Option<Merge>, GitError> {
    let finishes: Vec<&CommitInfo> = scoped
        .iter()
        .filter(|(kind, _)| Stage::PullRequest.takes(kind))
        .map(|(_, commit)| *commit)
        .collect();
    let by_id: HashMap<ObjectId, &CommitInfo> =
        commits.iter().map(|commit| (commit.id, commit)).collect();
    let mut line = Vec::new();
    let mut next = Some(tip);
    while let Some(commit) = next.and_then(|id| by_id.get(&id)) {
        line.push(*commit);
        next = commit.parents.first().copied();
    }
    let on_line = line
        .iter()
        .find(|commit| finishes.iter().any(|finish| finish.id == commit.id));
    if let Some(finish) = on_line {
        let line = git.first_parent_line(finish.id, since, finish.committed)?;
        return Ok(Some(Merge {
            at: finish.committed,
            diffs: runs(&line, slug),
        }));
    }
    let Some(finish) = finishes.iter().max_by_key(|commit| commit.committed) else {
        return Ok(None);
    };
    let merge = line
        .iter()
        .rev()
        .find(|commit| commit.parents.len() > 1 && git.is_ancestor(finish.id, commit.id));
    Ok(merge.map(|merge| Merge {
        at: merge.committed,
        diffs: vec![Diff {
            base: merge.parents[0],
            tip: merge.parents[1],
            range: Range::ThreeDot,
        }],
    }))
}

/// The diffs of the runs of `slug`'s commits on a first-parent line given newest first, oldest
/// first: a commit whose first parent is the previous scoped commit joins its run, and each run
/// spans from its oldest commit's first parent to its newest commit.
fn runs(line: &[CommitInfo], slug: &str) -> Vec<Diff> {
    let mut runs: Vec<(Option<ObjectId>, ObjectId)> = Vec::new();
    for commit in line.iter().rev() {
        if scope_type(&commit.subject, slug).is_none() {
            continue;
        }
        let parent = commit.parents.first().copied();
        match runs.last_mut() {
            Some((_, newest)) if parent == Some(*newest) => *newest = commit.id,
            _ => runs.push((parent, commit.id)),
        }
    }
    runs.into_iter()
        .filter_map(|(base, tip)| {
            Some(Diff {
                base: base?,
                tip,
                range: Range::TwoDot,
            })
        })
        .collect()
}

/// The time from the proposal's start to the pull request's, when both started.
pub(crate) fn total(stages: &[Stage], starts: &[Option<i64>]) -> Option<u32> {
    let start = |stage: Stage| {
        let index = stages.iter().position(|known| *known == stage)?;
        starts[index]
    };
    let seconds = start(Stage::PullRequest)? - start(Stage::Proposal)?;
    u32::try_from(seconds).ok()
}

/// The lines a feature's diffs, oldest first, changed outside its own files, summed file by file,
/// and, for a done item, the decisions they changed.
pub(crate) fn produced(
    git: &Git,
    feature: &Feature,
    diffs: &[Diff],
    done: bool,
) -> Result<(LinesView, Vec<DecisionChange>), GitError> {
    let mut files: BTreeMap<String, (u32, u32)> = BTreeMap::new();
    for diff in diffs {
        let changed = git.numstat(diff.base, diff.tip, diff.range)?;
        for file in changed
            .into_iter()
            .filter(|file| outside(feature, &file.path))
        {
            let lines = files.entry(file.path).or_default();
            lines.0 += file.added.unwrap_or(0);
            lines.1 += file.removed.unwrap_or(0);
        }
    }
    let lines = LinesView {
        added: files.values().map(|lines| lines.0).sum(),
        removed: files.values().map(|lines| lines.1).sum(),
        files: files.len() as u32,
    };
    let decisions = match (diffs.first(), diffs.last()) {
        (Some(first), Some(last)) if done => decisions(git, files.keys(), first, last.tip)?,
        _ => Vec::new(),
    };
    Ok((lines, decisions))
}

/// The decisions among a feature's files, each compared between the oldest diff's base and the
/// newest diff's tip, sorted by name.
fn decisions<'p>(
    git: &Git,
    paths: impl Iterator<Item = &'p String>,
    first: &Diff,
    tip: ObjectId,
) -> Result<Vec<DecisionChange>, GitError> {
    let names: Vec<&str> = paths
        .filter_map(|path| path.strip_prefix(DECISIONS)?.strip_suffix(".md"))
        .filter(|name| !name.contains('/'))
        .collect();
    if names.is_empty() {
        return Ok(Vec::new());
    }
    let before = match first.range {
        Range::TwoDot => Some(first.base),
        Range::ThreeDot => git.merge_base(first.base, first.tip)?,
    };
    let text = |commit: Option<ObjectId>, name: &str| -> Result<Option<String>, GitError> {
        let Some(commit) = commit else {
            return Ok(None);
        };
        let bytes = git.read_file(commit, &format!("{DECISIONS}{name}.md"))?;
        Ok(bytes.map(|bytes| String::from_utf8_lossy(&bytes).into_owned()))
    };
    let mut changes = Vec::new();
    for name in names {
        let (old, new) = (text(before, name)?, text(Some(tip), name)?);
        let mut change = compare(name, old.as_deref(), new.as_deref());
        change.listed = true;
        changes.push(change);
    }
    changes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(changes)
}
