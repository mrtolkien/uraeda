//! The server's HTTP: the routes its domains mount, behind the rules every request passes.

pub(crate) mod diagram;
pub(crate) mod foreign;
pub(crate) mod open;
pub(crate) mod socket;
pub(crate) mod web;

use axum::Router;
use axum::extract::Request;
use axum::http::HeaderValue;
use axum::http::header::X_FRAME_OPTIONS;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::MethodRouter;
use tokio::net::TcpListener;

use crate::shared::Shared;
use crate::{guard, sign_in};

/// The routes of the server, as its domains mount them.
#[derive(Default)]
pub struct Routes {
    router: Router<Shared>,
    paths: Vec<&'static str>,
}

impl Routes {
    /// Adds a route: its path, in axum's syntax, as `/r/{name}/raw/{*path}`, and its handlers by
    /// method, as `get(read).post(write)`. A handler reaches the shared state as `State<Shared>`.
    pub fn route(&mut self, path: &'static str, handlers: MethodRouter<Shared>) {
        self.router = std::mem::take(&mut self.router).route(path, handlers);
        self.paths.push(path);
    }

    /// The paths of the routes added so far.
    pub(crate) fn paths(&self) -> Vec<&'static str> {
        self.paths.clone()
    }
}

/// The server's router: the mounted routes, and the app's web build at every other path, behind
/// the rules every request passes, the guard first, then the session check. Every answer, a refusal's included, says
/// who may frame it. A rule for every request is a layer here, the last one outermost.
pub(crate) fn router(shared: &Shared, routes: Routes) -> Router {
    // What no route takes is the app's: a file of its web build, or its page.
    shared.provide(std::sync::Arc::new(web::Web::load(shared, routes.paths())));
    routes
        .router
        .fallback(web::answer)
        .layer(middleware::from_fn_with_state(
            shared.clone(),
            sign_in::layer,
        ))
        .layer(middleware::from_fn_with_state(shared.clone(), guard::layer))
        .layer(middleware::from_fn(frames))
        .with_state(shared.clone())
}

/// Says on every answer that only Uraeda's own pages may frame it, so no other site shows a
/// page of Uraeda under its own. A mockup's and a preview's are the exception: they are made to
/// be framed, sandboxed, from the origin `null`.
async fn frames(request: Request, next: Next) -> Response {
    let framed = framed(request.uri().path());
    let mut response = next.run(request).await;
    if !framed {
        let same_origin = HeaderValue::from_static("SAMEORIGIN");
        response.headers_mut().insert(X_FRAME_OPTIONS, same_origin);
    }
    response
}

/// Whether a path is one Uraeda's own pages frame: a repository's mockups, or its previews, and
/// the page an extension's page runs in, whose own policy names who frames it.
fn framed(path: &str) -> bool {
    if path == web::EXTENSION_PAGE {
        return true;
    }
    let mut parts = path.strip_prefix("/r/").unwrap_or_default().splitn(3, '/');
    let kind = parts.nth(1);
    matches!(kind, Some("mockups" | "preview"))
}

/// Serves the router on the listener until the server stops, then lets open requests end.
pub(crate) async fn serve(listener: TcpListener, router: Router, shared: Shared) {
    let stopping = async move { shared.stopping().await };
    if let Err(error) = axum::serve(listener, router)
        .with_graceful_shutdown(stopping)
        .await
    {
        say_err!("uraeda: the server stopped listening: {error}");
    }
}

/// A text as one segment of a path, as in `/r/<name>/`: every byte but a letter, a digit, and
/// `-_.~` is percent-encoded.
pub(crate) fn segment(text: &str) -> String {
    let mut encoded = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.~".contains(&byte) {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}
