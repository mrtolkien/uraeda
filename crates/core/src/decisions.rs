//! Decisions as the spec page reads them: a decision's change between two versions, computed from
//! their texts and never stored, each rule with its case, and the changes of a feature's branch.

mod branch;
mod change;

pub use crate::compare::Run;
pub use branch::{BranchSides, branch_changes, branch_decision};
pub use change::{DecisionChange, PartChange, SectionChange, compare};

/// The word that opens a rule's case, in emphasis, as decisions write it: `_So:_`.
pub const CASE: &str = "So:";
