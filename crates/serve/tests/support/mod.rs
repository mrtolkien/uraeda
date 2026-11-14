//! A `ura serve` on a free port of its own, for one test, with settings the test gives.

#![allow(dead_code, reason = "each test program uses part of the support")]

use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;

use uraeda_serve::{Settings, Shared, router, token};

pub struct Server {
    pub token: String,
    pub port: u16,
    _runtime: tokio::runtime::Runtime,
}

impl Server {
    /// A server with no repository.
    pub fn start() -> Server {
        Server::with(Settings::default())
    }

    pub fn with(settings: Settings) -> Server {
        Server::configured(
            settings,
            std::env::temp_dir().join("ura-serve-tests-no-config"),
        )
    }

    /// A server whose settings page writes `config_dir`'s file.
    pub fn configured(settings: Settings, config_dir: std::path::PathBuf) -> Server {
        let token = token::new();
        let shared = Arc::new(Shared::new(token.clone(), settings, config_dir));
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .unwrap();
        let listener = runtime
            .block_on(tokio::net::TcpListener::bind(SocketAddr::from((
                Ipv4Addr::LOCALHOST,
                0,
            ))))
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        runtime.spawn(async move { axum::serve(listener, router(shared)).await });
        Server {
            token,
            port,
            _runtime: runtime,
        }
    }

    pub fn host(&self) -> String {
        format!("127.0.0.1:{}", self.port)
    }

    pub fn url(&self, path: &str) -> String {
        format!("http://{}{path}", self.host())
    }

    fn agent() -> ureq::Agent {
        ureq::Agent::config_builder()
            .http_status_as_error(false)
            .build()
            .into()
    }

    pub fn get(&self, path: &str) -> ureq::http::Response<ureq::Body> {
        Server::agent().get(self.url(path)).call().unwrap()
    }

    /// A POST with `headers` and a JSON `body`.
    pub fn post(
        &self,
        path: &str,
        headers: &[(&str, &str)],
        body: &str,
    ) -> ureq::http::Response<ureq::Body> {
        let mut request = Server::agent()
            .post(self.url(path))
            .header("content-type", "application/json");
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        request.send(body).unwrap()
    }

    /// A POST from the page's own origin, as its script sends it.
    pub fn write(&self, path: &str, body: &str) -> ureq::http::Response<ureq::Body> {
        let origin = format!("http://{}", self.host());
        self.post(
            path,
            &[("origin", &origin), ("sec-fetch-site", "same-origin")],
            body,
        )
    }
}
pub mod repo;
