//! Story links: a link to a Storybook stories file with an export as its fragment,
//! `[Dragging](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`. A paragraph holding only
//! one embeds the story; anywhere else it links to it.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::document::{BlockKind, Document, Span, SpanLink};
use crate::workspace::resolve;

/// The extensions a stories file may have, after `.stories.`.
const EXTENSIONS: [&str; 6] = ["js", "jsx", "ts", "tsx", "mjs", "svelte"];

/// The story a link names.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryTarget {
    /// The stories file, from the repository's top level.
    pub path: String,
    /// The export's name.
    pub export: String,
}

/// A paragraph that embeds a story.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryLink {
    /// The stories file, from the repository's top level.
    pub path: String,
    /// The export's name.
    pub export: String,
    /// The link's text.
    pub label: String,
    /// The paragraph's block.
    pub block: u32,
}

/// The story a link names, as written in a file of `dir`, from the repository's top level: a path
/// ending in `.stories.` and one of the extensions, and a fragment that is an ASCII JavaScript
/// identifier. Web links, URIs, and anchors in the page name none.
pub fn story_target(dir: &str, target: &str) -> Option<StoryTarget> {
    let (_, export) = target.split_once('#')?;
    if !is_identifier(export) {
        return None;
    }
    let path = resolve(dir, target)?;
    let name = path.rsplit('/').next()?;
    let (stem, extension) = name.rsplit_once('.')?;
    (stem.ends_with(".stories") && EXTENSIONS.contains(&extension)).then(|| StoryTarget {
        path,
        export: export.to_string(),
    })
}

/// The story an agent's link names: as [`story_target`], read from the repository's top level.
pub fn story_link(href: &str) -> Option<StoryTarget> {
    story_target("", href)
}

/// The paragraphs that embed a story, in order: each holds exactly one story link, and nothing but
/// whitespace around it.
pub fn story_links(doc: &Document) -> Vec<StoryLink> {
    doc.blocks
        .iter()
        .filter(|block| block.kind == BlockKind::Paragraph)
        .filter_map(|block| {
            let (link, label) = only_link(&block.spans)?;
            let story = link.story.as_ref()?;
            Some(StoryLink {
                path: story.path.clone(),
                export: story.export.clone(),
                label,
                block: block.id,
            })
        })
        .collect()
}

/// The width an HTML mockup shows at without a `?w=` query, in pixels: a desktop's.
const MOCKUP_WIDTH: u32 = 1440;

/// A paragraph that embeds an HTML mockup.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockupEmbed {
    /// The mockup's page, from the repository's top level, without its query or anchor.
    pub path: String,
    /// The link's anchor, after its `#`.
    pub anchor: Option<String>,
    /// The link's query, after its `?` and before its `#`, as written, `w` included: the state the
    /// page shows, as `doc=plan&w=1440`.
    pub query: Option<String>,
    /// The width it shows at, in pixels: its `?w=` query's, or 1440.
    pub width: u32,
    /// The link's text.
    pub label: String,
    /// The paragraph's block.
    pub block: u32,
}

/// The paragraphs that embed an HTML mockup, in order: each holds exactly one link, and nothing
/// but whitespace around it, to an `.html` file in a `mockups` folder at any depth.
pub fn mockup_embeds(doc: &Document) -> Vec<MockupEmbed> {
    doc.blocks
        .iter()
        .filter(|block| block.kind == BlockKind::Paragraph)
        .filter_map(|block| {
            let (link, label) = only_link(&block.spans)?;
            let path = link.path.as_ref()?;
            let mut folders = path.rsplit('/');
            let is_mockup = folders.next()?.ends_with(".html") && folders.any(|f| f == "mockups");
            is_mockup.then(|| MockupEmbed {
                path: path.clone(),
                anchor: link.anchor.clone(),
                query: query_of(&link.target).map(str::to_owned),
                width: query_width(&link.target).unwrap_or(MOCKUP_WIDTH),
                label,
                block: block.id,
            })
        })
        .collect()
}

/// A link's query, after its `?` and before its `#`, when not empty.
fn query_of(target: &str) -> Option<&str> {
    let (_, query) = target.split('#').next()?.split_once('?')?;
    (!query.is_empty()).then_some(query)
}

/// The width a link's `?w=` query names, a whole number of pixels above 0.
fn query_width(target: &str) -> Option<u32> {
    query_of(target)?
        .split('&')
        .find_map(|pair| pair.strip_prefix("w="))?
        .parse()
        .ok()
        .filter(|width| *width > 0)
}

/// The one link of spans, and its text, when nothing but whitespace is around it. A link whose
/// text has several marks is several spans.
fn only_link(spans: &[Span]) -> Option<(&SpanLink, String)> {
    let mut found: Option<&SpanLink> = None;
    let mut label = String::new();
    let mut after = false;
    for span in spans {
        if span.image.is_some() {
            return None;
        }
        match &span.link {
            Some(link) if !after && found.is_none_or(|found| found == link) => {
                found = Some(link);
                label.push_str(&span.text);
            }
            None if span.text.trim().is_empty() => after = found.is_some(),
            _ => return None,
        }
    }
    found.map(|link| (link, label))
}

/// Whether a text is an ASCII JavaScript identifier: an ASCII letter, `$`, or `_`, then ASCII
/// letters, digits, `$`, or `_`.
fn is_identifier(text: &str) -> bool {
    let mut chars = text.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '$' || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '$' || c == '_')
}
