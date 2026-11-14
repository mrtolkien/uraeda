//! A Mermaid diagram as inline SVG, drawn on the server once per source.
//!
//! No font is read: the pages draw in the reader's system fonts, which the server cannot know, so
//! Merman measures labels with its deterministic widths, close to a common sans-serif. Labels are
//! SVG text, which the page's font draws and a reader can select. The colours are Mermaid's
//! `neutral` theme, greys on no background, which the style sheet turns over in a dark theme.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use merman::svg::{SvgPipeline, SvgRenderOptions};
use merman::{
    Engine, MermaidConfig, OperationControl, RenderOutput, RenderRequest, Renderer, SvgEnvironment,
    SvgRequest,
};
use sha2::{Digest, Sha256};

/// How long a diagram may take: a hostile source stops there, and shows as its source.
const PATIENCE: Duration = Duration::from_secs(2);

/// How many drawings the process keeps. Past it, the cache starts again: a repository's diagrams
/// are far fewer.
const KEPT: usize = 512;

/// A drawing, or why there is none. Failures are kept too: a source that timed out once would
/// cost its 2 s at every page.
type Drawn = Result<Arc<str>, Arc<str>>;

/// The SVG of the Mermaid `source`, from the process's cache when it was drawn before.
pub fn draw(source: &str) -> Drawn {
    static CACHE: OnceLock<Mutex<HashMap<[u8; 32], Drawn>>> = OnceLock::new();
    let key: [u8; 32] = Sha256::digest(source.as_bytes()).into();
    let cache = CACHE.get_or_init(Mutex::default);
    if let Some(drawn) = cache.lock().ok().and_then(|cache| cache.get(&key).cloned()) {
        return drawn;
    }
    // Drawn outside the lock: another page's diagram does not wait on this one.
    let drawn = svg(source, &id(&key)).map(Arc::from).map_err(Arc::from);
    if let Ok(mut cache) = cache.lock() {
        if cache.len() >= KEPT {
            cache.clear();
        }
        cache.insert(key, drawn.clone());
    }
    drawn
}

/// The diagram's id, from its source's hash: its styles are scoped to it, so two diagrams of a
/// page never share one unless they are the same.
fn id(key: &[u8; 32]) -> String {
    let mut id = String::from("diagram-");
    for byte in &key[..6] {
        id.push_str(&format!("{byte:02x}"));
    }
    id
}

fn svg(source: &str, id: &str) -> Result<String, String> {
    // The server's settings stay outside the source: a diagram cannot name another theme.
    let config = MermaidConfig::from_value(serde_json::json!({
        "theme": "neutral",
        "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, Roboto, sans-serif",
    }));
    let request = SvgRequest {
        environment: SvgEnvironment::deterministic(),
        // Labels as SVG text, not HTML in a `foreignObject`.
        pipeline: Some(SvgPipeline::resvg_safe()),
        options: SvgRenderOptions {
            diagram_id: Some(id.to_owned()),
            ..SvgRenderOptions::default()
        },
        ..SvgRequest::default()
    };
    let control = OperationControl::new().with_deadline(PATIENCE);
    let source = without_markup(source);
    let output = Renderer::new()
        .with_engine(Engine::new().with_site_config(config))
        .render(RenderRequest::svg(&source, control, request))
        .map_err(|error| error.to_string())?;
    let RenderOutput::Svg(Some(svg)) = output else {
        return Err("not a Mermaid diagram".to_owned());
    };
    let svg = svg.svg();
    if !safe(svg) {
        return Err("the drawing holds a script or a link".to_owned());
    }
    Ok(with_width(svg))
}

/// `svg` with its natural width as `--width` too, the style sheet's floor before it scrolls: a
/// wide diagram shrunk to a phone's width has text too small to read.
fn with_width(svg: &str) -> String {
    let root = &svg[..svg.find('>').unwrap_or(0)];
    let width = root
        .split_once("max-width:")
        .and_then(|(_, rest)| rest.split_once("px"))
        .map(|(width, _)| width.trim())
        .filter(|width| width.parse::<f64>().is_ok());
    match width {
        Some(width) => svg.replacen(
            "style=\"max-width:",
            &format!("style=\"--width:{width}px;max-width:"),
            1,
        ),
        None => svg.to_owned(),
    }
}

