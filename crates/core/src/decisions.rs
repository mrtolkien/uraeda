//! Decisions as the spec page reads them: a rule's strength, and a decision's change between two
//! versions, computed from their texts and never stored.

mod change;
mod strength;

pub use change::{DecisionChange, PartChange, Run, SectionChange, compare};
pub use strength::{Strength, strength};
