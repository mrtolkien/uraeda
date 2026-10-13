//! Reviewing a spec, a plan, or an assessment: comments in its review file, then a verdict.

use std::fs;

use crate::files::review::{self, Anchor, Comment, Review, Verdict};
use crate::files::{frontmatter, markdown, spec};
use crate::gates::{Gate, awaits_human, gate_of};
use crate::git::{Git, ObjectId};
use crate::today::Date;
use crate::workspace::Feature;

use super::place::Place;
use super::{ActionError, Change};

/// The file of a feature waiting for a review: the one named, or the one at its gate.
pub fn reviewed_file(feature: &Feature, named: Option<&str>) -> Result<String, ActionError> {
    let name = match named {
        Some(name) => name.to_string(),
        None => feature
            .step
            .file
            .clone()
            .filter(|file| gate_of(file) == Some(Gate::Review))
            .ok_or_else(|| {
                ActionError::Refused(format!(
                    "{} has nothing waiting for a review",
                    feature.folder
                ))
            })?,
    };
    if gate_of(&name) != Some(Gate::Review) {
        return Err(ActionError::Refused(format!(
            "{name} is not a spec, a plan, or an assessment"
        )));
    }
    Ok(name)
}

fn kind(file: &str) -> &str {
    file.strip_suffix(".md").unwrap_or(file)
}

/// The subject of the commit a verdict on a file makes: `spec(recurring-tasks): approve`, or
/// `plan(recurring-tasks): request changes`. `slug` is the feature's or the bug's.
pub fn subject(slug: &str, file: &str, verdict: Verdict) -> String {
    let action = match verdict {
        Verdict::ChangesRequested => "request changes",
        Verdict::Approved | Verdict::Pending => "approve",
    };
    format!("{}({slug}): {action}", kind(file))
}

/// `spec-review.md` for `spec.md`.
pub fn review_name(file: &str) -> String {
    format!("{}-review.md", kind(file))
}

/// The reviewed file's text on disk, refused unless it waits for a review.
fn waiting_text(place: &Place, feature: &Feature, file: &str) -> Result<String, ActionError> {
    let text = fs::read_to_string(place.root.join(&feature.path).join(file))?;
    if !awaits_human(&text) {
        return Err(ActionError::Refused(format!(
            "{file} is not waiting for a review"
        )));
    }
    Ok(text)
}

/// The title of a review: `Review: Spec, Recurring tasks`.
fn title(reviewed: &str) -> String {
    let heading = markdown::Document::parse(reviewed)
        .headings
        .into_iter()
        .find(|h| h.level == 1)
        .map(|h| h.text)
        .unwrap_or_default();
    match heading.split_once(": ") {
        Some((kind, name)) => format!("Review: {kind}, {name}"),
        None => format!("Review: {heading}"),
    }
}

/// A comment added: its number, where it points, and whether an older review was replaced.
pub struct Commented {
    pub number: u32,
    pub review: String,
    pub anchor: Anchor,
    pub replaced: bool,
}