/// Whether an SVG is safe to put in a page as it is: no script, no HTML, no handler, and no
/// link or style address but to its own parts (`href="#…"`, `url(#…)`).
fn safe(svg: &str) -> bool {
    let lower = svg.to_ascii_lowercase();
    // A style fetches nothing: every `url(` names a part of the drawing.
    let styles_fetch = lower.contains("@import")
        || lower.match_indices("url(").any(|(index, _)| {
            !lower[index + 4..]
                .trim_start_matches(['"', '\'', ' '])
                .starts_with('#')
        });
    !styles_fetch
        && lower.split('<').skip(1).all(|tag| {
            let tag = tag.split('>').next().unwrap_or("");
            let name_end = tag
                .find(|c: char| c.is_ascii_whitespace() || c == '/')
                .unwrap_or(tag.len());
            let name = &tag[..name_end];
            if matches!(
                name,
                "script" | "foreignobject" | "iframe" | "object" | "embed" | "image"
            ) {
                return false;
            }
            attributes(&tag[name_end..]).all(|(attribute, value)| {
                let link = attribute == "href" || attribute.ends_with(":href");
                !attribute.starts_with("on")
                    && !value.contains("javascript:")
                    && (!link || value.starts_with('#'))
            })
        })
}

/// The attributes of a tag after its name, as names and values.
fn attributes(mut rest: &str) -> impl Iterator<Item = (&str, &str)> {
    std::iter::from_fn(move || {
        rest = rest.trim_start_matches(|c: char| c.is_ascii_whitespace() || c == '/');
        if rest.is_empty() {
            return None;
        }
        let name_end = rest
            .find(|c: char| c.is_ascii_whitespace() || c == '=' || c == '/')
            .unwrap_or(rest.len());
        let name = &rest[..name_end];
        rest = rest[name_end..].trim_start();
        let Some(after) = rest.strip_prefix('=') else {
            return Some((name, ""));
        };
        let after = after.trim_start();
        let value;
        match after.chars().next() {
            Some(quote @ ('"' | '\'')) => {
                let body = &after[1..];
                let end = body.find(quote).unwrap_or(body.len());
                value = &body[..end];
                rest = body.get(end + 1..).unwrap_or("");
            }
            _ => {
                let end = after
                    .find(|c: char| c.is_ascii_whitespace())
                    .unwrap_or(after.len());
                value = &after[..end];
                rest = &after[end..];
            }
        }
        Some((name, value))
    })
}

/// `source` with the angle brackets of its quoted labels as entities, but for a line break's.
/// Merman reads a label as HTML: one that names `<name>` lost every label of its diagram.
fn without_markup(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut quoted = false;
    let mut rest = source;
    while let Some(character) = rest.chars().next() {
        let after = &rest[character.len_utf8()..];
        match character {
            '"' => quoted = !quoted,
            '\n' => quoted = false,
            '<' if quoted && !after.starts_with("br") => {
                out.push_str("&lt;");
                rest = after;
                continue;
            }
            '>' if quoted && !out.ends_with("<br") && !out.ends_with("<br/") => {
                out.push_str("&gt;");
                rest = after;
                continue;
            }
            _ => {}
        }
        out.push(character);
        rest = after;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::safe;

    #[test]
    fn a_drawing_with_a_script_or_a_handler_is_not_safe() {
        assert!(safe("<svg><text>one</text></svg>"));
        assert!(safe(
            "<svg><g class=\"node\" data-on=\"x\"><text>on=1</text></g></svg>"
        ));
        assert!(safe("<svg><use href=\"#label-0\"/></svg>"));
        assert!(!safe("<svg><use href=\"https://x/y.svg#a\"/></svg>"));
        assert!(!safe("<svg><style>g{fill:url(https://x/)}</style></svg>"));
        assert!(!safe("<svg><script>alert(1)</script></svg>"));
        assert!(!safe("<svg><g onclick=\"x\"></g></svg>"));
        assert!(!safe("<svg><a href=\"javascript:x\"></a></svg>"));
    }
}
