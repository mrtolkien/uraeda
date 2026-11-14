//! A proposal, a feature's or a change's: how far discovery researches it, and which of its `##` sections
//! are written yet.

use crate::check::allowed_values;
use crate::workspace::FileKind;

use super::frontmatter;

/// The effort discovery puts in when the proposal names none, or a value that is not one.
pub(crate) const DEFAULT_DISCOVERY: &str = "high";

/// The discovery efforts a proposal may ask for, from the least research to the most.
pub fn discovery_levels() -> &'static [&'static str] {
    allowed_values(FileKind::Proposal, "discovery")
}

/// The effort a proposal's `discovery` field asks for: `high` without the field, or with a value
/// that is not one of the levels.
pub fn discovery(text: &str) -> &'static str {
    let front = frontmatter::parse(text).ok();
    let value = front.as_ref().and_then(|front| front.raw("discovery"));
    discovery_levels()
        .iter()
        .find(|level| Some(**level) == value)
        .copied()
        .unwrap_or(DEFAULT_DISCOVERY)
}
