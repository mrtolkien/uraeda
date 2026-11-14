//! The page of the human's notes: where the vault is, how to change its place, and how to start
//! Obsidian on the phone.
//!
//! - `GET /{token}/vault`: the page.
//! - `POST /{token}/vault/place`: the form's new place, `path=...`, written in `[vault] path`.
//! - `GET /{token}/vault/start.zip`: the phone's starter vault, carrying the address the page was
//!   opened at, so the phone syncs through the same name, `tailscale serve`'s.

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{Html, IntoResponse, Redirect, Response};
use uraeda_vault::{Vault, config, plugin};

use crate::html::{escape, page};
use crate::{Shared, guard};

/// The address of `ura serve` as the request reached it, with the token: the scheme a proxy in
/// front says, else `http`.
fn address(shared: &Shared, headers: &HeaderMap) -> String {
    let text = |name: &str| headers.get(name).and_then(|v| v.to_str().ok());
    let scheme = text("x-forwarded-proto").unwrap_or("http");
    let host = text("host").unwrap_or("127.0.0.1");
    format!("{scheme}://{host}/{}/", shared.token)
}

/// Whether the request reached this machine's own name: a phone needs the tailnet's.
fn loopback(headers: &HeaderMap) -> bool {
    guard::allowed_host(headers, &[])
}

pub async fn page_route(State(shared): State<Arc<Shared>>, headers: HeaderMap) -> Html<String> {
    let Some(vault) = shared.vault() else {
        return Html(page(
            "Obsidian setup",
            "<main><nav class=\"crumbs\"><a href=\"./\">‹ What waits on you</a></nav>\
             <h1>Obsidian setup</h1><p>No vault is synced.</p></main>",
        ));
    };
    let warning = if loopback(&headers) {
        "<p class=\"error\">This page is open at this computer's own address. Open it on your \
         phone, through the address <code>tailscale serve</code> gives, so the starter vault \
         carries that address.</p>"
    } else {
        ""
    };
    let body = format!(
        "<main class=\"notes\"><nav class=\"crumbs\"><a href=\"./\">‹ What waits on you</a></nav>\
         <h1>Obsidian setup</h1>\
         <p>One vault for every repository, which Obsidian opens as it is: \
         <code>{path}</code>. On this computer, open it with Obsidian's “Open folder as vault”.</p>\
         <section><h2>On your phone</h2>{warning}<ol>\
         <li>Download the starter vault, then open it in Files: tap the zip once, and Files unpacks \
         a folder <b>{name}</b>.</li>\
         <li>Move that folder into <b>On My iPhone › Obsidian</b>.</li>\
         <li>In Obsidian, open the vault <b>{name}</b>, and tap <b>Trust author and enable \
         plugins</b>.</li>\
         <li>It syncs at once: your notes, the inbox, the proposals, and the specs in progress, \
         to read.</li></ol>\
         <p><a class=\"button primary\" href=\"vault/start.zip\" download>Download the starter vault\
         </a></p></section>\
         <section><h2>Its place</h2>\
         <form method=\"post\" action=\"vault/place\"><label>Folder <input name=\"path\" \
         value=\"{path}\" autocomplete=\"off\" spellcheck=\"false\"></label> \
         <button type=\"submit\">Save</button></form>\
         <p class=\"muted small\">ura moves nothing: move the folder yourself first, then save its \
         new place. Empty, it goes back to the default. Saved in <code>[vault] path</code> of the \
         settings file.</p></section></main>",
        path = escape(&vault.root().display().to_string()),
        name = escape(&vault.name()),
    );
    Html(page("Obsidian setup", &body))
}

pub async fn start_zip(State(shared): State<Arc<Shared>>, headers: HeaderMap) -> Response {
    let Some(vault) = shared.vault() else {
        return (StatusCode::NOT_FOUND, "No vault is synced.").into_response();
    };
    let url = address(&shared, &headers);
    let name = vault.name();
    match plugin::starter(&name, &url) {
        Ok(bytes) => (
            [
                (header::CONTENT_TYPE, "application/zip".to_string()),
                (
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{name}.zip\""),
                ),
                (header::CACHE_CONTROL, "no-store".to_string()),
            ],
            bytes,
        )
            .into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "The zip failed.").into_response(),
    }
}

pub async fn save_place(State(shared): State<Arc<Shared>>, body: Bytes) -> Response {
    let path = form_value(&body, "path").unwrap_or_default();
    let held = Arc::clone(&shared);
    let saved = tokio::task::spawn_blocking(move || {
        let _write = held
            .writes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let path = path.trim();
        config::set_path(&held.config_dir, (!path.is_empty()).then_some(path))
            .map_err(|e| e.to_string())?;
        let folder = match held.data_dir.as_deref() {
            Some(data_dir) => {
                config::path(&held.config_dir, data_dir).map_err(|e| e.to_string())?
            }
            None => std::path::PathBuf::from(path),
        };
        held.set_vault(Vault::new(folder));
        Ok::<(), String>(())
    })
    .await;
    match saved {
        Ok(Ok(())) => Redirect::to("../vault").into_response(),
        Ok(Err(message)) => (StatusCode::UNPROCESSABLE_ENTITY, message).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "The place was not saved.",
        )
            .into_response(),
    }
}

/// A field of a form's body, `application/x-www-form-urlencoded`.
fn form_value(body: &[u8], name: &str) -> Option<String> {
    let text = std::str::from_utf8(body).ok()?;
    text.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        (decode(key)? == name).then(|| decode(value)).flatten()
    })
}

fn decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => out.push(b' '),
            b'%' => {
                let hex = text.get(i + 1..i + 3)?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                i += 2;
            }
            b => out.push(b),
        }
        i += 1;
    }
    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_form() {
        assert_eq!(
            form_value(b"x=1&path=%7E%2FNotes+Two%2FU", "path").as_deref(),
            Some("~/Notes Two/U")
        );
        assert_eq!(form_value(b"path=%zz", "path"), None);
    }
}
