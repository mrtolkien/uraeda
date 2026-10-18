//! What a feature or a change produced: its total time, the lines it changed outside its own
//! files, and the decisions a done one changed, each read from one diff (R1).

use std::collections::{HashMap, HashSet};

use super::{LinesView, Stage};
use crate::changes::{ChangedFile, outside};
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

/// How a done item reached the default branch: when, and the diff of what it brought.
pub(crate) struct Merge {
    /// The committer time of the commit through which it arrived.
    pub at: i64,
    pub diff: Option<Diff>,
}

/// How a done item reached the default branch, from its tip, read from its finish commit. On the
/// first-parent line, as a rebase or a fast-forward leaves it, the finish arrived at its own
/// committer time, and brought the run of consecutive scoped first-parent commits ending at it;
/// otherwise the oldest first-parent merge commit that has it brought it, with its branch. A later
/// commit of the item, made on the default branch, moves neither.
pub(crate) fn merge(
    git: &Git,
    tip: ObjectId,
    commits: &[CommitInfo],
    scoped: &[(&str, &CommitInfo)],
) -> Option<Merge> {
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
        .position(|commit| finishes.iter().any(|finish| finish.id == commit.id));
    if let Some(index) = on_line {
        let ids: HashSet<ObjectId> = scoped.iter().map(|(_, commit)| commit.id).collect();
        let finish = line[index];
        let oldest = line[index..]
            .iter()
            .take_while(|commit| ids.contains(&commit.id))
            .last()?;
        return Some(Merge {
            at: finish.committed,
            diff: oldest.parents.first().map(|base| Diff {
                base: *base,
                tip: finish.id,
                range: Range::TwoDot,
            }),
        });
    }
    let finish = finishes.iter().max_by_key(|commit| commit.committed)?;
    let merge = line
        .iter()
        .rev()
        .find(|commit| commit.parents.len() > 1 && git.is_ancestor(finish.id, commit.id))?;
    Some(Merge {
        at: merge.committed,
        diff: Some(Diff {
            base: merge.parents[0],
            tip: merge.parents[1],
            range: Range::ThreeDot,
        }),
    })
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

/// The lines a diff changed outside the feature's own files, and, for a done item, the decisions
/// it changed.
pub(crate) fn produced(
    git: &Git,
    feature: &Feature,
    diff: Diff,
    done: bool,
) -> Result<(LinesView, Vec<DecisionChange>), GitError> {
    let files: Vec<ChangedFile> = git
        .numstat(diff.base, diff.tip, diff.range)?
        .into_iter()
        .filter(|file| outside(feature, &file.path))
        .collect();
    let lines = LinesView {
        added: files.iter().filter_map(|file| file.added).sum(),
        removed: files.iter().filter_map(|file| file.removed).sum(),
        files: files.len() as u32,
    };
    let decisions = if done {
        decisions(git, &files, diff)?
    } else {
        Vec::new()
    };
    Ok((lines, decisions))
}

/// The decisions among a diff's files, each compared between the diff's two sides, sorted by name.
fn decisions(
    git: &Git,
    files: &[ChangedFile],
    diff: Diff,
) -> Result<Vec<DecisionChange>, GitError> {
    let names: Vec<&str> = files
        .iter()
        .filter_map(|file| file.path.strip_prefix(DECISIONS)?.strip_suffix(".md"))
        .filter(|name| !name.contains('/'))
        .collect();
    if names.is_empty() {
        return Ok(Vec::new());
    }
    let before = match diff.range {
        Range::TwoDot => Some(diff.base),
        Range::ThreeDot => git.merge_base(diff.base, diff.tip)?,
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
        let (old, new) = (text(before, name)?, text(Some(diff.tip), name)?);
        let mut change = compare(name, old.as_deref(), new.as_deref());
        change.listed = true;
        changes.push(change);
    }
    changes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(changes)
}
