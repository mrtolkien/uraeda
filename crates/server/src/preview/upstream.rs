//! Requests to a preview's own server, which listens on 127.0.0.1: the proxy's, the index's,
//! and the warmer's.

use std::io;

use axum::http::{Request, Response, StatusCode, header};
use http_body_util::{BodyExt, Empty};
use hyper::body::{Bytes, Incoming};
use hyper_util::rt::TokioIo;
use tokio::net::TcpStream;

/// The `Host` a preview is asked under: its own.
pub(super) fn host(port: u16) -> String {
    format!("127.0.0.1:{port}")
}

/// Sends a request without a body to the server on `port`, on a connection of its own, which
/// may be upgraded: its answer, as it streams.
///
/// # Errors
///
/// When nothing listens there, or what does speaks no HTTP.
pub(super) async fn send(
    port: u16,
    request: Request<Empty<Bytes>>,
) -> io::Result<Response<Incoming>> {
    let stream = TcpStream::connect(("127.0.0.1", port)).await?;
    let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(stream))
        .await
        .map_err(io::Error::other)?;
    tokio::spawn(connection.with_upgrades());
    sender.send_request(request).await.map_err(io::Error::other)
}

/// A whole answer to a `GET`.
pub(super) struct Got {
    pub status: StatusCode,
    /// Its `Content-Type`, or nothing.
    pub kind: String,
    pub body: Bytes,
}

/// Reads `path`, with its query, from the server on `port`: none when nothing answers.
pub(super) async fn get(port: u16, path: &str) -> Option<Got> {
    let request = Request::get(path)
        .header(header::HOST, host(port))
        .body(Empty::new())
        .ok()?;
    let (parts, body) = send(port, request).await.ok()?.into_parts();
    let kind = parts.headers.get(header::CONTENT_TYPE);
    let kind = kind.and_then(|kind| kind.to_str().ok()).unwrap_or_default();
    Some(Got {
        status: parts.status,
        kind: kind.to_owned(),
        body: body.collect().await.ok()?.to_bytes(),
    })
}
