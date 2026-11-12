//! What a feature's branch changed outside its own folder: one feature's files, and every
//! feature's counts.

use uraeda_core::api::ApiError;
use uraeda_core::changes;
use uraeda_protocol::{AllBranchChanges, BranchChanges, FeatureChanges, ItemArgs, RepositoryArgs};

use super::views;
use crate::live::{Fault, Registry};
use crate::records::repositories;
use crate::shared::Shared;

/// Registers the records `BranchChanges` and `AllBranchChanges`.
pub(super) fn register(registry: &Registry) {
    registry.record::<BranchChanges>(of_feature);
    registry.record::<AllBranchChanges>(of_all);
}

/// Whether a read was refused for a repository without `specs/`, which has no changes to read.
fn no_specs(error: &ApiError) -> bool {
    error.message.starts_with("no specs/ folder ")
}

/// Prints why changes could not be read, by the error's first line: their record says `failed`.
fn failed(what: &str, error: &ApiError) {
    let line = error.message.lines().next().unwrap_or_default();
    say_err!("uraeda: {what} could not be read: {line}");
}

/// The value of the record `BranchChanges`, by the feature's folder. A folder that is no
/// feature's has none, nor a repository without `specs/`: changes that cannot be read, git
/// missing or the diff failing, are answered as failed, so the page says so.
fn of_feature(shared: &Shared, args: ItemArgs) -> Result<BranchChanges, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let answer = |changes, failed| Ok(BranchChanges { changes, failed });
    match changes::branch_changes(&repository.path, &args.id) {
        Ok(read) => answer(read.as_ref().map(views::sent).transpose()?, false),
        Err(error) if views::missing(&error) || no_specs(&error) => answer(None, false),
        Err(error) => {
            failed(&format!("the changes of {}", args.id), &error);
            answer(None, true)
        }
    }
}

/// The value of the record `AllBranchChanges`: each feature that has changes, without its files.
fn of_all(shared: &Shared, args: RepositoryArgs) -> Result<AllBranchChanges, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let counts = |read: changes::FeatureChanges| FeatureChanges {
        id: read.folder,
        count: read.changes.count,
        added: read.changes.added,
        removed: read.changes.removed,
    };
    let answer = |features, failed| Ok(AllBranchChanges { features, failed });
    match changes::all_branch_changes(&repository.path) {
        Ok(read) => answer(read.into_iter().map(counts).collect(), false),
        Err(error) if no_specs(&error) => answer(Vec::new(), false),
        Err(error) => {
            failed("the branches' changes", &error);
            answer(Vec::new(), true)
        }
    }
}
