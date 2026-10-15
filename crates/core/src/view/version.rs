//! A workflow file at one version: its text, its document, and its items.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::document::{self, Document};
use crate::files::items::{Items, items};
use crate::files::stories::{StoryLink, story_links};

/// A file's document and items, at one version.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionView {
    pub text: String,
    pub document: Document,
    pub items: Items,
    /// The stories its paragraphs embed.
    pub stories: Vec<StoryLink>,
}

impl VersionView {
    /// The version of the file `name`, with `text`, in the folder `dir` from the repository's top
    /// level.
    pub fn new(name: &str, text: String, dir: &str) -> VersionView {
        let document = document::parse(&text, dir);
        let items = items(name, &text, &document);
        let stories = story_links(&document);
        VersionView {
            text,
            document,
            items,
            stories,
        }
    }
}
