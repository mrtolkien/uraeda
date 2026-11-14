//! The small pieces of HTML a drawn file is made of: an attribute, a callout's name, an image's
//! closing, and what a raw HTML event holds.

use pulldown_cmark::BlockQuoteKind;

use crate::html::escape;

pub(super) fn title_attribute(title: &str) -> String {
    if title.is_empty() {
        String::new()
    } else {
        format!(" title=\"{}\"", escape(title))
    }
}

/// A callout's class and title.
pub(super) fn callout(kind: BlockQuoteKind) -> (&'static str, &'static str) {
    match kind {
        BlockQuoteKind::Note => ("note", "Note"),
        BlockQuoteKind::Tip => ("tip", "Tip"),
        BlockQuoteKind::Important => ("important", "Important"),
        BlockQuoteKind::Warning => ("warning", "Warning"),
        BlockQuoteKind::Caution => ("caution", "Caution"),
    }
}

/// Whether some HTML is only comments and blank space.
pub(super) fn is_comment(html: &str) -> bool {
    let mut rest = html.trim();
    if rest.is_empty() {
        return false;
    }
    while !rest.is_empty() {
        let Some(after) = rest.strip_prefix("<!--") else {
            return false;
        };
        let Some(end) = after.find("-->") else {
            // A comment that goes on in the next event.
            return true;
        };
        rest = after[end + 3..].trim_start();
    }
    true
}

/// The text of escaped HTML, for a heading's slug.
pub(super) fn unescape(html: &str) -> String {
    html.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

/// An image's tag from `image_tag`, closed with its alt text.
pub(super) fn closed_image(tag: &str, alt: &str) -> String {
    if tag.is_empty() {
        escape(alt)
    } else if tag.starts_with("<a ") {
        let text = Some(alt.trim())
            .filter(|t| !t.is_empty())
            .unwrap_or("Image");
        format!("{tag}>{}</a>", escape(text))
    } else {
        format!("{tag} alt=\"{}\">", escape(alt))
    }
}

#[cfg(test)]
mod tests {
    use super::is_comment;

    #[test]
    fn a_comment_is_known_from_other_html() {
        assert!(is_comment("<!-- a -->"));
        assert!(is_comment("<!-- a --> <!-- b -->\n"));
        assert!(is_comment("<!-- opened"));
        assert!(!is_comment("<b>x</b>"));
        assert!(!is_comment("<!-- a --> <b>"));
    }
}