/// Adds a comment to the pending review of a file, on lines of its committed version, or on the
/// whole file. Commits nothing.
pub fn comment(
    git: &Git,
    place: &Place,
    feature: &Feature,
    file: &str,
    lines: Option<(usize, usize)>,
    text: &str,
) -> Result<Commented, ActionError> {
    if text.lines().any(|line| line.trim_start().starts_with('#')) {
        return Err(ActionError::Refused(
            "a comment line cannot start with \"#\"".to_string(),
        ));
    }
    waiting_text(place, feature, file)?;
    let branch = feature.branch.as_deref().unwrap_or_default();
    let tip = git
        .tip(branch)
        .ok_or_else(|| ActionError::Refused(format!("{branch} has no commit")))?;
    let commit = tip.to_hex_with_len(7).to_string();
    let path = format!("{}/{file}", feature.path);
    let committed = git
        .read_file(tip, &path)?
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| ActionError::Refused(format!("{file} is not committed")))?;
    let (anchor, quote) = match lines {
        None => (Anchor::General, Vec::new()),
        Some((start, end)) => {
            let count = committed.lines().count();
            if start == 0 || end < start || end > count {
                return Err(ActionError::Refused(format!("{file} has {count} lines")));
            }
            let heading = markdown::Document::parse(&committed)
                .headings
                .into_iter()
                .rfind(|h| h.line <= start)
                .map(|h| h.text)
                .unwrap_or_default();
            let quote = committed
                .lines()
                .skip(start - 1)
                .take(end - start + 1)
                .map(String::from)
                .collect();
            (Anchor::Lines(start, end, heading), quote)
        }
    };
    let review_path = format!("{}/{}", feature.path, review_name(file));
    let on_disk = place.root.join(&review_path);
    let existing = existing_review(place, feature, file)?;
    // A pending review stays while the reviewed file is the same as at its commit.
    let current = existing.as_ref().is_some_and(|r| {
        r.verdict == Verdict::Pending && fresh(git, r, &path, tip, committed.as_bytes())
    });
    let replaced = existing
        .as_ref()
        .is_some_and(|r| r.verdict == Verdict::Pending && !current);
    let mut review = match existing {
        Some(review) if current => review,
        _ => Review {
            verdict: Verdict::Pending,
            commit,
            summary: None,
            comments: Vec::new(),
        },
    };
    let number = review.comments.len() as u32 + 1;
    review.comments.push(Comment {
        number,
        anchor: anchor.clone(),
        quote,
        text: text.trim().to_string(),
        line: 0,
    });
    fs::write(&on_disk, review::render(&review, &title(&committed)))?;
    Ok(Commented {
        number,
        review: review_path,
        anchor,
        replaced,
    })
}

/// The review file of a file, when there is one. One that does not parse is refused, never
/// overwritten: it may hold the human's comments.
fn existing_review(
    place: &Place,
    feature: &Feature,
    file: &str,
) -> Result<Option<Review>, ActionError> {
    let name = review_name(file);
    let Ok(text) = fs::read_to_string(place.root.join(&feature.path).join(&name)) else {
        return Ok(None);
    };
    review::parse(&text).map(Some).map_err(|error| {
        ActionError::Refused(format!(
            "{name} does not parse: {error}: fix it, or delete it"
        ))
    })
}

/// Whether a review comments on the reviewed file as committed at `tip`: written at that commit,
/// or at one where the file was the same.
fn fresh(git: &Git, review: &Review, path: &str, tip: ObjectId, committed: &[u8]) -> bool {
    tip.to_hex_with_len(7) == review.commit
        || git
            .resolve(&review.commit)
            .and_then(|old| git.read_file(old, path).ok().flatten())
            .is_some_and(|old| old == committed)
}

/// The pending review of a file, if it has comments. One on an older version of the file is
/// refused, never applied or deleted: it holds the human's comments.
fn pending(place: &Place, feature: &Feature, file: &str) -> Result<Option<Review>, ActionError> {
    let Some(review) = existing_review(place, feature, file)?
        .filter(|r| r.verdict == Verdict::Pending && !r.comments.is_empty())
    else {
        return Ok(None);
    };
    let git = Git::open(&place.root)?;
    let path = format!("{}/{file}", feature.path);
    let current = git.head().is_some_and(|head| {
        git.read_file(head, &path)
            .ok()
            .flatten()
            .is_some_and(|committed| fresh(&git, &review, &path, head, &committed))
    });
    if !current {
        return Err(ActionError::Refused(format!(
            "{} comments on an older {file}: comment again to replace it, or delete it",
            review_name(file)
        )));
    }
    Ok(Some(review))
}

/// The risk tier and plan review a human may change when approving a spec.
#[derive(Clone, Debug, Default)]
pub struct Tier {
    pub risk_tier: Option<String>,
    pub plan_review: Option<bool>,
}

