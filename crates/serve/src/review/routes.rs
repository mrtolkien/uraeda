//! The review's routes: its page, then its writes, through the core's review actions, which write
//! the review file and the reviewed file's status, and commit nothing.
//!
//! - `GET  /{token}/{repo}/{folder}/review/{file}`: the spec's or the plan's page.
//! - `POST .../review/{file}/comment`: `{ lines: [start, end] | null, text }` adds a comment,
//!   `{ number, text }` replaces one, and an empty text removes it. Gives `{ comments }`.
//! - `POST .../review/{file}/verdict`: `{ verdict: "approve" | "request-changes", summary }`
//!   gives `{ next }`.

use std::sync::Arc;

use axum::Json;
use axum::extract::{Path as Address, State};
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};
use uraeda_core::actions::review::{self, Tier};
use uraeda_core::files::review as file;
use uraeda_core::gates;
use uraeda_core::git::Git;

use super::view;
use crate::round::routes::{Failure, on, place, told};
use crate::waiting::{self, Located};
use crate::{Shared, html};

/// The address of a reviewed file: the token, the repository, the feature's folder, and the file.
pub type Reviewed = Address<(String, String, String, String)>;

/// The reviewed file's name, refused unless it is the spec or the plan.
fn reviewed(name: &str) -> Result<&'static str, Failure> {
    match name {
        "spec.md" => Ok("spec.md"),
        "plan.md" => Ok("plan.md"),
        _ => Err(Failure(
            StatusCode::NOT_FOUND,
            "This page does not exist.".into(),
        )),
    }
}

/// The pending review's comments on disk, when there is one.
fn pending(located: &Located, name: &str) -> Vec<file::Comment> {
    let path = located
        .root
        .join(&located.feature.path)
        .join(review::review_name(name));
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| file::parse(&text).ok())
        .filter(|r| r.verdict == file::Verdict::Pending)
        .map(|r| r.comments)
        .unwrap_or_default()
}

/// The commit the last review named, from the review file as committed: the human's new comments
/// on disk replace it, and its commit is still the version they reviewed.
fn last_reviewed(located: &Located, name: &str) -> Option<String> {
    let git = Git::open(&located.root).ok()?;
    let head = git.head()?;
    let path = format!("{}/{}", located.feature.path, review::review_name(name));
    let bytes = git.read_file(head, &path).ok()??;
    let parsed = file::parse(&String::from_utf8(bytes).ok()?).ok()?;
    (!parsed.commit.is_empty()).then_some(parsed.commit)
}

/// `GET .../review/{file}`.
pub async fn page(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder, name)): Reviewed,
) -> Response {
    let drawn = on(&shared, repo, folder, move |located| {
        let name = reviewed(&name)?;
        let path = format!("{}/{name}", located.feature.path);
        let text = std::fs::read_to_string(located.root.join(&path)).map_err(|_| {
            Failure(
                StatusCode::NOT_FOUND,
                "This feature has no such file yet.".into(),
            )
        })?;
        let since = last_reviewed(&located, name).and_then(|commit| {
            let git = Git::open(&located.root).ok()?;
            Some(uraeda_core::api::since_commit(&git, &path, &commit, &text))
        });
        let feature_name = waiting::readable(&located.feature.slug);
        let draw = |markdown: &str| crate::render::draw(markdown, &path, "../");
        let main = view::main(&view::Page {
            text: &text,
            name: &feature_name,
            file: name,
            waiting: gates::awaits_human(&text),
            since: since.as_ref().filter(|s| s.found),
            comments: &pending(&located, name),
            draw: &draw,
        });
        let what = if name == "spec.md" { "spec" } else { "plan" };
        Ok(html::page_at(
            "../../../",
            &format!("{feature_name}: {what}"),
            &main,
        ))
    })
    .await;
    match drawn {
        Ok(page) => Html(page).into_response(),
        Err(failure) => failure.page("../../../"),
    }
}

#[derive(Deserialize)]
pub struct Commented {
    #[serde(default)]
    lines: Option<(usize, usize)>,
    #[serde(default)]
    number: Option<u32>,
    #[serde(default)]
    text: String,
}

/// `POST .../review/{file}/comment`.
pub async fn comment(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder, name)): Reviewed,
    Json(body): Json<Commented>,
) -> Result<Json<Value>, Failure> {
    on(&shared, repo, folder, move |located| {
        let name = reviewed(&name)?;
        let place = place(&located);
        let feature = &located.feature;
        let text = body.text.trim();
        match body.number {
            Some(number) if text.is_empty() => review::remove(&place, feature, name, number)?,
            Some(number) => review::edit(&place, feature, name, number, text)?,
            None if text.is_empty() => {}
            None => {
                let git = Git::open(&located.root)
                    .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                review::comment(&git, &place, feature, name, body.lines, text, None)?;
            }
        }
        Ok(Json(
            json!({ "comments": view::comments_json(&pending(&located, name)) }),
        ))
    })
    .await
}

#[derive(Deserialize)]
pub struct Verdict {
    verdict: String,
    #[serde(default)]
    summary: String,
}

/// `POST .../review/{file}/verdict`.
pub async fn verdict(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder, name)): Reviewed,
    Json(body): Json<Verdict>,
) -> Result<Json<Value>, Failure> {
    let (main, root, what) = on(&shared, repo, folder, move |located| {
        let name = reviewed(&name)?;
        let place = place(&located);
        let summary = Some(body.summary.trim()).filter(|s| !s.is_empty());
        let today = uraeda_core::today::today();
        let what = if name == "spec.md" { "spec" } else { "plan" };
        let done = match body.verdict.as_str() {
            "approve" => {
                review::approve(
                    &place,
                    &located.feature,
                    name,
                    summary,
                    &Tier::default(),
                    today,
                )?;
                "approved"
            }
            "request-changes" => {
                if pending(&located, name).is_empty() {
                    return Err(Failure(
                        StatusCode::UNPROCESSABLE_ENTITY,
                        "Say what to change first: add a comment on a passage, or on the whole \
                         file."
                            .into(),
                    ));
                }
                review::request_changes(&place, &located.feature, name, summary, today)?;
                "requested changes to"
            }
            _ => {
                return Err(Failure(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "Approve, or request changes.".into(),
                ));
            }
        };
        let what = format!("The human {done} the {what} of {}", located.feature.slug);
        Ok((located.main, located.root, what))
    })
    .await?;
    Ok(Json(
        json!({ "next": told(&shared, &main, &root, &what).await }),
    ))
}
