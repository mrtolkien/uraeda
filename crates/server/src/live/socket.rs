//! A connection over its WebSocket: one task, from the `welcome` to the connection's end.

use std::pin::Pin;

use axum::extract::ws::WebSocket;

use super::subscription::Connection;
use crate::http::socket::{Said, next, send_frame};
use crate::shared::Shared;
use crate::sign_in::Identity;

/// Who a welcomed connection is, and when its sign-in ends.
pub struct Caller {
    /// The identity sign-in checked: an action reads it as `Call::caller`.
    identity: Identity,
    /// Ends when the sign-in does, as a session signed out or a device revoked: the connection
    /// closes.
    ended: Pin<Box<dyn Future<Output = ()> + Send>>,
}

impl Caller {
    /// A caller: the identity sign-in checked, and the future that ends with its sign-in.
    pub fn new(identity: Identity, ended: impl Future<Output = ()> + Send + 'static) -> Caller {
        Caller {
            identity,
            ended: Box::pin(ended),
        }
    }
}

/// Serves a welcomed connection until the client closes it, the server stops, or the caller's
/// sign-in ends. A client that reads slowly waits here, in its own task, and holds nobody up.
///
/// It is the one place a connection ends. Once the sign-in ended, no message is read and none is
/// sent: the end is looked at first, each time. Leaving drops the connection, which ends its
/// subscriptions; the calls it made run to their end, unanswered.
pub(crate) async fn serve(shared: &Shared, socket: &mut WebSocket, caller: Caller) {
    let Caller {
        identity,
        mut ended,
    } = caller;
    let mut connection = Connection::open(shared, identity);
    loop {
        let frame = tokio::select! {
            biased;
            () = &mut ended => return,
            said = next(shared, socket) => match said {
                Some(Said::Text(text)) => {
                    connection.read(&text);
                    continue;
                }
                Some(Said::Binary) => {
                    connection.refuse_binary();
                    continue;
                }
                None => return,
            },
            frame = connection.next_frame() => frame,
        };
        let sent = tokio::select! {
            biased;
            () = &mut ended => false,
            sent = send_frame(socket, frame) => sent,
        };
        if !sent {
            return;
        }
    }
}
