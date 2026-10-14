//! Where a link of a workflow file points, from the repository's top level.

use std::path::{Path, PathBuf};

/// A link's file, from the top level, relative to the folder `dir` holding the linking file.
/// `None` for an anchor in the page, a URI with a scheme (`https:`, `data:`, `mailto:`), or a
/// protocol-relative URL (`//host/x`). A `?query` is left out, and a percent-encoded path is
/// decoded: `my%20shot.webp`.
pub fn resolve(dir: &str, target: &str) -> Option<String> {
    let path = target.split('#').next()?.split('?').next()?;
    if path.is_empty() || has_scheme(path) || path.starts_with("//") {
        return None;
    }
    let path = percent_decode(path);
    let joined = match path.strip_prefix('/') {
        Some(rooted) => PathBuf::from(rooted),
        None => Path::new(dir).join(path),
    };
    let mut parts: Vec<String> = Vec::new();
    for part in joined.components() {
        match part {
            std::path::Component::ParentDir => {
                parts.pop()?;
            }
            std::path::Component::Normal(name) => parts.push(name.to_str()?.to_string()),
            _ => {}
        }
    }
    Some(parts.join("/"))
}

/// Whether a target starts with a URI scheme, `[A-Za-z][A-Za-z0-9+.-]*:`.
fn has_scheme(target: &str) -> bool {
    let Some((scheme, _)) = target.split_once(':') else {
        return false;
    };
    let mut chars = scheme.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
}

/// A path with its `%XX` sequences decoded as UTF-8. A `%` not followed by two hexadecimal digits
/// stays as it is, and so does the whole path when the decoded bytes are not UTF-8.
fn percent_decode(path: &str) -> String {
    if !path.contains('%') {
        return path.to_string();
    }
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = bytes
            .get(i + 1..i + 3)
            .and_then(|pair| std::str::from_utf8(pair).ok())
            .filter(|_| bytes[i] == b'%')
            .and_then(|pair| u8::from_str_radix(pair, 16).ok());
        match hex {
            Some(byte) => {
                decoded.push(byte);
                i += 3;
            }
            None => {
                decoded.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8(decoded).unwrap_or_else(|_| path.to_string())
}
