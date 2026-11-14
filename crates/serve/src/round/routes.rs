//! The round's routes: its page, then its writes. Each write goes through the core's answer
//! actions, which write the round's file and commit nothing, refuse a round that no longer waits,
//! and refuse a write over an answer that changed since the page read it.
//!
//! - `GET  /{token}/{repo}/{folder}/round`: the latest round's page.
//! - `POST /{token}/{repo}/{folder}/answer`: `{ id, letters, comment, previous }` gives
//!   `{ answer, answered, total }`.
//! - `POST .../notes`: `{ notes, previous }` gives `{ notes }`.
//! - `POST .../settled`: `{ subject, number, text, previous }`: number 0 adds a comment, an empty
//!   text removes it. Gives `{ number, text }`.
//! - `POST .../submit`: `{}` sets the round answered, tells the session when the settings say so,
//!   and gives `{ next }`, what the human does next.

use std::path::Path;
use std::sync::Arc;

use axum::Json;
use axum::extract::{Path as Address, State};
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};
use uraeda_core::actions::ActionError;
use uraeda_core::actions::answer;
use uraeda_core::actions::place::Place;
use uraeda_core::files::clarifications;
use uraeda_core::gates;

use super::{parts, view};
use crate::waiting::{self, LocateError, Located};
use crate::{Shared, html, wake};

/// The address of a feature's page: the token, the repository, and the feature's folder.
pub type Feature = Address<(String, String, String)>;

/// A failed request: its status and the human's words.
pub struct Failure(pub StatusCode, pub String);

impl Failure {
    /// The failure as a page, for a GET: `base` is the path back to the token's folder.
    pub fn page(self, base: &str) -> Response {
        let body = format!(
            "<main><h1>Nothing here</h1><p>{}</p><p><a href=\"{base}\">What waits on you</a></p></main>",
            html::escape(&self.1)
        );
        (self.0, Html(html::page_at(base, "Nothing here", &body))).into_response()
    }
}

impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<LocateError> for Failure {
    fn from(error: LocateError) -> Failure {
        match error {
            LocateError::NotFound => {
                Failure(StatusCode::NOT_FOUND, "This page does not exist.".into())
            }
            LocateError::Read(why) => Failure(StatusCode::INTERNAL_SERVER_ERROR, why),
        }
    }
}

impl From<ActionError> for Failure {
    fn from(error: ActionError) -> Failure {
        match error {
            ActionError::Changed { .. } => Failure(
                StatusCode::CONFLICT,
                "This round changed since you opened it: nothing was saved. Reload to see it."
                    .into(),
            ),
            ActionError::Refused(why) if why.contains("not waiting") => Failure(
                StatusCode::CONFLICT,
                "This round no longer waits for answers: an agent took it. Reload to see it."
                    .into(),
            ),
            ActionError::Refused(why) => Failure(StatusCode::UNPROCESSABLE_ENTITY, sentence(&why)),
            ActionError::Answer(why) => {
                Failure(StatusCode::UNPROCESSABLE_ENTITY, sentence(&why.to_string()))
            }
            other => Failure(StatusCode::INTERNAL_SERVER_ERROR, other.to_string()),
        }
    }
}

/// `text` with a capital and a full stop, as the page says it.
fn sentence(text: &str) -> String {
    let mut out = waiting::readable(text.trim());
    if !out.ends_with('.') {
        out.push('.');
    }
    out
}

/// Runs `work` on the feature, located fresh, off the async threads.
pub async fn on<T: Send + 'static>(
    shared: &Arc<Shared>,
    repo: String,
    folder: String,
    work: impl FnOnce(Located) -> Result<T, Failure> + Send + 'static,
) -> Result<T, Failure> {
    let settings = shared.settings.clone();
    tokio::task::spawn_blocking(move || work(waiting::locate(&settings, &repo, &folder)?))
        .await
        .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
}

pub fn place(located: &Located) -> Place {
    Place {
        root: located.root.clone(),
        created: false,
        switched: None,
    }
}

/// The latest round's path from the top level, and its text.
fn round_text(located: &Located) -> Result<(String, String), Failure> {
    let file = answer::round_path(&located.feature)?;
    let text = std::fs::read_to_string(located.root.join(&file))
        .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok((file, text))
}

