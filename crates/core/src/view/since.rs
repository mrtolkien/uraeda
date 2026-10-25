//! What changed in a spec since the version its human reviewed.

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::decisions::Run;
use crate::files::document::LineRange;

/// A spec's change since the version reviewed by the review its revision answers.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SinceReview {
    /// The reviewed revision.
    pub revision: u32,
    /// Whether the review's commit resolves and holds the spec; `parts` is empty when not.
    pub found: bool,
    /// The parts changed, added, or removed, in the order of the version shown, a removed part
    /// at the place it held. Kept parts are left out.
    pub parts: Vec<SinceChange>,
}

/// A part of a spec that changed since its review.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SinceChange {
    /// `changed`, `added`, or `removed`.
    pub kind: String,
    /// The text of the nearest heading above the part, on its side: the reviewed one's for a
    /// removed part.
    pub heading: String,
    /// Its lines in the reviewed version, from the file's first line.
    pub before: Option<LineRange>,
    /// Its lines in the version shown, from the file's first line.
    pub after: Option<LineRange>,
    /// Its words, as a decision's part gives them.
    pub runs: Vec<Run>,
}
