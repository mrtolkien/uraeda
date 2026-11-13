//! Which extension pages the app runs: one signed under the key of the server it is signed in to,
//! for its own extension, and no older than a build of it the app ran. One home for that rule,
//! which both ways a page runs follow: the Linux view (`extension_view/fetch.rs`), which fetches
//! the page in Rust, and a browser's frame (`app/extensions/host.web.tsx`), which fetches it with
//! the session's cookie and hands its bytes to [`PageTrust::verify_page`].
//!
//! The trust lives in memory, one per server, for the process's life, or the browser page's: a
//! server whose key changed starts a new one, so its builds, numbered from 1 again, are not
//! refused as older.

use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use nsh_core::prelude::*;
use nsh_package::{PublicKey, TrustStore, VerifiedPackage};

/// The trust kept for each server, by its address: the key it gave, and the builds run.
static TRUST: Mutex<Option<HashMap<String, Trust>>> = Mutex::new(None);

struct Trust {
    key: String,
    store: TrustStore,
}

/// Verifies `bytes` as the page of `name`, under the key `key` the server at `server` gave, and
/// records its build: an older one is refused from then on. `bytecode_version` is the engine's
/// that will run it, which keeps its bytecode: a browser runs the source, and gives none. The
/// error says why, in words.
pub(crate) fn verified(
    server: &str,
    key: &str,
    name: &str,
    bytes: &[u8],
    bytecode_version: &str,
) -> Result<VerifiedPackage, String> {
    let mut all = TRUST.lock().unwrap_or_else(PoisonError::into_inner);
    let all = all.get_or_insert_with(HashMap::new);
    if all.get(server).is_none_or(|trust| trust.key != key) {
        let root =
            PublicKey::from_base64(key).map_err(|error| format!("the server's key: {error}"))?;
        let mut store = TrustStore::new();
        store.add_root(root);
        let trust = Trust {
            key: key.to_owned(),
            store,
        };
        all.insert(server.to_owned(), trust);
    }
    let store = &mut all
        .get_mut(server)
        .expect("the server's trust, made above")
        .store;
    let package = store
        .verify(bytes, bytecode_version)
        .map_err(|error| error.to_string())?;
    let expected = format!("dev.uraeda.extension.{name}");
    if package.app.id != expected {
        let id = &package.app.id;
        return Err(format!("the page is {id}'s, not {expected}'s"));
    }
    store.accept(&package).map_err(|error| error.to_string())?;
    Ok(package)
}

/// A page verified, as a browser's frame runs it.
#[derive(JsObject)]
pub(crate) struct VerifiedPage {
    /// The page's code, one module.
    pub source: String,
    /// What it may call of its host, as the package grants it: `{ "host": [...] }`, in JSON.
    pub capabilities: String,
    /// The package's build, the page's version.
    pub build: f64,
}

/// The pages a browser runs: verified here, in the app's WebAssembly, by the rule the Linux view
/// follows.
#[module]
pub(crate) struct PageTrust;

#[module(flat)]
impl PageTrust {
    /// Verifies the bytes of the page of the extension `name`, as `GET /extensions/{name}/page`
    /// answered them, under `key`, what `GET /extensions/key` of the server at `server` answered:
    /// its code and rights, or why it is refused.
    pub(crate) fn verify_page(
        server: String,
        key: String,
        name: String,
        bytes: Vec<u8>,
    ) -> Result<VerifiedPage, String> {
        let package = verified(&server, key.trim(), &name, &bytes, "")?;
        let capabilities = package
            .capabilities
            .as_ref()
            .map_or_else(|| "{}".to_owned(), ToString::to_string);
        #[allow(clippy::cast_precision_loss, reason = "a build counts saves")]
        let build = package.app.build as f64;
        Ok(VerifiedPage {
            source: package.source,
            capabilities,
            build,
        })
    }
}
