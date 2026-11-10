//! The WebSocket at `/live`: the handshake, then one connection's messages.

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::routing::get;
use uraeda_protocol::{ClientMessage, ErrorCode, PROTOCOL, ServerMessage, handshake};

use crate::Failure;
use crate::http::Routes;
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

/// One connection, from its `hello` to its end: the client's, the server's stop, or the end of
/// its sign-in, as a session signed out or a device revoked.
async fn connection(shared: Shared, headers: HeaderMap, mut socket: WebSocket) {
    if let Some(identity) = welcomed(&shared, &headers, &mut socket).await {
        tokio::select! {
            () = messages(&shared, &mut socket) => {}
            () = identity.ended() => {}
        }
    }
    // The close frame: a client that is gone already gets none.
    let _ = socket.send(Message::Close(None)).await;
}

/// A welcomed connection's messages, each answered, until the client or the server ends it.
async fn messages(shared: &Shared, socket: &mut WebSocket) {
    while let Some(text) = next(shared, socket).await {
        if let Some(answer) = answer(&text)
            && !send(socket, &answer).await
        {
            break;
        }
    }
}

/// The handshake: who the connection is, when its first message was a `hello` of this version
/// whose sign-in the server knows. Anything else is answered with the refusal, and the connection
/// closes. `headers` are those of the request that opened the connection, with a browser's cookie.
async fn welcomed(
    shared: &Shared,
    headers: &HeaderMap,
    socket: &mut WebSocket,
) -> Option<Identity> {
    let first = next(shared, socket).await?;
    let checked =
        handshake(&first).and_then(|sign_in| Ok(sign_in::check(shared, headers, &sign_in)?));
    match checked {
        Ok(identity) => {
            let welcome = ServerMessage::Welcome {
                protocol: PROTOCOL,
                epoch: shared.epoch().to_owned(),
            };
            send(socket, &welcome).await.then_some(identity)
        }
        Err(refusal) => {
            send(socket, &refusal).await;
            None
        }
    }
}

/// What answers a message on a welcomed connection.
///
/// TEMPORARY: no record and no action is served until the live engine (task 6).
fn answer(text: &str) -> Option<ServerMessage> {
    let error = |id, code, message: String| Some(ServerMessage::Error { id, code, message });
    let closed = "no record and no action is served yet".to_owned();
    match serde_json::from_str(text) {
        Ok(
            ClientMessage::Sub { id, .. }
            | ClientMessage::Call { id, .. }
            | ClientMessage::Resume { id, .. },
        ) => error(Some(id), ErrorCode::NotSignedIn, closed),
        Ok(ClientMessage::Unsub { .. }) => None,
        Ok(ClientMessage::Hello { .. }) => error(
            None,
            ErrorCode::BadMessage,
            "`hello` is the first message of a connection only".to_owned(),
        ),
        Err(problem) => error(None, ErrorCode::BadMessage, problem.to_string()),
    }
}

/// The connection's next text frame: none once the client closed it, or the server stops.
async fn next(shared: &Shared, socket: &mut WebSocket) -> Option<String> {
    loop {
        let message = tokio::select! {
            message = socket.recv() => message,
            () = shared.stopping() => None,
        };
        match message? {
            Ok(Message::Text(text)) => return Some(text.to_string()),
            Ok(Message::Close(_)) | Err(_) => return None,
            // A message is a text frame: pings are answered by the socket itself.
            Ok(_) => {}
        }
    }
}

/// Sends a message: false when the client is gone.
async fn send(socket: &mut WebSocket, message: &ServerMessage) -> bool {
    let text = serde_json::to_string(message).expect("a server message is JSON");
    socket.send(Message::Text(text.into())).await.is_ok()
}
