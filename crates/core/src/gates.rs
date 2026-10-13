//! The human's gates, as every tool tells them apart: which files take a verdict, and whether a
//! file waits for the human.

use crate::files::frontmatter;
use crate::workspace::FileKind;

/// The status of a file waiting for the human.
pub const AWAITING_HUMAN: &str = "awaiting-human";

/// What the human's verdict on a file is.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Gate {
    /// A spec, a plan, or an assessment: approved, or changes requested.
    Review,
    /// A round of questions, by its number: its answers submitted.
    Round(u32),
}

/// The verdict a file of a feature or a bug takes, by its name: `None` for a file that takes
/// none.
pub fn gate_of(name: &str) -> Option<Gate> {
    match FileKind::of(name)? {
        (FileKind::Spec | FileKind::Plan | FileKind::Assessment, _) => Some(Gate::Review),
        (FileKind::Clarifications, Some(round)) => Some(Gate::Round(round)),
        _ => None,
    }
}

/// Whether a file's text waits for the human: `status: awaiting-human`.
pub fn awaits_human(text: &str) -> bool {
    frontmatter::parse(text).is_ok_and(|front| front.text("status") == Some(AWAITING_HUMAN))
}
