//! Decisions as the spec page reads them: a rule's strength, a decision's change between two
//! versions, computed from their texts and never stored, and the changes of a feature's branch.

mod branch;
pub mod candidates;
mod change;
mod parts;
mod strength;

pub use branch::{BranchSides, branch_changes, branch_decision};
pub use candidates::{Candidate, links_folder, option_folder};
pub use change::{DecisionChange, PartChange, Run, SectionChange, compare};
pub use strength::{Strength, strength};
