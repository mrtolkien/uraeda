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
        Server::serving(settings, config_dir, Vec::new())
    }

    /// A server whose settings page offers `agents`, never asking the real ones.
    pub fn serving(
        settings: Settings,
        config_dir: std::path::PathBuf,
        agents: Vec<uraeda_serve::providers::Provider>,
    ) -> Server {
        let token = token::new();
        let shared = Shared::new(token.clone(), settings, config_dir).with_agents(agents);
        Server::of(token, shared)
    }

    /// A server that syncs `vault` with the phone.
    pub fn syncing(settings: Settings, vault: uraeda_vault::Vault) -> Server {
        let config_dir = std::env::temp_dir().join("ura-serve-tests-no-config");
        Server::syncing_in(settings, vault, config_dir)
    }

    /// A server that syncs `vault`, its settings kept in `config_dir`.
    pub fn syncing_in(
        settings: Settings,
        vault: uraeda_vault::Vault,
        config_dir: std::path::PathBuf,
    ) -> Server {
        let token = token::new();
        let shared = Shared::new(token.clone(), settings, config_dir)
            .with_agents(Vec::new())
            .with_vault(vault);
        Server::of(token, shared)
    }

    fn of(token: String, shared: Shared) -> Server {
        let shared = Arc::new(shared);
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

    /// A request as the phone's plugin sends it: no `Origin`, and the token as a bearer.
    pub fn plugin(&self, method: &str, path: &str, body: &[u8]) -> (u16, Vec<u8>) {
        let request = ureq::http::Request::builder()
            .method(method)
            .uri(self.url(path))
            .header("authorization", format!("Bearer {}", self.token))
            .body(body.to_vec())
            .unwrap();
        let mut response = Server::agent().run(request).unwrap();
        let status = response.status().as_u16();
        (status, response.body_mut().read_to_vec().unwrap())
    }

    fn agent() -> ureq::Agent {
        ureq::Agent::config_builder()
            .http_status_as_error(false)
            .max_redirects(0)
            .build()
            .into()
    }

    /// What a signed-in browser's cookie holds.
    pub fn cookie(&self) -> String {
        format!("ura_session={}", token::session(&self.token))
    }

    /// The key in the address of a feature's raw files.
    pub fn key(&self) -> String {
        token::files_key(&self.token)
    }

    /// A GET from a signed-in browser.
    pub fn get(&self, path: &str) -> ureq::http::Response<ureq::Body> {
        Server::agent()
            .get(self.url(path))
            .header("cookie", self.cookie())
            .call()
            .unwrap()
    }

    /// A GET with `headers` alone, from a browser that never signed in.
    pub fn stranger(
        &self,
        path: &str,
        headers: &[(&str, &str)],
    ) -> ureq::http::Response<ureq::Body> {
        let mut request = Server::agent().get(self.url(path));
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        request.call().unwrap()
    }

    /// A POST from a signed-in browser, with `headers` and a JSON `body`.
    pub fn post(
        &self,
        path: &str,
        headers: &[(&str, &str)],
        body: &str,
    ) -> ureq::http::Response<ureq::Body> {
        let mut request = Server::agent()
            .post(self.url(path))
            .header("cookie", self.cookie())
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