/// Approves a file: `status: approved`, its block recorded, its pending review kept with the
/// verdict, or an older review deleted.
pub fn approve(
    place: &Place,
    feature: &Feature,
    file: &str,
    summary: Option<&str>,
    tier: &Tier,
    today: Date,
) -> Result<Change, ActionError> {
    let text = waiting_text(place, feature, file)?;
    if (tier.risk_tier.is_some() || tier.plan_review.is_some()) && file != "spec.md" {
        return Err(ActionError::Refused(
            "only a spec has a risk tier and a plan review".to_string(),
        ));
    }
    let tiers = spec::risk_tiers();
    if let Some(tier) = &tier.risk_tier
        && !tiers.contains(&tier.as_str())
    {
        return Err(ActionError::Refused(format!(
            "risk tier \"{tier}\" is not one of {}",
            tiers.join(", ")
        )));
    }
    let front = frontmatter::parse(&text).ok();
    let proposed_tier = front
        .as_ref()
        .and_then(|f| f.text("risk-tier").map(String::from));
    let mut edited = frontmatter::set(&text, "status", "approved");
    if let Some(risk_tier) = &tier.risk_tier {
        edited = frontmatter::set(&edited, "risk-tier", risk_tier);
    }
    if file == "spec.md" {
        let current = match front.as_ref().and_then(|f| f.get("plan-review")) {
            Some(frontmatter::Value::Bool(value)) => Some(*value),
            _ => None,
        };
        let chosen = tier.risk_tier.as_deref().or(proposed_tier.as_deref());
        let value = tier.plan_review.unwrap_or_else(|| {
            spec::plan_review_default(proposed_tier.as_deref(), current, chosen)
        });
        edited = frontmatter::set(&edited, "plan-review", &value.to_string());
    }
    let edited =
        markdown::record_block(&edited, &format!("Approved on {today}.")).unwrap_or(edited);
    let path = format!("{}/{file}", feature.path);
    let review_path = format!("{}/{}", feature.path, review_name(file));
    let mut paths = vec![path.clone()];
    let pending = pending(place, feature, file)?;
    let tracked = |path: &str| {
        crate::git::Git::open(&place.root).is_ok_and(|git| {
            git.head()
                .is_some_and(|head| git.read_file(head, path).ok().flatten().is_some())
        })
    };
    match pending {
        Some(mut review) => {
            review.verdict = Verdict::Approved;
            review.summary = summary.map(String::from).or(review.summary);
            fs::write(
                place.root.join(&review_path),
                review::render(&review, &title(&text)),
            )?;
            paths.push(review_path);
        }
        None if place.root.join(&review_path).exists() => {
            fs::remove_file(place.root.join(&review_path))?;
            if tracked(&review_path) {
                paths.push(review_path);
            }
        }
        None => {}
    }
    fs::write(place.root.join(&path), edited)?;
    paths.sort();
    Ok(Change {
        paths,
        subject: subject(&feature.slug, file, Verdict::Approved),
        body: summary.map(String::from),
    })
}

/// Requests changes on a file: `status: changes-requested`, its block recorded with the summary,
/// and its pending review, which needs a comment, with the verdict.
pub fn request_changes(
    place: &Place,
    feature: &Feature,
    file: &str,
    summary: Option<&str>,
    today: Date,
) -> Result<Change, ActionError> {
    let text = waiting_text(place, feature, file)?;
    let Some(mut review) = pending(place, feature, file)? else {
        return Err(ActionError::Refused(format!(
            "a request for changes needs at least one comment: ura review {} --comment <lines> <text>",
            feature.slug
        )));
    };
    let review_name = review_name(file);
    let count = review.comments.len();
    let line = match summary {
        Some(summary) => summary.to_string(),
        None => {
            let plural = if count == 1 { "" } else { "s" };
            format!("{count} comment{plural} in {review_name}.")
        }
    };
    let edited = frontmatter::set(&text, "status", "changes-requested");
    let edited = markdown::record_block(&edited, &format!("Changes requested on {today}: {line}"))
        .unwrap_or(edited);
    review.verdict = Verdict::ChangesRequested;
    review.summary = summary.map(String::from).or(review.summary);
    let path = format!("{}/{file}", feature.path);
    let review_path = format!("{}/{review_name}", feature.path);
    fs::write(
        place.root.join(&review_path),
        review::render(&review, &title(&text)),
    )?;
    fs::write(place.root.join(&path), edited)?;
    let mut paths = vec![path, review_path];
    paths.sort();
    Ok(Change {
        paths,
        subject: subject(&feature.slug, file, Verdict::ChangesRequested),
        body: summary.map(String::from),
    })
}

