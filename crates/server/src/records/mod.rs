//! The records and the actions of the server's domains, one file per domain beside this one.
//!
//! A domain's file has one function, which registers its handlers with the engine, as
//! [the engine's documentation](crate::live) shows:
//!
//! ```ignore
//! pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
//!     registry.record::<Workspace>(read_workspace);
//!     registry.action::<RepositoriesAdd>(add_repository);
//!     Ok(())
//! }
//! ```
//!
//! and its one line in the list below, `mod workspace;`. Each record and action is declared in
//! the protocol's crate first, with its line in `catalog()`: the test
//! `every_declared_record_and_action_is_served_and_no_other` compares the two lists.

use crate::Failure;
use crate::live::Registry;
use crate::shared::Shared;

/// The domains: each line declares a domain's module, and registers it as the server starts, in
/// this order.
macro_rules! domains {
    ($(mod $domain:ident;)*) => {
        $(mod $domain;)*

        /// Registers every domain's records and actions.
        pub(crate) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
            let _ = (shared, registry);
            $($domain::register(shared, registry)?;)*
            Ok(())
        }
    };
}

domains! {}
