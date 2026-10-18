//! A block's inline text as it is read: runs of text with the same marks, links, and images.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::Builder;
use crate::files::stories::{StoryTarget, story_target};
use crate::workspace::resolve;

/// A link of a span: its target as written, and the file it points to in the repository.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanLink {
    pub target: String,
    pub wiki: bool,
    /// The file from the repository's top level; absent for a web link, a URI, or an anchor in
    /// the page.
    pub path: Option<String>,
    /// The story it names, when it is a story link.
    pub story: Option<StoryTarget>,
    /// The part of its target after `#`, when not empty: a heading of the file it opens.
    pub anchor: Option<String>,
}

/// An image of a span: its target as written, and the file it shows in the repository.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanImage {
    pub target: String,
    /// The file from the repository's top level; absent for an image on the web or in a URI,
    /// such as `data:`.
    pub path: Option<String>,
}

/// A run of text with the same marks. An image's span holds its alt text.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub text: String,
    pub strong: bool,
    pub emphasis: bool,
    pub code: bool,
    pub strike: bool,
    pub link: Option<SpanLink>,
    pub image: Option<SpanImage>,
}

/// The marks in effect while reading inline text.
#[derive(Default, Clone)]
pub(super) struct Marks {
    pub(super) strong: u32,
    pub(super) emphasis: u32,
    pub(super) strike: u32,
    pub(super) link: Option<SpanLink>,
    /// How many images are open: inside one, their alt text is read into the outer image's span,
    /// the last one, and an inner image is only text.
    pub(super) image: u32,
}

impl Builder<'_> {
    pub(super) fn span(&mut self, text: &str, code: bool) {
        let Some(target) = self.target else {
            return;
        };
        let marks = self.marks.clone();
        let spans = &mut self.blocks[target as usize].spans;
        if marks.image > 0
            && let Some(last) = spans.last_mut()
        {
            last.text.push_str(text);
            return;
        }
        if let Some(last) = spans.last_mut()
            && last.image.is_none()
            && !code
            && !last.code
            && last.strong == (marks.strong > 0)
            && last.emphasis == (marks.emphasis > 0)
            && last.strike == (marks.strike > 0)
            && last.link == marks.link
        {
            last.text.push_str(text);
            return;
        }
        spans.push(Span {
            text: text.to_string(),
            strong: marks.strong > 0,
            emphasis: marks.emphasis > 0,
            code,
            strike: marks.strike > 0,
            link: marks.link,
            image: None,
        });
    }

    /// Starts an image's span, which its alt text then fills, or reads a nested image's alt text
    /// into the outer one's.
    pub(super) fn image(&mut self, target: &str) {
        self.marks.image += 1;
        if self.marks.image > 1 {
            return;
        }
        let Some(block) = self.target else {
            return;
        };
        let marks = self.marks.clone();
        self.blocks[block as usize].spans.push(Span {
            text: String::new(),
            strong: marks.strong > 0,
            emphasis: marks.emphasis > 0,
            code: false,
            strike: marks.strike > 0,
            link: marks.link,
            image: Some(SpanImage {
                target: target.to_string(),
                path: resolve(self.dir, target),
            }),
        });
    }

    pub(super) fn link(&self, target: &str, wiki: bool) -> SpanLink {
        let path = if wiki || target.starts_with('#') {
            None
        } else {
            resolve(self.dir, target)
        };
        SpanLink {
            target: target.to_string(),
            wiki,
            path,
            story: (!wiki).then(|| story_target(self.dir, target)).flatten(),
            anchor: target
                .split_once('#')
                .map(|(_, anchor)| anchor)
                .filter(|anchor| !anchor.is_empty())
                .map(str::to_string),
        }
    }
}
