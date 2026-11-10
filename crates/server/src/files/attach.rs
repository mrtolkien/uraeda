//! The uploads: an image attached to a workflow file or kept for a chat message, and a note's
//! images. The image's bytes go to the core as they came: it checks them, encodes them, and
//! writes them. A refusal is 400 with `{ error }`, the core's text after its code.

use std::path::Path;

use axum::Json;
use axum::extract::{FromRequest, Multipart, Query, Request, State};
use axum::http::header::CONTENT_LENGTH;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{Value, json};
use uraeda_core::api::undo::{NOTE_IMAGES, NOTES, attached};
use uraeda_core::api::{self, ApiError};
use uraeda_core::images::{ImageError, MAX_BYTES};

use super::change::recorded;
use super::chat_images::ChatImages;
use super::repository::Repository;
use crate::records::writing::{self, Write};
use crate::shared::Shared;

/// The body's limit: the core's 20 MB for the image, and room for the multipart around it.
pub(super) const BODY_LIMIT: usize = MAX_BYTES + 1024 * 1024;

/// The name in refusals of an image without one, as the core names it.
const PASTED: &str = "pasted image";

/// A query string's pairs, in order: `name` may come several times.
type Pairs = Query<Vec<(String, String)>>;

/// `POST /r/<name>/attach`: an image, the multipart body's `file`, attached to the Markdown file
/// at `path`, or with `chat=1` kept in the data folder for a chat message. Both are named in the
/// query string, with the image's `name`, so that a body over the limit is refused by name
/// without being read. Answers the core's result: a file's `{ path, link, moved, change }`, with
/// the change an undo takes back, or a chat image's `{ id, width, height }`.
pub(super) async fn attach(
    State(shared): State<Shared>,
    repository: Repository,
    Query(query): Pairs,
    request: Request,
) -> Response {
    let name = first(&query, "name").filter(|name| !name.is_empty());
    if let Some(size) = declared_over(request.headers()) {
        return refused(over_limit(name.as_deref(), size));
    }
    let path = first(&query, "path");
    let chat = first(&query, "chat").as_deref() == Some("1");
    if chat == path.is_some() {
        return refused("refused: Give either a path or chat=1.");
    }
    // The refusals that need no image come before the body is read.
    if let Some(path) = &path
        && let Err(refusal) = writable(&shared, &repository.path, path)
    {
        return refused(refusal);
    }
    let file = match Form::read(request).await {
        Ok(form) => form.files.into_iter().next(),
        Err(TooLarge) => return refused(over_limit(name.as_deref(), BODY_LIMIT)),
    };
    let Some(bytes) = file else {
        return refused("refused: The body holds no file.");
    };
    let written = tokio::task::spawn_blocking(move || match path {
        Some(path) => to_file(&shared, &repository.name, &path, &bytes, name.as_deref()),
        None => to_chat(&shared, &bytes, name.as_deref()),
    });
    answer(written.await)
}

/// Runs an upload's write to the repository listed as `repository` in its turn, through the
/// write queue, as every write of the server: it commits nothing. A refusal is the core's, or
/// the list's for a repository that left it meanwhile.
fn in_turn<T>(
    shared: &Shared,
    repository: &str,
    write: impl FnOnce(&Path) -> Result<T, ApiError>,
) -> Result<T, String> {
    let written = writing::write(shared, repository, Write::saving(), |repo| Ok(write(repo)));
    match written {
        Ok(written) => written.map_err(refusal),
        Err(fault) => Err(format!("refused: {}", fault.message())),
    }
}

/// Attaches an image to the Markdown file at `path`: the core's answer, with the change it made.
fn to_file(
    shared: &Shared,
    repository: &str,
    path: &str,
    bytes: &[u8],
    name: Option<&str>,
) -> Result<Value, String> {
    let (attached, change) = in_turn(shared, repository, |repo| {
        recorded(repo, &attached(path), || {
            api::attach_image(repo, path, bytes, name)
        })
    })?;
    Ok(json!({
        "path": attached.path,
        "link": attached.link,
        "moved": attached.moved,
        "change": change,
    }))
}

/// Keeps an image for a chat message, in the data folder: encoded by the core, written here.
fn to_chat(shared: &Shared, bytes: &[u8], name: Option<&str>) -> Result<Value, String> {
    let encoded = api::encode_image(bytes, name.unwrap_or(PASTED)).map_err(refusal)?;
    let saved = ChatImages::of(shared).save(&encoded)?;
    Ok(json!(saved))
}