/// `GET .../round`.
pub async fn page(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder)): Feature,
) -> Response {
    let drawn = on(&shared, repo, folder, |located| {
        let (file, text) = round_text(&located)?;
        let round = parts::cut(&text);
        let name = waiting::readable(&located.feature.slug);
        let number = answer::name_of(&file)
            .trim_start_matches("clarifications-")
            .trim_end_matches(".md")
            .parse()
            .unwrap_or(1);
        let draw = |markdown: &str| crate::render::draw(markdown, &file, "./");
        let main = view::main(
            &text,
            &round,
            &view::Page {
                name: &name,
                number,
                waiting: gates::awaits_human(&text),
            },
            &draw,
        );
        Ok(html::page_at(
            "../../",
            &format!("{name}: questions"),
            &main,
        ))
    })
    .await;
    match drawn {
        Ok(page) => Html(page).into_response(),
        Err(failure) => failure.page("../../"),
    }
}

#[derive(Deserialize)]
pub struct Answered {
    id: String,
    #[serde(default)]
    letters: Vec<String>,
    #[serde(default)]
    comment: String,
    #[serde(default)]
    previous: String,
}

/// `POST .../answer`.
pub async fn save(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder)): Feature,
    Json(body): Json<Answered>,
) -> Result<Json<Value>, Failure> {
    on(&shared, repo, folder, move |located| {
        let written = answer::save(
            &place(&located),
            &located.feature,
            &body.id,
            &body.letters,
            body.comment.trim(),
            &body.previous,
        )?;
        let answer = clarifications::parse(&written.text)
            .into_iter()
            .find(|q| q.id == body.id)
            .map(|q| q.answer)
            .unwrap_or_default();
        Ok(Json(json!({
            "answer": answer,
            "answered": written.answered,
            "total": written.total,
        })))
    })
    .await
}

#[derive(Deserialize)]
pub struct Notes {
    notes: String,
    #[serde(default)]
    previous: String,
}

/// `POST .../notes`.
pub async fn notes(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder)): Feature,
    Json(body): Json<Notes>,
) -> Result<Json<Value>, Failure> {
    on(&shared, repo, folder, move |located| {
        let written = answer::save_notes(
            &place(&located),
            &located.feature,
            &body.notes,
            &body.previous,
        )?;
        let free = clarifications::round_notes(&written.text)
            .map(|n| n.free)
            .unwrap_or_default();
        Ok(Json(json!({ "notes": free })))
    })
    .await
}

#[derive(Deserialize)]
pub struct Settled {
    subject: String,
    #[serde(default)]
    number: u32,
    text: String,
    #[serde(default)]
    previous: String,
}

/// `POST .../settled`.
pub async fn settled(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder)): Feature,
    Json(body): Json<Settled>,
) -> Result<Json<Value>, Failure> {
    on(&shared, repo, folder, move |located| {
        let place = place(&located);
        let round = &located.feature;
        let text = body.text.trim();
        let written = match (body.number, text.is_empty()) {
            (0, true) => return Ok(Json(json!({ "number": 0, "text": "" }))),
            (0, false) => answer::add_settled_comment(&place, round, &body.subject, text)?,
            (n, true) => {
                answer::remove_settled_comment(&place, round, n, &body.subject, &body.previous)?
            }
            (n, false) => {
                answer::edit_settled_comment(&place, round, n, &body.subject, text, &body.previous)?
            }
        };
        let comments = clarifications::round_notes(&written.text)
            .map(|n| n.comments)
            .unwrap_or_default();
        let found = comments
            .iter()
            .position(|(subject, _)| subject.trim() == body.subject.trim())
            .map(|i| (i + 1, comments[i].1.clone()));
        let (number, text) = found.unwrap_or((0, String::new()));
        Ok(Json(json!({ "number": number, "text": text })))
    })
    .await
}

/// `POST .../submit`.
pub async fn submit(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder)): Feature,
) -> Result<Json<Value>, Failure> {
    let (main, root, what) = on(&shared, repo, folder, |located| {
        let (file, _) = round_text(&located)?;
        answer::submit(
            &place(&located),
            &located.feature,
            uraeda_core::today::today(),
            false,
        )?;
        let what = format!(
            "The human answered {} of {}",
            answer::name_of(&file)
                .trim_end_matches(".md")
                .replace('-', " "),
            located.feature.slug
        );
        Ok((located.main, located.root, what))
    })
    .await?;
    Ok(Json(
        json!({ "next": told(&shared, &main, &root, &what).await }),
    ))
}

/// Tells the feature's session to continue when the settings say so, and says what the human
/// does next.
pub async fn told(shared: &Shared, main: &Path, root: &Path, what: &str) -> String {
    let Some(how) = &shared.settings.wake else {
        return "Tell your session to continue.".into();
    };
    match wake::wake(how, main, root, &wake::message(what)).await {
        wake::Woken::Told { .. } => "Your session was told to continue.".into(),
        wake::Woken::NoSession => {
            "No open session works on this feature: start one, or tell yours to continue.".into()
        }
        wake::Woken::Failed(_) => {
            "Your session could not be told: tell it to continue yourself.".into()
        }
    }
}
