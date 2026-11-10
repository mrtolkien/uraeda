//! A connection over its WebSocket: one task, from the `welcome` to the connection's end.

use std::pin::Pin;

use axum::extract::ws::WebSocket;

use super::Identity;
use super::subscription::Connection;
use crate::http::socket::{next, send};
use crate::shared::Shared;

/// Who a welcomed connection is, and when its sign-in ends.
pub struct Caller {
    /// The identity sign-in checked: an action reads it as `Call::caller`.
    identity: Identity,
    /// Ends when the sign-in does, as a device's token that is revoked: the connection closes.
    ended: Pin<Box<dyn Future<Output = ()> + Send>>,
}

impl Caller {
    /// A caller, and the future that ends with its sign-in.
    pub fn new(identity: Identity, ended: impl Future<Output = ()> + Send + 'static) -> Caller {
        Caller {
            identity,
            ended: Box::pin(ended),
        }
    }

    /// TEMPORARY: anyone, signed in until the connection closes: every welcomed connection is
    /// this caller until sign-in gives `Caller::new` the identity it checked, and the end of
    /// its sign-in (task 5).
    pub(crate) fn anyone() -> Caller {
        Caller::new((), std::future::pending())
    }
}

/// Serves a welcomed connection until the client closes it, the server stops, or the caller's
/// sign-in ends. A client that reads slowly waits here, in its own task, and holds nobody up.
pub(crate) async fn serve(shared: &Shared, socket: &mut WebSocket, caller: Caller) {
    let Caller {
        identity,
        mut ended,
    } = caller;
    let mut connection = Connection::open(shared, identity);
    loop {
        let message = tokio::select! {
            () = &mut ended => return,
            text = next(shared, socket) => match text {
                Some(text) => {
                    connection.read(&text);
                    continue;
                }
                None => return,
            },
            message = connection.next() => message,
        };
        let sent = tokio::select! {
            () = &mut ended => false,
            sent = send(socket, &message) => sent,
        };
        if !sent {
            return;
        }
    }
}
