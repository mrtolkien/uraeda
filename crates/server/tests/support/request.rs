//! Plain HTTP requests to a test's server, with every header as the test gives it.

use http_body_util::{BodyExt, Full};
use hyper::body::Bytes;
use hyper::header::{CONTENT_TYPE, HOST, HeaderMap, HeaderName, HeaderValue};
use hyper::{Method, Request};
use hyper_util::rt::TokioIo;
use serde_json::Value;
use tokio::net::TcpStream;

/// A request to send. Its `Host` is the server's own until the test gives another.
pub struct TestRequest {
    port: u16,
    method: Method,
    path: String,
    headers: HeaderMap,
    body: Vec<u8>,
}

impl TestRequest {
    pub(super) fn new(port: u16, method: &str, path: &str) -> TestRequest {
        let mut headers = HeaderMap::new();
        let host = format!("127.0.0.1:{port}");
        headers.insert(HOST, HeaderValue::from_str(&host).unwrap());
        TestRequest {
            port,
            method: method.parse().expect("an HTTP method"),
            path: path.to_owned(),
            headers,
            body: Vec::new(),
        }
    }

    /// Sets a header, replacing the one of that name.
    pub fn header(mut self, name: &str, value: &str) -> Self {
        let name: HeaderName = name.parse().expect("a header name");
        self.headers
            .insert(name, HeaderValue::from_str(value).expect("a header value"));
        self
    }

    /// Sets `Authorization: Bearer <token>`.
    pub fn bearer(self, token: &str) -> Self {
        self.header("authorization", &format!("Bearer {token}"))
    }

    /// Sets the `Cookie` header, as a browser sends the cookie it was set: `name=value`.
    pub fn cookie(self, cookie: &str) -> Self {
        self.header("cookie", cookie)
    }

    /// Sets the body to a JSON value.
    pub fn json(mut self, value: &Value) -> Self {
        self.headers
            .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        self.body = serde_json::to_vec(value).unwrap();
        self
    }

    /// Sets the body to bytes, as an upload's.
    pub fn body(mut self, bytes: impl Into<Vec<u8>>) -> Self {
        self.body = bytes.into();
        self
    }

    /// Sends the request, and reads the whole answer.
    pub async fn send(self) -> TestResponse {
        let stream = TcpStream::connect(("127.0.0.1", self.port))
            .await
            .expect("the server accepts a connection");
        let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(stream))
            .await
            .expect("an HTTP connection");
        tokio::spawn(connection);
        let mut request = Request::builder().method(self.method).uri(self.path);
        *request.headers_mut().expect("a valid request") = self.headers;
        let request = request.body(Full::new(Bytes::from(self.body))).unwrap();
        let response = sender.send_request(request).await.expect("an answer");
        let (parts, body) = response.into_parts();
        let body = body.collect().await.expect("the answer's body").to_bytes();
        TestResponse {
            status: parts.status.as_u16(),
            headers: parts.headers,
            body: body.to_vec(),
        }
    }
}

/// An answer, read whole.
#[derive(Debug)]
pub struct TestResponse {
    pub status: u16,
    pub headers: HeaderMap,
    pub body: Vec<u8>,
}

impl TestResponse {
    /// The body as text.
    pub fn text(&self) -> String {
        String::from_utf8(self.body.clone()).expect("a text body")
    }

    /// The body as JSON.
    pub fn json(&self) -> Value {
        serde_json::from_slice(&self.body)
            .unwrap_or_else(|error| panic!("not JSON: {}: {error}", self.text()))
    }

    /// A header's value, or none.
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name)?.to_str().ok()
    }

    /// The cookie the answer sets, as a browser sends it back, `name=value`: none when it sets
    /// none.
    pub fn cookie(&self) -> Option<String> {
        let set = self.header("set-cookie")?;
        Some(set.split(';').next()?.to_owned())
    }
}
