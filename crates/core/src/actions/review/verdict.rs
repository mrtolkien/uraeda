//! A verdict on a spec or a plan: approving it, or requesting changes, each with its pending
//! review.

use std::fs;

use crate::files::review::{self, Verdict};
use crate::files::{frontmatter, markdown, spec};
use crate::today::Date;
use crate::workspace::Feature;

use super::super::images::{images_folder, linked_images};
use super::super::place::Place;
use super::super::{ActionError, Change};
use super::{pending, review_name, subject, title, waiting_text};

/// The risk tier and plan review a human may change when approving a spec.
#[derive(Clone, Debug, Default)]
pub struct Tier {
    pub risk_tier: Option<String>,
    pub plan_review: Option<bool>,
}

/// Approves a file: `status: approved`, its block recorded, its pending review kept with the
/// verdict, or an older review deleted; with the images the feature's folder links, the others
/// deleted.
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
    paths.extend(linked_images(place, &feature.path)?);
    paths.sort();
    Ok(Change {
        paths,
        subject: subject(&feature.slug, file, Verdict::Approved),
        body: summary.map(String::from),
    })
}

/// Requests changes on a file: `status: changes-requested`, its block recorded with the summary,
/// and its pending review, which needs a comment, with the verdict; with the images the feature's
/// folder links, the others deleted.
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
    paths.extend(linked_images(place, &feature.path)?);
    paths.sort();
    Ok(Change {
        paths,
        subject: subject(&feature.slug, file, Verdict::ChangesRequested),
        body: summary.map(String::from),
    })
}

/// The files a verdict writes, its images included, checked against the staged files before
/// anything is written.
fn verdict_paths(feature: &Feature, file: &str) -> [String; 3] {
    [
        format!("{}/{file}", feature.path),
        format!("{}/{}", feature.path, review_name(file)),
        images_folder(&feature.path),
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
) -> Result<super::super::Committed, ActionError> {
    super::super::place::ensure_only_staged(place, &verdict_paths(feature, file))?;
    let change = approve(place, feature, file, summary, tier, today)?;
    super::super::commit::commit(place, &change)
}

/// Requests changes on a file and commits it.
pub fn request_changes_and_commit(
    place: &Place,
    feature: &Feature,
    file: &str,
    summary: Option<&str>,
    today: Date,
) -> Result<super::super::Committed, ActionError> {
    super::super::place::ensure_only_staged(place, &verdict_paths(feature, file))?;
    let change = request_changes(place, feature, file, summary, today)?;
    super::super::commit::commit(place, &change)
}
