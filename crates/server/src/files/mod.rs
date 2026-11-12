//! The files a client reads and sends as bytes, each under its repository's prefix, `/r/<name>`:
//!
//! - `GET /raw/<path>`: a file of the repository as text, for links to code.
//! - `GET /mockups/<secret>/<path>`: a page of a `mockups/` folder, sandboxed, under the frame
//!   secret.
//! - `GET /images/<path>`: an image under `specs/`, served so that a browser never runs it.
//! - `GET` and `DELETE /chat-images/<id>`: a chat's image, kept in the data folder.
//! - `POST /attach` and `POST /inbox/note-image`: the uploads, see [`attach`].
//!
//! Every route is closed: a request carries a session or a device's token, but a mockup's, which
//! a sandboxed frame reads on a path with the frame secret. The core decides what
//! a path may read: nothing outside the repository, hidden, untracked, or behind a symlink. The
//! server never opens a repository's file itself.

mod attach;
mod change;
pub(crate) mod chat_images;
mod images;
mod pick;
mod raw;
mod repository;

use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};

use crate::Failure;
use crate::http::Routes;
use crate::shared::Shared;

pub(crate) use raw::in_mockups;

/// The mockups' route, which sign-in opens to a path with the frame secret.
pub(crate) const MOCKUPS: &str = "/r/{name}/mockups/{*path}";

/// Mounts the files' routes.
pub(crate) fn mount(_: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    routes.route("/r/{name}/raw/{*path}", get(raw::raw));
    routes.route(MOCKUPS, get(raw::mockup));
    routes.route("/r/{name}/images/{*path}", get(images::committed));
    let chat = get(images::chat).delete(images::remove);
    routes.route("/r/{name}/chat-images/{id}", chat);
    // The uploads count their own bodies: see `attach::BODY_LIMIT`.
    let limit = DefaultBodyLimit::max(attach::BODY_LIMIT);
    routes.route("/r/{name}/attach", post(attach::attach).layer(limit));
    let note = post(attach::note_image).layer(limit);
    routes.route("/r/{name}/inbox/note-image", note);
    Ok(())
}
