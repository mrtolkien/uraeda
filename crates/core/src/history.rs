//! A feature's or a change's history, read from git and its files: its stages, each started by
//! its first commit scoped by its slug and typed by its step, and its merge into the default
//! branch.

use std::time::{Duration, UNIX_EPOCH};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::decisions::DecisionChange;
use crate::files::{frontmatter, record};
use crate::git::{CommitInfo, Git, GitError, ObjectId, Range};
use crate::steps::StepName;
use crate::today::{Date, rfc3339};
use crate::workspace::{Feature, FileKind, Kind, record_path};

mod figures;
mod stages;

pub use stages::Stage;

/// A feature's or a change's stages, and what it produced.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryView {
    /// The feature's or the change's folder.
    pub folder: String,
    pub stages: Vec<StageView>,
    /// The index of the current stage; `stages.len()` once merged.
    pub current: u32,
    /// Rounds of questions, when it had any.
    pub rounds: Option<u32>,
    /// Whether a done item's commits were found on the default branch: false after a squash merge.
    pub found: bool,
    /// For a done item not found: its record's `finished` day, `YYYY-MM-DD`.
    pub finished: Option<String>,
    /// The time from its first commit to its finish, in seconds.
    pub total_seconds: Option<u32>,
    /// The lines and files it changed outside its folder and its record.
    pub lines: Option<LinesView>,
    /// The questions a done item asked.
    pub questions: Option<u32>,
    /// The decisions a done item changed.
    pub decisions: Vec<DecisionChange>,
}

/// A stage, and when it started.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageView {
    /// `proposal`, `questions`, `spec`, `plan`, `build`, `fix`, `pull-request`, or `merged`.
    pub name: String,
    /// RFC 3339, UTC.
    pub started: Option<String>,
}

/// Lines added and removed, over a number of files.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinesView {
    pub added: u32,
    pub removed: u32,
    pub files: u32,
}

/// The type of a commit subject scoped by `slug`, `<type>(<slug>): …` or `<type>(<slug>)!: …`:
/// the scope matched whole, so `(slug-two)` is another slug's.
pub fn scope_type<'s>(subject: &'s str, slug: &str) -> Option<&'s str> {
    let (kind, rest) = subject.split_once('(')?;
    let rest = rest.strip_prefix(slug)?.strip_prefix(')')?;
    let rest = rest.strip_prefix('!').unwrap_or(rest);
    let typed = !kind.is_empty() && kind.bytes().all(|byte| byte.is_ascii_alphanumeric());
    (typed && rest.starts_with(':')).then_some(kind)
}

