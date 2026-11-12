//! Sign-in: who reaches the server. It owns the access key, the sessions, and the paired devices,
//! and every route and the WebSocket ask it.
//!
//! - A browser signs in once with the access key, `POST /session`, or a one-time link the host
//!   made, and carries a session cookie from then on.
//! - Another device pairs once, `POST /pair`, with a one-time code from the host's `ura pair`,
//!   and signs in with a token of its own from then on: in its `hello`, and as
//!   `Authorization: Bearer <token>` on a route.
//! - Everything is random, and kept only as a hash: see [`crate::secret::Hashed`].
//! - The access key is made only where a person sees it, and nowhere else: `ura serve` at a
//!   terminal makes it at its first start, [`key_at_start`], and `ura key` asks the running
//!   server for one, [`access_key`]. A server whose output goes to a file, as the app's, makes
//!   none: a key in a log would rest there in clear.
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
//! The WebSocket checks its `hello` itself, with [`check`], and gives the identity to the live
//! engine, which serves the connection for as long as the sign-in lives, and gives it to each
//! action as `call.caller()`. Whatever outlives a request awaits [`Identity::ended`] beside its
//! own work, and stops then: a signed-out session and a revoked device close their connections.
//!
//! The paired devices are the record `Devices`, with the actions `devices.revoke` and
//! `devices.rename`: see [`devices`].

mod check;
mod cookie;
mod date;
pub mod devices;
mod host;
mod listeners;
mod once;
mod pairing;
mod routes;
mod store;

use std::sync::Arc;
use std::time::Duration;

use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};

use crate::http::Routes;
use crate::shared::Shared;
use crate::{Failure, secret};

pub use check::{Identity, OPEN, Open, Refusal, check, require};
pub(crate) use check::{Unguarded, layer};
pub use host::{NewKey, access_key};
use once::Once;
pub use pairing::{Pairing, pairing_code};
use store::Store;
pub use store::{Kind, Problem};

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

/// What sign-in holds: the store, and the one-time links and pairing codes not used yet.
pub(crate) struct State {
    store: Store,
    links: Once<String>,
    codes: Once<()>,
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
    let store = Store::open(shared.data_dir())?;
    // The sandbox's server: without sign-in unless its mode keeps it.
    if shared
        .find::<crate::sandbox::Mode>()
        .is_some_and(|mode| !mode.sign_in)
    {
        shared.provide(Unguarded::new());
    }
    shared.provide(State {
        store,
        links: Once::new(LINK),
        codes: Once::new(pairing::LIVES),
    });
    routes::mount(routes);
    pairing::mount(routes);
    devices::register(shared);
    tokio::spawn(sweeps(shared.clone()));
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

/// The access key to show as the server starts, to the person who started it at a terminal:
/// made now when the data folder has none, the only time it is shown. `None` when it has one, or
/// without sign-in. The sandbox with sign-in makes a new one at each start, so its sign-in and
/// pairing screens can be reached any time.
///
/// Only a start whose output a person reads asks: a key made and never shown would be useless,
/// and one written in a log would rest there in clear.
///
/// # Errors
///
/// When the sign-in file cannot be written: no key is made then.
pub fn key_at_start(shared: &Shared) -> Result<Option<String>, Problem> {
    if shared.find::<Unguarded>().is_some() {
        return Ok(None);
    }
    let store = &state(shared).store;
    match shared.find::<crate::sandbox::Mode>() {
        Some(_) => store.replace_key().map(Some),
        None => store.first_key(),
    }
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
        say_err!("uraeda: {problem}");
    }
}

/// Calls `listener` with the id of every session and device that ends, once each: what ends with
/// a session hangs here, as the frame secret, which changes then.
pub fn on_ended(shared: &Shared, listener: impl Fn(&str) + Send + Sync + 'static) {
    state(shared).store.listeners.on_ended(listener);
}
