//! Where a drawn file's links lead: a page of this server, another site, or nowhere.

use std::fmt::Write as _;

/// Where a file's links lead.
#[derive(Clone, Debug)]
pub struct Links {
    /// The folder of the file drawn, from the repository's top level, without a slash at either
    /// end: `specs/2026-10-06-recurring-tasks`. Its relative links start there.
    pub folder: String,
    /// The address the feature's pages start at, ending with a slash, `../` or `/f/x/`.
    /// A link to a markdown file is `<base>file/<path>`, to anything else
    /// `<base>raw/<key>/<path>`, `<path>` from the repository's top level.
    pub base: String,
    /// The key in the address of the feature's files: see [`crate::token::files_key`].
    pub key: String,
}

/// Where a link leads.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum Target {
    /// A page of this server, or an anchor in this page.
    Inside(String),
    /// Another site.
    Outside(String),
}

impl Links {
    /// The address of the link `target`, or `None` when it is shown as text alone.
    pub(super) fn href(&self, target: &str, image: bool) -> Option<Target> {
        let target = target.trim();
        if target.starts_with('#') {
            return Some(Target::Inside(target.to_owned()));
        }
        let lower = target.to_ascii_lowercase();
        if lower.starts_with("http://") || lower.starts_with("https://") {
            return Some(Target::Outside(target.to_owned()));
        }
        if lower.starts_with("mailto:") && !image {
            return Some(Target::Outside(target.to_owned()));
        }
        // Another scheme, a host's own path, or a path out of the repository.
        let path = uraeda_text::links::resolve(&self.folder, target)?;
        if path.is_empty() {
            return None;
        }
        let fragment = target
            .split_once('#')
            .map(|(_, fragment)| format!("#{fragment}"))
            .unwrap_or_default();
        let page = if !image && path.to_ascii_lowercase().ends_with(".md") {
            "file".to_string()
        } else {
            format!("raw/{}", self.key)
        };
        Some(Target::Inside(format!(
            "{}{page}/{}{fragment}",
            self.base,
            encode_path(&path)
        )))
    }
}

/// A path with what an address cannot hold as it is percent-encoded, its slashes kept.
fn encode_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for byte in path.bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~/!$&'()*+,;=:@".contains(&byte) {
            out.push(byte as char);
        } else {
            let _ = write!(out, "%{byte:02X}");
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{Links, Target};

    fn links() -> Links {
        Links {
            folder: "specs/f".into(),
            base: "/t/".into(),
            key: "k".into(),
        }
    }

    #[test]
    fn links_lead_inside_the_repository_or_nowhere() {
        let links = links();
        let inside = |href: &str| Some(Target::Inside(href.into()));
        assert_eq!(
            links.href("spec.md", false),
            inside("/t/file/specs/f/spec.md")
        );
        assert_eq!(
            links.href("../g/plan.md#tasks", false),
            inside("/t/file/specs/g/plan.md#tasks")
        );
        assert_eq!(links.href("/README.md", false), inside("/t/file/README.md"));
        assert_eq!(
            links.href("my%20shot.png", true),
            inside("/t/raw/k/specs/f/my%20shot.png")
        );
        assert_eq!(links.href("../../../x.md", false), None);
        assert_eq!(links.href("javascript:alert(1)", false), None);
        assert_eq!(links.href("//host/x", false), None);
    }
}