/// The history of `feature`, a done one read from `default_branch`.
pub(crate) fn read(
    git: &Git,
    default_branch: Option<&str>,
    feature: &Feature,
) -> Result<HistoryView, GitError> {
    let done = feature.step.name == StepName::Done;
    let recorded = default_branch
        .filter(|_| done)
        .and_then(|branch| recorded_tip(git, branch, &feature.folder));
    let tip = if done {
        recorded.map(|(_, start)| start)
    } else {
        feature.branch.as_deref().and_then(|branch| git.tip(branch))
    };
    let commits = match tip {
        Some(tip) => git.history(tip, since(&feature.folder))?,
        None => Vec::new(),
    };
    let mut scoped: Vec<(&str, &CommitInfo)> = commits
        .iter()
        .filter_map(|commit| Some((scope_type(&commit.subject, &feature.slug)?, commit)))
        .collect();
    scoped.sort_by_key(|(_, commit)| commit.authored);

    let record = feature
        .file(FileKind::Record)
        .and_then(|file| feature.text(&file.name));
    let counts = record.map(record::counts);
    let rounds = match counts {
        Some(counts) => counts.rounds,
        None => feature
            .files
            .iter()
            .filter(|file| file.kind == FileKind::Clarifications)
            .count() as u32,
    };
    let took = |stage: Stage| scoped.iter().any(|(kind, _)| stage.takes(kind));
    let found = !done || took(Stage::PullRequest);
    let list = if found {
        let had_round = rounds > 0 || took(Stage::Questions);
        stages::of(feature.kind, feature.kind == Kind::Feature || had_round)
    } else {
        vec![Stage::Merged]
    };
    let mut starts = stages::starts(&list, &scoped);
    let current = stages::current(&feature.step, &list, &starts);
    if !done {
        // A live item has not reached a later stage, whatever commits it holds.
        starts
            .iter_mut()
            .skip(current as usize + 1)
            .for_each(|start| *start = None);
    }
    let diffs = if done {
        let merge = match recorded.filter(|_| found) {
            Some((tip, start)) => {
                let since = since(&feature.folder);
                let slug = &feature.slug;
                let line = figures::Line { tip, slug, since };
                figures::merge(git, start, &commits, &scoped, line)?
            }
            None => None,
        };
        if let Some(last) = starts.last_mut().filter(|_| found) {
            *last = merge.as_ref().map(|merge| merge.at);
        }
        merge.map(|merge| merge.diffs)
    } else {
        let default = default_branch.and_then(|branch| git.tip(branch));
        tip.zip(default).map(|(tip, base)| {
            vec![figures::Diff {
                base,
                tip,
                range: Range::ThreeDot,
            }]
        })
    };
    let (lines, decisions) = match diffs {
        Some(diffs) => {
            let (lines, decisions) = figures::produced(git, feature, &diffs, done)?;
            (Some(lines), decisions)
        }
        None => (None, Vec::new()),
    };
    let finished = (done && !found)
        .then(|| record.and_then(finished_day))
        .flatten();
    Ok(HistoryView {
        folder: feature.folder.clone(),
        current,
        stages: list
            .iter()
            .zip(&starts)
            .map(|(stage, start)| StageView {
                name: stage.as_str().to_string(),
                started: start.map(time),
            })
            .collect(),
        rounds: (rounds > 0).then_some(rounds),
        found,
        finished,
        total_seconds: figures::total(&list, &starts),
        lines,
        questions: counts.filter(|_| done).map(|counts| counts.questions),
        decisions,
    })
}

/// Where the walk stops: the day before the folder's date, at midnight UTC, as no commit of a
/// feature is older than its folder.
fn since(folder: &str) -> i64 {
    folder
        .get(..10)
        .and_then(Date::parse)
        .map_or(0, |date| date.unix_seconds() - 86_400)
}

/// The default branch's tip that holds a done item's record, local first, then `origin`'s, as the
/// workspace reads it, and where its walk starts: the first-parent commit that brought the record.
/// The walk then skips every later commit, and stays as fast for an old item as for a new one.
fn recorded_tip(git: &Git, branch: &str, folder: &str) -> Option<(ObjectId, ObjectId)> {
    let path = record_path(folder);
    let tips = [git.tip(branch), git.remote_tip(branch)];
    tips.into_iter()
        .flatten()
        .find_map(|tip| Some((tip, git.first_parent_addition(tip, &path).ok().flatten()?)))
        .or_else(|| git.tip(branch).map(|tip| (tip, tip)))
}

/// A record's `finished` day.
fn finished_day(text: &str) -> Option<String> {
    let front = frontmatter::parse(text).ok()?;
    front.text("finished").map(String::from)
}

/// Unix seconds in RFC 3339, UTC.
fn time(seconds: i64) -> String {
    rfc3339(UNIX_EPOCH + Duration::from_secs(seconds.max(0) as u64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_type_matches_the_whole_scope() {
        assert_eq!(scope_type("spec(tasks): approve", "tasks"), Some("spec"));
        assert_eq!(scope_type("feat(tasks)!: break", "tasks"), Some("feat"));
        assert_eq!(scope_type("spec(tasks-two): approve", "tasks"), None);
        assert_eq!(scope_type("spec(task): approve", "tasks"), None);
        assert_eq!(scope_type("spec(tasks) approve", "tasks"), None);
        assert_eq!(scope_type("Merge (tasks): x", "tasks"), None);
        assert_eq!(scope_type("chore: start", "tasks"), None);
    }
}
