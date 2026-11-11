//! The fetcher: `origin` of each repository of the list fetched as the server starts and every
//! 5 minutes, and when a page asks, as a write of the repository's queue. Why the last fetch
//! failed is kept for the page until one succeeds.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use uraeda_core::api;

use crate::live::{Bus, Fault, locked};
use crate::records::repositories;
use crate::records::writing::{self, Queued, Write};
use crate::shared::Shared;

/// How often a repository is fetched.
const EVERY: Duration = Duration::from_secs(300);

/// Why each repository's last fetch failed, by its main checkout: none once one succeeded. And
/// where a repository that joins the list is named, to be fetched before the next round.
pub(super) struct Fetcher {
    failures: Mutex<HashMap<PathBuf, String>>,
    joined: UnboundedSender<String>,
}

impl Fetcher {
    /// Why the repository's last fetch failed, if it did.
    pub(super) fn failure(&self, repository: &Path) -> Option<String> {
        self.failures().get(repository).cloned()
    }

    /// Keeps the outcome of a fetch: its failure, or none.
    fn settle(&self, repository: &Path, failure: Option<String>) {
        let mut failures = self.failures();
        match failure {
            Some(failure) => failures.insert(repository.to_owned(), failure),
            None => failures.remove(repository),
        };
    }

    fn failures(&self) -> std::sync::MutexGuard<'_, HashMap<PathBuf, String>> {
        locked(&self.failures)
    }
}

/// Fetches `origin` of the repository listed as `name`, as a write of its queue, after the
/// writes made before it: `write` says whether the record shows it. Its outcome is kept for
/// the page, which is read again with it.
///
/// # Errors
///
/// The core's refusal: a remote that cannot be reached, or that asks for credentials.
pub(super) fn fetch(shared: &Shared, name: &str, write: Write) -> Result<(), Fault> {
    let path = repositories::path(shared, name)?;
    let fetching = writing::land(shared, name, write, |path, landing| {
        Ok(api::git_fetch(path, |line| landing.printed(line))?)
    });
    let fetched = fetching.and_then(Queued::landed);
    let failure = fetched
        .as_ref()
        .err()
        .map(|fault| fault.message().to_owned());
    shared.get::<Fetcher>().settle(&path, failure);
    // The page read as the fetch landed did not have its outcome yet.
    super::written(&shared.get::<Bus>(), name);
    fetched
}

/// Fetches every repository of the list now, then every 5 minutes, and each repository that
/// joins the list as it does, until the server stops.
pub(super) fn start(shared: &Shared) {
    let (joined, mut joining) = unbounded_channel();
    shared.provide(Fetcher {
        failures: Mutex::default(),
        joined,
    });
    let shared = shared.clone();
    tokio::spawn(async move {
        let mut ticks = tokio::time::interval(EVERY);
        loop {
            let one = tokio::select! {
                () = shared.stopping() => return,
                _ = ticks.tick() => None,
                Some(name) = joining.recv() => Some(name),
            };
            let shared = shared.clone();
            // A fetch that panicked is the next round's to try again.
            let _ = tokio::task::spawn_blocking(move || fetch_each(&shared, one)).await;
        }
    });
}

/// A repository joined the list: it is fetched before the next round.
pub(super) fn joined(shared: &Shared, name: &str) {
    // The fetcher's task ended with the server: nothing is left to fetch for.
    let _ = shared.get::<Fetcher>().joined.send(name.to_owned());
}

/// Fetches one repository of the list, or each when none is named, one after another: a failure
/// is kept for its page.
fn fetch_each(shared: &Shared, one: Option<String>) {
    let there = |repository: &repositories::Repository| !repository.missing;
    let named = |repository: &repositories::Repository| {
        one.as_ref().is_none_or(|name| *name == repository.name)
    };
    let listed = repositories::all(shared).into_iter();
    for repository in listed.filter(there).filter(named) {
        let _ = fetch(shared, &repository.name, Write::unseen());
    }
}
