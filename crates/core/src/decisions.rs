//! Decisions as the spec page reads them: a rule's strength, a decision's change between two
//! versions, computed from their texts and never stored, and the changes of a feature's branch.

mod branch;
mod change;
mod strength;

pub use crate::compare::Run;
pub use branch::{BranchSides, branch_changes, branch_decision};
pub use change::{DecisionChange, PartChange, SectionChange, compare};
pub use strength::{Strength, keywords, strength};
