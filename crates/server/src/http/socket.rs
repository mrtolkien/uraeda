//! The WebSocket at `/live`: the handshake, then the live engine serves the connection.

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::routing::get;
use uraeda_protocol::{ErrorCode, Frame, PROTOCOL, ServerMessage, frame, handshake};

use crate::Failure;
use crate::http::Routes;
use crate::live::{self, Caller};
use crate::shared::Shared;
use crate::sign_in::{self, Identity};

/// Mounts `GET /live`.
pub(crate) fn mount(_: &Shared, routes: &mut Routes) -> Result<(), Failure> {
    routes.route("/live", get(upgrade));
    Ok(())
}

/// Upgrades a request the guard let through to a connection.
async fn upgrade(
    State(shared): State<Shared>,
    headers: HeaderMap,
    socket: WebSocketUpgrade,
) -> Response {
    socket.on_upgrade(move |socket| connection(shared, headers, socket))
}

/// One connection, from its `hello` to its end. The live engine serves whoever sign-in
/// welcomed, and ends the connection: at the client's end, the server's stop, or the end of the
/// sign-in, as a session signed out or a device revoked.
async fn connection(shared: Shared, headers: HeaderMap, mut socket: WebSocket) {
    if let Some(identity) = welcomed(&shared, &headers, &mut socket).await {
        let signed_in = identity.clone();
        let caller = Caller::new(identity, async move { signed_in.ended().await });
        live::serve(&shared, &mut socket, caller).await;
    }
    // The close frame: a client that is gone already gets none.
    let _ = socket.send(Message::Close(None)).await;
}

/// The handshake: who the connection is, when its first message was a `hello` of this version
/// whose sign-in the server knows. Anything else is answered with the refusal, and the connection
/// closes. `headers` are those of the request that opened the connection, with a browser's cookie.
async fn welcomed(
    shared: &Shared,
    headers: &HeaderMap,
    socket: &mut WebSocket,
) -> Option<Identity> {
    let checked = match next(shared, socket).await? {
        Said::Text(first) => handshake(&first),
        Said::Binary => Err(binary_refused()),
    };
    let checked = checked.and_then(|sign_in| Ok(sign_in::check(shared, headers, &sign_in)?));
    match checked {
        Ok(identity) => {
            let welcome = ServerMessage::Welcome {
                protocol: PROTOCOL,
                epoch: shared.epoch().to_owned(),
                time_zone: zone_name(),
            };
            send(socket, &welcome).await.then_some(identity)
        }
        Err(refusal) => {
            send(socket, &refusal).await;
            None
        }
    }
}

/// The server's time zone, by its IANA name: the machine's, as the scheduler reads it, or `UTC`
/// where the machine names none.
fn zone_name() -> String {
    jiff::tz::TimeZone::system()
        .iana_name()
        .unwrap_or("UTC")
        .to_owned()
}

/// What a client sent: a message's text, or a binary frame, which only the server sends.
pub(crate) enum Said {
    Text(String),
    Binary,
}

/// The `error` that answers a client's binary frame.
pub(crate) fn binary_refused() -> ServerMessage {
    ServerMessage::Error {
        id: None,
        code: ErrorCode::BadMessage,
        message: "a client's message is a text frame: binary frames are the server's".to_owned(),
    }
}

/// The connection's next message: none once the client closed it, or the server stops.
pub(crate) async fn next(shared: &Shared, socket: &mut WebSocket) -> Option<Said> {
    loop {
        let message = tokio::select! {
            message = socket.recv() => message,
            () = shared.stopping() => None,
        };
        match message? {
            Ok(Message::Text(text)) => return Some(Said::Text(text.to_string())),
            Ok(Message::Binary(_)) => return Some(Said::Binary),
            Ok(Message::Close(_)) | Err(_) => return None,
            // Pings are answered by the socket itself.
            Ok(_) => {}
        }
    }
}

/// Sends a message: false when the client is gone.
pub(crate) async fn send(socket: &mut WebSocket, message: &ServerMessage) -> bool {
    send_frame(socket, frame(message)).await
}

/// Sends a frame, as `frame` or the live engine wrote it: false when the client is gone.
pub(crate) async fn send_frame(socket: &mut WebSocket, frame: Frame) -> bool {
    let message = match frame {
        Frame::Text(text) => Message::Text(text.into()),
        Frame::Binary(bytes) => Message::Binary(bytes.into()),
    };
    socket.send(message).await.is_ok()
}
