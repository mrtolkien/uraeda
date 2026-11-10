//! Sign-in: who reaches the server. It owns the access key, the sessions, and the paired devices,
//! and every route and the WebSocket ask it.
//!
//! - A browser signs in once with the access key, `POST /session`, or a one-time link the host
//!   made, and carries a session cookie from then on.
//! - Another device pairs once, `POST /pair`, with a one-time code from the host's `ura pair`,
//!   and signs in with a token of its own from then on: in its `hello`, and as
//!   `Authorization: Bearer <token>` on a route.
//! - Everything is random, and kept only as a hash: see [`crate::secret::Hashed`].
//!
//! # Asking who it is
//!
//! Every route is closed: the session check, a layer over every route, answers 401 to a request
//! without a session or a device's token, but on the routes of [`OPEN`]. So a handler is only
//! reached by a signed-in request, and takes its [`Identity`] as an argument when it needs it:
//!
//! ```ignore
//! async fn read(identity: Identity, State(shared): State<Shared>) -> Response { .. }
//! ```
//!
//! The WebSocket checks its `hello` itself, with [`check`], and holds the identity for as long
//! as it lives. Whatever outlives a request awaits [`Identity::ended`] beside its own work, and
//! stops then: a signed-out session and a revoked device close their connections.

mod check;
mod cookie;
mod date;
pub mod devices;
mod listeners;
mod once;
mod pairing;
mod routes;
mod store;

use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};

use crate::http::Routes;
use crate::shared::Shared;
use crate::{Failure, secret};

pub(crate) use check::layer;
pub use check::{Identity, OPEN, Open, Refusal, check, require};
use once::Once;
pub use pairing::{Pairing, pairing_code};
pub use store::Kind;
use store::Store;

/// How long a one-time link may be used after it is made.
const LINK: Duration = Duration::from_secs(5 * 60);

/// How often the sessions and the devices unused for 30 days are ended.
const SWEEP: Duration = Duration::from_secs(60 * 60);

/// What a link's path keeps as it is, in the link's `to`: what a path is made of.
const PATH: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'~')
    .remove(b'/');

/// What sign-in holds: the store, the one-time links and pairing codes not used yet, and the
/// access key this start made, until it is shown.
pub(crate) struct State {
    store: Store,
    links: Once<String>,
    codes: Once<()>,
    first_key: Mutex<Option<String>>,
}

/// Sign-in's state, which `mount` provides.
fn state(shared: &Shared) -> Arc<State> {
    shared.get()
}

/// Opens the sign-in store of the data folder, and mounts the sign-in and pairing routes.
///
/// # Errors
///
/// When the sign-in file cannot be read, or its first version cannot be written: the server does
/// not start without knowing who may reach it.
pub(crate) fn mount(shared: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    let (store, key) = Store::open(shared.data_dir())?;
    shared.provide(State {
        store,
        links: Once::new(LINK),
        codes: Once::new(pairing::LIVES),
        first_key: Mutex::new(key),
    });
    routes::mount(routes);
    pairing::mount(routes);
    tokio::spawn(sweeps(shared.clone()));
    let stopping = shared.clone();
    shared.on_stop("sign-in", async move {
        let state = state(&stopping);
        let unseen = state
            .first_key
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        // A key this start made and never showed is lost: the next start makes and shows one.
        if unseen.is_some() {
            state.store.forget();
        }
    });
    Ok(())
}

/// Ends what nobody uses, every hour, until the server stops.
async fn sweeps(shared: Shared) {
    loop {
        tokio::select! {
            () = tokio::time::sleep(SWEEP) => sweep(&shared),
            () = shared.stopping() => return,
        }
    }
}

/// The access key, when this start of the server made it: given once, to be shown, and never
/// again. A server that stops without having given it forgets it, so its next start makes one.
pub fn first_key(shared: &Shared) -> Option<String> {
    let state = state(shared);
    let mut key = state
        .first_key
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    key.take()
}

/// The lines that show the access key a start made, the only time it is shown.
pub fn key_lines(key: &str) -> String {
    format!(
        "Access key, shown once: {key}\n\
         Keep it in a password manager: a browser signs in with it. `ura pair` pairs another \
         device.\n"
    )
}

/// A new one-time link to `to`, a path on the server: `/session/<token>?to=<to>`. It signs one
/// browser in, once, within 5 minutes, and leads it to `to`. It is for the host's own browser:
/// never put it where another user of the machine reads it, as a command line.
pub fn link(shared: &Shared, to: &str) -> String {
    let token = secret::random(32);
    let links = &state(shared).links;
    links.hold(&token, to.to_owned(), shared.now());
    format!("/session/{token}?to={}", utf8_percent_encode(to, PATH))
}

/// Ends every session and every device unused for more than 30 days, with their connections.
/// One with a connection open is in use. The server does it every hour.
pub fn sweep(shared: &Shared) {
    if let Err(problem) = state(shared).store.sweep(shared.now()) {
        eprintln!("uraeda: {problem}");
    }
}

/// Calls `listener` with the id of every session and device that ends, once each: what ends with
/// a session hangs here, as the frame secret, which changes then.
pub fn on_ended(shared: &Shared, listener: impl Fn(&str) + Send + Sync + 'static) {
    state(shared).store.listeners.on_ended(listener);
}
