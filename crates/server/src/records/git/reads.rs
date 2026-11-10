//! Git's records: each is read from the repository when asked, through the core.

use uraeda_core::api::{self, GitAt};
use uraeda_protocol::{
    ConflictFile, ConflictFileArgs, GitCommit, GitCommitArgs, GitDiff, GitDiffArgs, GitHistoryArgs,
    GitHistoryPage, GitPage, GitSummary, RepositoryArgs,
};

use super::fetcher::Fetcher;
use super::{repository, views, working};
use crate::live::{Fault, Registry};
use crate::shared::Shared;

pub(super) fn register(registry: &Registry) {
    registry.record::<GitPage>(|shared, args| page(shared, &args));
    registry.record::<GitSummary>(|shared, args| {
        let path = repository::path(shared, &args.repo)?;
        Ok(views::summary(&api::git_summary(&path)?))
    });
    registry.record::<GitDiff>(diff);
    registry.record::<GitCommit>(|shared, args: GitCommitArgs| {
        let path = repository::path(shared, &args.repo)?;
        Ok(views::commit(api::git_commit(&path, &args.id)?))
    });
    registry.record::<GitHistoryPage>(|shared, args: GitHistoryArgs| {
        let path = repository::path(shared, &args.repo)?;
        Ok(views::history(api::git_history(&path, &args.after)?))
    });
    registry.record::<ConflictFile>(|shared, args: ConflictFileArgs| {
        let path = repository::path(shared, &args.repo)?;
        Ok(views::conflict_file(api::conflict_file(&path, &args.path)?))
    });
}

/// The page, with whether an agent works in each of its checkouts, and why the last fetch
/// failed.
fn page(shared: &Shared, args: &RepositoryArgs) -> Result<GitPage, Fault> {
    let path = repository::path(shared, &args.repo)?;
    let view = api::git_page(&path)?;
    let known = views::Known {
        chat_works: working::chat(shared, &path),
        working: working::folders(shared, &path),
        fetch_failure: shared.get::<Fetcher>().failure(&path),
    };
    Ok(views::page(view, known))
}

/// A file's diff, of a commit or of a group's working tree.
fn diff(shared: &Shared, args: GitDiffArgs) -> Result<GitDiff, Fault> {
    let path = repository::path(shared, &args.repo)?;
    let at = GitAt {
        folder: args.folder,
        commit: args.commit,
    };
    Ok(views::diff(api::git_diff(
        &path, &at, &args.path, args.whole,
    )?))
}
