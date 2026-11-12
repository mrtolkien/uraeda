//! A client of the protocol, over a real WebSocket.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use uraeda_protocol::{ClientMessage, PROTOCOL, ServerMessage, SignIn, unpack};

/// How long a test waits for a message before it fails: a server that answers does so at once.
const PATIENCE: Duration = Duration::from_secs(10);

/// One connection to `/live`.
pub struct TestClient {
    socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
    sign_in: SignIn,
    epoch: Option<String>,
    time_zone: Option<String>,
    /// What the test waits for, said when nothing comes.
    waiting_for: String,
    /// Whether the last message came in a binary frame, its large part compressed.
    packed: bool,
}

impl TestClient {
    /// Opens a connection to the server on `port`, with a browser's cookie if any, and says
    /// nothing.
    pub(super) async fn open(port: u16, cookie: Option<&str>) -> TestClient {
        let mut request = format!("ws://127.0.0.1:{port}/live")
            .into_client_request()
            .expect("a WebSocket's request");
        if let Some(cookie) = cookie {
            let cookie = cookie.parse().expect("a cookie");
            request.headers_mut().insert("cookie", cookie);
        }
        let (socket, _) = tokio_tungstenite::connect_async(request)
            .await
            .expect("the WebSocket opens");
        TestClient {
            socket,
            sign_in: SignIn::Cookie,
            epoch: None,
            time_zone: None,
            waiting_for: String::new(),
            packed: false,
        }
    }

    /// Opens a connection to any server on `port`, with no cookie, and says nothing: a server
    /// without sign-in, as the sandbox's, welcomes it.
    pub async fn unsigned(port: u16) -> TestClient {
        TestClient::open(port, None).await
    }

    /// How this client's `hello` signs in: with the cookie of its request, until a test gives a
    /// device's token.
    pub fn sign_in(&mut self, sign_in: SignIn) {
        self.sign_in = sign_in;
    }

    /// Says `hello` at the server's version, and gives the server's answer.
    pub async fn say_hello(&mut self) -> ServerMessage {
        self.send(&ClientMessage::Hello {
            protocol: PROTOCOL,
            sign_in: self.sign_in.clone(),
        })
        .await;
        self.next().await
    }

    /// Says `hello` at the server's version, and expects its `welcome`.
    pub async fn hello(&mut self) {
        match self.say_hello().await {
            ServerMessage::Welcome {
                epoch, time_zone, ..
            } => {
                self.epoch = Some(epoch);
                self.time_zone = Some(time_zone);
            }
            other => panic!("expected a welcome, got {other:?}"),
        }
    }

    /// The epoch of the `welcome` this connection got.
    pub fn epoch(&self) -> &str {
        self.epoch.as_deref().expect("a welcomed connection")
    }

    /// The server's time zone, as the `welcome` this connection got named it.
    pub fn time_zone(&self) -> &str {
        self.time_zone.as_deref().expect("a welcomed connection")
    }

    /// Sends a message.
    pub async fn send(&mut self, message: &ClientMessage) {
        self.send_text(&serde_json::to_string(message).unwrap())
            .await;
    }

    /// Whether the last message [`TestClient::next`] gave came in a binary frame, its large part
    /// compressed, as the contract's "Frames" says.
    pub fn was_packed(&self) -> bool {
        self.packed
    }

    /// Sends a binary frame, which no client sends.
    pub async fn send_binary(&mut self, bytes: &[u8]) {
        self.socket
            .send(Message::binary(bytes.to_vec()))
            .await
            .expect("the message is sent");
    }

    /// Sends a text frame as it is, as a client of another version would.
    pub async fn send_text(&mut self, text: &str) {
        self.socket
            .send(Message::text(text))
            .await
            .expect("the message is sent");
    }

    /// The server's next message. Fails when the connection closes first, or nothing comes.
    pub async fn next(&mut self) -> ServerMessage {
        self.next_for("").await
    }

    /// [`TestClient::next`], naming what the test waits for when nothing comes.
    pub async fn next_for(&mut self, what: &str) -> ServerMessage {
        self.waiting_for = what.to_owned();
        match self.frame().await {
            Some(text) => serde_json::from_str(&text)
                .unwrap_or_else(|error| panic!("not a server message: {text}: {error}")),
            None => panic!("the connection closed before a message"),
        }
    }

    /// Waits for the server to close the connection. Fails when a message comes first.
    pub async fn closed(&mut self) {
        if let Some(text) = self.frame().await {
            panic!("expected the connection to close, got {text}");
        }
    }

    /// The next message's text, a binary frame's unpacked, or none once the connection is
    /// closed.
    async fn frame(&mut self) -> Option<String> {
        loop {
            let next = tokio::time::timeout(PATIENCE, self.socket.next()).await;
            let next = next.unwrap_or_else(|_| match self.waiting_for.as_str() {
                "" => panic!("the server did not answer"),
                what => panic!("the server did not answer: waiting for {what}"),
            });
            match next {
                Some(Ok(Message::Text(text))) => {
                    self.packed = false;
                    return Some(text.to_string());
                }
                Some(Ok(Message::Binary(bytes))) => {
                    self.packed = true;
                    let text = unpack(&bytes).unwrap_or_else(|refused| {
                        panic!("a binary frame the client cannot read: {refused:?}")
                    });
                    return Some(text);
                }
                Some(Ok(Message::Close(_)) | Err(_)) | None => return None,
                Some(Ok(_)) => {}
            }
        }
    }
}
