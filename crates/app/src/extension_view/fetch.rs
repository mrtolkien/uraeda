//! An extension's page, fetched whole from the server the app is signed in to, and verified under
//! the key that server gives, by the rule of `page_trust.rs`: a page runs only when it is signed
//! under that key, for its extension, and is no older than a build of it the app ran.

use std::io::Read as _;
use std::time::Duration;

use nsh_engine::BYTECODE_VERSION;
use nsh_engine::package::VerifiedPackage;

/// How long a request has, from its start to the last byte of its answer.
const TIMEOUT: Duration = Duration::from_secs(30);

/// The largest page taken: the component library and the page API are built into each one.
const LARGEST: u64 = 32 << 20;

/// Where the page comes from: the server's address, `http://127.0.0.1:4320`, and the device's
/// token, sent as `Authorization: Bearer`. The token stays here: the page never sees it.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(super) struct Source {
    pub server: String,
    pub token: Option<String>,
}

/// Why a page could not be had.
#[derive(Debug)]
pub(super) enum Refused {
    /// The server did not answer, or not with a page.
    Unreachable(String),
    /// The page is not signed under the server's key, or is older than one the app ran.
    Untrusted(String),
}

/// Fetches the page of the extension `name`, and verifies it: the key first, then the page.
/// It blocks: the caller runs it off the main thread.
pub(super) fn page(source: &Source, name: &str) -> Result<VerifiedPackage, Refused> {
    let key = get(source, "/extensions/key")?;
    let key = String::from_utf8(key).map_err(|_| unreachable("the key is no text"))?;
    let bytes = get(source, &format!("/extensions/{name}/page"))?;
    crate::page_trust::verified(&source.server, key.trim(), name, &bytes, BYTECODE_VERSION)
        .map_err(Refused::Untrusted)
}

/// The body of a signed-in `GET` of `path`, answered 200.
fn get(source: &Source, path: &str) -> Result<Vec<u8>, Refused> {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(TIMEOUT))
        .http_status_as_error(false)
        .build();
    let agent = ureq::Agent::new_with_config(config);
    let url = format!("{}{path}", source.server.trim_end_matches('/'));
    let mut request = agent.get(&url);
    if let Some(token) = &source.token {
        request = request.header("Authorization", &format!("Bearer {token}"));
    }
    let mut answer = request
        .call()
        .map_err(|error| unreachable(&format!("{url}: {error}")))?;
    let status = answer.status().as_u16();
    let mut body = Vec::new();
    let read = answer
        .body_mut()
        .as_reader()
        .take(LARGEST)
        .read_to_end(&mut body);
    read.map_err(|error| unreachable(&format!("{url}: {error}")))?;
    if status != 200 {
        let said = String::from_utf8_lossy(&body);
        return Err(unreachable(&format!(
            "{path} answered {status}: {}",
            said.trim()
        )));
    }
    Ok(body)
}

fn unreachable(message: &str) -> Refused {
    Refused::Unreachable(message.to_owned())
}
