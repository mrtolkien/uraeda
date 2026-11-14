//! Decisions as the spec page reads them: a decision's change between two versions, computed from
//! their texts and never stored, each rule with its case, and the changes of a feature's branch.

pub use crate::compare::Run;

/// The word that opens a rule's case, in emphasis, as decisions write it: `_So:_`.
pub const CASE: &str = "So:";
