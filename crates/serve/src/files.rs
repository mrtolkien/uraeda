//! The files a page links to, from the feature's checkout: a markdown file drawn as a page to read,
//! and any other file as it is, a mockup or an image.
//!
//! - `GET /{token}/{repo}/{folder}/file/{*path}`: a markdown file of the repository, drawn.
//! - `GET /{token}/{repo}/{folder}/raw/{*path}`: a file as it is. An HTML file is served in a
//!   sandbox of its own, an opaque origin that can run its scripts but never write through the
//!   pages (its writes carry `Origin: null`), with the element picker added at its end.
//!
//! A path is from the repository's top level, and must stay inside the checkout, out of its
//! hidden folders and files: `.git/config` may hold a remote's credentials.

use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use axum::extract::{Path as Address, State};
use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse, Response};

use crate::round::routes::{Failure, on};
use crate::{Shared, html, waiting};

/// The element picker, posted to the page that frames a mockup: see its own header.
pub const PICKER: &str = include_str!("../../../skills/uraeda/assets/storybook/uraeda-pick.js");

/// The address of a feature's file: the token, the repository, the folder, and the file's path.
pub type File = Address<(String, String, String, String)>;

/// `path` inside `root`, refused when it leaves it or reaches a hidden file, by `..` or a link.
fn inside(root: &Path, path: &str) -> Result<PathBuf, Failure> {
    let missing = || Failure(StatusCode::NOT_FOUND, "This file does not exist.".into());
    let relative = Path::new(path);
    if relative
        .components()
        .any(|c| !matches!(c, Component::Normal(name) if !name.to_string_lossy().starts_with('.')))
    {
        return Err(missing());
    }
    let root = root.canonicalize().map_err(|_| missing())?;
    let full = root.join(relative).canonicalize().map_err(|_| missing())?;
    // A link is followed: what it leads to is held to the same rules.
    let hidden = |inner: &Path| {
        inner
            .components()
            .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
    };
    if !full.strip_prefix(&root).is_ok_and(|inner| !hidden(inner)) || !full.is_file() {
        return Err(missing());
    }
    Ok(full)
}

/// The path back from a page at `file/<path>` to the feature's folder of pages.
fn back(path: &str) -> String {
    "../".repeat(path.matches('/').count() + 1)
}

/// `GET .../file/{*path}`.
pub async fn page(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder, path)): File,
) -> Response {
    let base = back(&path);
    let home = format!("{base}../../");
    let drawn = on(&shared, repo, folder, {
        let base = base.clone();
        let home = home.clone();
        move |located| {
            let full = inside(&located.root, &path)?;
            if full.extension().and_then(|e| e.to_str()) != Some("md") {
                return Err(Failure(
                    StatusCode::NOT_FOUND,
                    "This file does not exist.".into(),
                ));
            }
            let text = std::fs::read_to_string(&full)
                .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            let name = waiting::readable(&located.feature.slug);
            let main = format!(
                "<main class=\"file\"><nav class=\"crumbs\"><a href=\"{home}\">‹ What waits on \
                 you</a></nav><p class=\"muted subtitle\">{name}</p><article class=\"doc\">{doc}\
                 </article></main>",
                home = html::escape(&home),
                name = html::escape(&name),
                doc = crate::render::draw(&text, &path, &base),
            );
            let title = text
                .lines()
                .find_map(|l| l.strip_prefix("# "))
                .unwrap_or(&path)
                .to_string();
            Ok(html::page_at(&home, &title, &main))
        }
    })
    .await;
    match drawn {
        Ok(page) => Html(page).into_response(),
        Err(failure) => failure.page(&home),
    }
}

/// `GET .../raw/{*path}`.
pub async fn raw(
    State(shared): State<Arc<Shared>>,
    Address((_, repo, folder, path)): File,
) -> Response {
    let read = on(&shared, repo, folder, move |located| {
        let full = inside(&located.root, &path)?;
        let bytes = std::fs::read(&full)
            .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        Ok((full, bytes))
    })
    .await;
    let (full, bytes) = match read {
        Ok(read) => read,
        Err(failure) => return (failure.0, failure.1).into_response(),
    };
    let extension = full
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "html" || extension == "htm" {
        let text = String::from_utf8_lossy(&bytes);
        let script = format!(
            "<script>{}</script>",
            PICKER.replace("</script", "<\\/script")
        );
        let page = match text.rfind("</body>") {
            Some(at) => format!("{}{script}{}", &text[..at], &text[at..]),
            None => format!("{text}{script}"),
        };
        return (
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8"),
                (
                    header::CONTENT_SECURITY_POLICY,
                    "sandbox allow-scripts allow-forms allow-popups allow-modals",
                ),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            page,
        )
            .into_response();
    }
    let kind = match extension.as_str() {
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json",
        "pdf" => "application/pdf",
        _ => "text/plain; charset=utf-8",
    };
    let mut response = (
        [
            (header::CONTENT_TYPE, kind),
            (header::CACHE_CONTROL, "no-cache"),
        ],
        bytes,
    )
        .into_response();
    if kind == "image/svg+xml" {
        // An SVG opened alone runs no script of its own.
        response.headers_mut().insert(
            header::CONTENT_SECURITY_POLICY,
            header::HeaderValue::from_static("sandbox"),
        );
    }
    response
}
