//! A second start's side of the handoff: it asks the server already on a port to open its
//! folder, with the host token, and never touches a file the running server owns.

use std::path::Path;
use std::time::Duration;

use http_body_util::{BodyExt as _, Full};
use hyper::body::Bytes;
use hyper::header::{AUTHORIZATION, CONTENT_TYPE, HOST};
use hyper::{Method, Request, StatusCode};
use hyper_util::rt::TokioIo;
use serde_json::{Value, json};
use tokio::net::TcpStream;

/// What the server on the port did.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum HandOff {
    /// It opened the folder: the page it answered.
    Opened(String),
    /// It is this data folder's server, and refused the folder: why.
    Refused(String),
    /// It refused the host token, as a server with another data folder does.
    Unauthorized,
    /// It is another program, or does not answer.
    Other,
}

/// How long a handoff waits for an answer: 2 seconds for a port without a host token, where any
/// program may listen, and a minute with one, which the data folder's own server wrote as it took
/// the port, before the rest of its start.
const ANSWER: Duration = Duration::from_secs(2);
const STARTING: Duration = Duration::from_secs(60);

/// Asks the server on 127.0.0.1:`port` to open `folder`, with the host token `token`.
pub(crate) async fn hand_over(port: u16, token: Option<&str>, folder: Option<&Path>) -> HandOff {
    let patience = if token.is_some() { STARTING } else { ANSWER };
    let folder = json!({ "folder": folder.and_then(Path::to_str) });
    let asked = tokio::time::timeout(patience, post(port, token, "/open", &folder)).await;
    let Ok(Some((status, body))) = asked else {
        return HandOff::Other;
    };
    let text = |key: &str| body.get(key).and_then(Value::as_str);
    match (status, text("uraeda"), text("url"), text("error")) {
        (StatusCode::UNAUTHORIZED, ..) => HandOff::Unauthorized,
        (StatusCode::BAD_REQUEST, _, _, Some(error)) => HandOff::Refused(error.to_owned()),
        (StatusCode::OK, Some(_), Some(url), _) if on_server(url) => {
            HandOff::Opened(url.to_owned())
        }
        _ => HandOff::Other,
    }
}

/// Whether a page is a path on the server, safe to open or to redirect to: it starts with one
/// `/`, and holds no `\`, which a browser reads as a `/`, and no blank or control character,
/// which a browser drops. `//evil.com`, `/\evil.com`, and a full address lead to another site.
pub(crate) fn on_server(path: &str) -> bool {
    let visible = path.bytes().all(|byte| byte.is_ascii_graphic());
    visible && path.starts_with('/') && !path[1..].starts_with('/') && !path.contains('\\')
}

/// A `POST` of a JSON body to a route of the server on 127.0.0.1:`port`, with the host token, as
/// the host's own `ura` sends: the answer's status and JSON, or nothing for a refused connection
/// or an answer that is not JSON.
pub(crate) async fn post(
    port: u16,
    token: Option<&str>,
    path: &str,
    body: &Value,
) -> Option<(StatusCode, Value)> {
    let stream = TcpStream::connect(("127.0.0.1", port)).await.ok()?;
    let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(stream))
        .await
        .ok()?;
    tokio::spawn(connection);
    let mut request = Request::builder()
        .method(Method::POST)
        .uri(path)
        .header(HOST, format!("127.0.0.1:{port}"))
        .header(CONTENT_TYPE, "application/json");
    if let Some(token) = token {
        request = request.header(AUTHORIZATION, format!("Bearer {token}"));
    }
    let body = serde_json::to_vec(body).ok()?;
    let request = request.body(Full::new(Bytes::from(body))).ok()?;
    let response = sender.send_request(request).await.ok()?;
    let status = response.status();
    let body = response.into_body().collect().await.ok()?.to_bytes();
    Some((status, serde_json::from_slice(&body).ok()?))
}