/// `POST /r/<name>/inbox/note-image`: images added to the inbox in one call to the core, which
/// encodes them and writes the note file's folder holding them, all or nothing. The multipart
/// body holds `hash`, the inbox's as read, one `file` per image, and either `text`, a new note's,
/// with `category` and `about` when given, or `id`, the note that gets them. The images' names
/// are the query string's `name`s, in the same order. Answers `{ change, file }`: the change an
/// undo takes back, and the note file's path.
pub(super) async fn note_image(
    State(shared): State<Shared>,
    repository: Repository,
    Query(query): Pairs,
    request: Request,
) -> Response {
    let names = query.into_iter().filter(|(key, _)| key == "name");
    let names: Vec<String> = names.map(|(_, name)| name).collect();
    if let Some(size) = declared_over(request.headers()) {
        return refused(over_limit(names.first().map(String::as_str), size));
    }
    let form = match Form::read(request).await {
        Ok(form) => form,
        Err(TooLarge) => {
            return refused(over_limit(names.first().map(String::as_str), BODY_LIMIT));
        }
    };
    let (text, id, hash) = (form.text("text"), form.text("id"), form.text("hash"));
    let Some(hash) = hash.filter(|_| !form.files.is_empty() && text.is_some() != id.is_some())
    else {
        return refused("refused: Give a hash, a file, and a text or a note id.");
    };
    let (category, about) = (form.text("category"), form.text("about"));
    // An empty name stands for a pasted image.
    let name = |index: usize| names.get(index).filter(|name| !name.is_empty()).cloned();
    let files = form.files.into_iter().enumerate();
    let images: Vec<_> = files.map(|(index, bytes)| (bytes, name(index))).collect();
    let written = tokio::task::spawn_blocking(move || {
        let ((_, file), change) = in_turn(&shared, &repository.name, |repo| match (text, id) {
            (Some(text), _) => recorded(repo, &scope(NOTES), || {
                api::add_note_with_images(repo, category, about, &text, &images, &hash)
            }),
            (None, id) => recorded(repo, &scope(NOTE_IMAGES), || {
                api::attach_note_images(repo, &id.unwrap_or_default(), &images, &hash)
            }),
        })?;
        Ok(json!({ "change": change, "file": file }))
    });
    answer(written.await)
}

/// One of the core's scopes of an undoable write, as the paths it takes.
fn scope(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|path| (*path).to_owned()).collect()
}

/// Refuses a write to a feature while an agent works on it, before the body is read.
// TASK 15: the sessions answer whether an agent works on the feature a path is of, as for every
// write of writing (R65). Until they exist, no agent works on any feature.
#[expect(
    clippy::unnecessary_wraps,
    reason = "the seam's shape, for the rule that joins it"
)]
fn writable(_: &Shared, _: &Path, _: &str) -> Result<(), String> {
    Ok(())
}

/// A body read to its end was over the limit.
struct TooLarge;

/// A multipart body, read whole: its fields' texts, and the bytes of each file of `file`.
#[derive(Default)]
struct Form {
    texts: Vec<(String, String)>,
    files: Vec<Vec<u8>>,
}

impl Form {
    /// Reads a request's body, up to the limit. A body that is not a multipart one, or is cut
    /// short, holds what was read before that: nothing, for most.
    async fn read(request: Request) -> Result<Form, TooLarge> {
        let mut form = Form::default();
        let Ok(mut multipart) = Multipart::from_request(request, &()).await else {
            return Ok(form);
        };
        loop {
            let field = match multipart.next_field().await {
                Ok(Some(field)) => field,
                Ok(None) => return Ok(form),
                Err(error) if error.status() == StatusCode::PAYLOAD_TOO_LARGE => {
                    return Err(TooLarge);
                }
                Err(_) => return Ok(form),
            };
            let name = field.name().unwrap_or_default().to_owned();
            // A field's text has no file name; a file part has one.
            let file = field.file_name().is_some();
            let bytes = match field.bytes().await {
                Ok(bytes) => bytes,
                Err(error) if error.status() == StatusCode::PAYLOAD_TOO_LARGE => {
                    return Err(TooLarge);
                }
                Err(_) => return Ok(form),
            };
            match (file, name.as_str()) {
                (true, "file") => form.files.push(bytes.to_vec()),
                (true, _) => {}
                (false, _) => {
                    let text = String::from_utf8_lossy(&bytes).into_owned();
                    form.texts.push((name, text));
                }
            }
        }
    }

    /// A field's text, when the form holds one that is not empty.
    fn text(&self, name: &str) -> Option<String> {
        let found = self.texts.iter().find(|(key, _)| key == name);
        found
            .map(|(_, text)| text.clone())
            .filter(|text| !text.is_empty())
    }
}

/// The first value of a query string's key.
fn first(query: &[(String, String)], key: &str) -> Option<String> {
    let found = query.iter().find(|(name, _)| name == key);
    found.map(|(_, value)| value.clone())
}

/// The size a request declares, when it is over the limit: such a body is never read.
fn declared_over(headers: &HeaderMap) -> Option<usize> {
    let length = headers.get(CONTENT_LENGTH)?.to_str().ok()?;
    length.parse().ok().filter(|length| *length > BODY_LIMIT)
}

/// The core's refusal of an image over its limit, with its code.
fn over_limit(name: Option<&str>, bytes: usize) -> String {
    let name = name.unwrap_or(PASTED).to_owned();
    format!("refused: {}", ImageError::Size { name, bytes })
}

/// The core's refusal as a client reads it: its code, then its message, and a hook's output.
fn refusal(error: ApiError) -> String {
    let mut text = format!("{}: {}", error.code, error.message);
    if let Some(output) = error.output {
        text.push_str("\n\n");
        text.push_str(&output);
    }
    text
}

/// The answer of a refused upload: 400 with `{ error }`.
fn refused(error: impl Into<String>) -> Response {
    let error = Json(json!({ "error": error.into() }));
    (StatusCode::BAD_REQUEST, error).into_response()
}

/// The answer of a write that ran on a blocking thread: its JSON, or its refusal.
fn answer(written: Result<Result<Value, String>, tokio::task::JoinError>) -> Response {
    match written {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(error)) => refused(error),
        Err(panicked) => {
            eprintln!("uraeda: an upload failed: {panicked}");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