/// The pending review of a file, read for an edit, refused when there is none.
fn pending_text(place: &Place, feature: &Feature, file: &str) -> Result<String, ActionError> {
    let path = place.root.join(&feature.path).join(review_name(file));
    let text = fs::read_to_string(&path)
        .map_err(|_| ActionError::Refused(format!("{file} has no pending review")))?;
    let parsed = review::parse(&text).map_err(|error| {
        ActionError::Refused(format!("{} does not parse: {error}", review_name(file)))
    })?;
    if parsed.verdict != Verdict::Pending {
        return Err(ActionError::Refused(format!(
            "{file} has no pending review"
        )));
    }
    Ok(text)
}

/// Replaces the text of a pending comment. Commits nothing.
pub fn edit(
    place: &Place,
    feature: &Feature,
    file: &str,
    number: u32,
    text: &str,
) -> Result<(), ActionError> {
    if text.lines().any(|line| line.trim_start().starts_with('#')) {
        return Err(ActionError::Refused(
            "a comment line cannot start with \"#\"".to_string(),
        ));
    }
    let current = pending_text(place, feature, file)?;
    let edited = review::edit_comment(&current, number, text)
        .map_err(|error| ActionError::Refused(error.to_string()))?;
    fs::write(
        place.root.join(&feature.path).join(review_name(file)),
        edited,
    )?;
    Ok(())
}

/// Removes a pending comment; the review file goes with its last comment. Commits nothing.
pub fn remove(
    place: &Place,
    feature: &Feature,
    file: &str,
    number: u32,
) -> Result<(), ActionError> {
    let current = pending_text(place, feature, file)?;
    let path = place.root.join(&feature.path).join(review_name(file));
    match review::remove_comment(&current, number)
        .map_err(|error| ActionError::Refused(error.to_string()))?
    {
        Some(edited) => fs::write(path, edited)?,
        None => fs::remove_file(path)?,
    }
    Ok(())
}

/// Deletes the pending review of a file, to review its new version from scratch.
pub fn start_over(place: &Place, feature: &Feature, file: &str) -> Result<(), ActionError> {
    pending_text(place, feature, file)?;
    fs::remove_file(place.root.join(&feature.path).join(review_name(file)))?;
    Ok(())
}

/// The files a verdict writes, checked against the staged files before anything is written.
fn verdict_paths(feature: &Feature, file: &str) -> [String; 2] {
    [
        format!("{}/{file}", feature.path),
        format!("{}/{}", feature.path, review_name(file)),
    ]
}

/// Approves a file and commits it.
pub fn approve_and_commit(
    place: &Place,
    feature: &Feature,
    file: &str,
    summary: Option<&str>,
    tier: &Tier,
    today: Date,
) -> Result<super::Committed, ActionError> {
    super::place::ensure_only_staged(place, &verdict_paths(feature, file))?;
    let change = approve(place, feature, file, summary, tier, today)?;
    super::commit::commit(place, &change)
}

/// Requests changes on a file and commits it.
pub fn request_changes_and_commit(
    place: &Place,
    feature: &Feature,
    file: &str,
    summary: Option<&str>,
    today: Date,
) -> Result<super::Committed, ActionError> {
    super::place::ensure_only_staged(place, &verdict_paths(feature, file))?;
    let change = request_changes(place, feature, file, summary, today)?;
    super::commit::commit(place, &change)
}
