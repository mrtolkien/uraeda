//! The items of a spec: its stories and their scenarios, its criteria, its mockups, and the risk
//! tiers an approval may pick.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::stories::StoryTarget;

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    pub number: u32,
    pub block: u32,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    /// `US2`.
    pub id: String,
    pub title: String,
    /// `P1`.
    pub priority: String,
    pub heading_block: u32,
    /// Its top-level blocks after the heading.
    pub blocks: Vec<u32>,
    /// Its "Why this priority" paragraph.
    pub why: Option<u32>,
    pub scenarios: Vec<Scenario>,
    /// The blocks the web UI folds: its scenarios' intro paragraph and their list, or none.
    pub details: Vec<u32>,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Criterion {
    /// `SC-001`.
    pub id: String,
    pub block: u32,
}

#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecItems {
    pub stories: Vec<Story>,
    pub criteria: Vec<Criterion>,
    /// The frontmatter's `risk-tier` and `plan-review`, which an approval may change.
    pub risk_tier: Option<String>,
    pub plan_review: Option<bool>,
    /// The risk tiers an approval may pick, from the least risk to the most.
    pub tiers: Vec<TierChoice>,
    /// The blocks the web UI folds: the `## Details` heading and every top-level block after it,
    /// up to the next level-1 or level-2 heading, or none.
    pub details: Vec<u32>,
    /// The mockups the `## Mockups` section links, in its order.
    pub mockups: Vec<MockupLink>,
}

/// A link of a spec's `## Mockups` section to an HTML file under `mockups/`, or to a story.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockupLink {
    /// `mockups/repeat.html`, from the spec's folder, or a story's stories file, from the
    /// repository's top level.
    pub path: String,
    /// The link's text.
    pub label: String,
    /// The selectable block holding the link: its list item, row, or paragraph.
    pub block: u32,
    /// The story it names, when it is a story link.
    pub story: Option<StoryTarget>,
}

/// A risk tier an approval may pick, and whether the plan then waits for the human's review,
/// unless the human says otherwise.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TierChoice {
    pub value: String,
    pub plan_review: bool,
}
