//! The fetcher: `origin` of each repository of the list fetched as the server starts and every
//! 5 minutes, and when a page asks, in the repository's turn. Why the last fetch failed is kept
//! for the page until one succeeds.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use uraeda_core::api;

use super::queue;
use crate::live::{Bus, Fault};
use crate::records::repositories;
use crate::shared::Shared;

/// How often a repository is fetched.
const EVERY: Duration = Duration::from_secs(300);

/// Why each repository's last fetch failed, by its main checkout: none once one succeeded.
#[derive(Default)]
pub(super) struct Fetcher(Mutex<HashMap<PathBuf, String>>);

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
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Fetches `origin` in the main checkout at `path` of the repository `name`, after the writes
/// made before it, keeps its outcome for the page, and says what the page shows changed.
///
/// # Errors
///
/// The core's refusal: a remote that cannot be reached, or that asks for credentials.
pub(super) fn fetch(shared: &Shared, bus: &Bus, name: &str, path: &Path) -> Result<(), Fault> {
    // JOIN(wave 6): write queue, outside its record: a fetch is no write a toast shows
    let fetched = queue::in_turn(shared, path, || api::git_fetch(path, |_| {}));
    let fetched = fetched.map_err(Fault::from);
    let failure = fetched
        .as_ref()
        .err()
        .map(|fault| fault.message().to_owned());
    shared.get::<Fetcher>().settle(path, failure);
    super::changed(bus, name);
    fetched
}

/// Fetches every repository of the list now, then every 5 minutes, until the server stops.
pub(super) fn start(shared: &Shared, bus: Bus) {
    let shared = shared.clone();
    tokio::spawn(async move {
        let mut ticks = tokio::time::interval(EVERY);
        loop {
            tokio::select! {
                () = shared.stopping() => return,
                _ = ticks.tick() => {}
            }
            let (shared, bus) = (shared.clone(), bus.clone());
            // A fetch that panicked is the next round's to try again.
            let _ = tokio::task::spawn_blocking(move || fetch_each(&shared, &bus)).await;
        }
    });
}

/// Fetches each repository of the list, one after another: a failure is kept for its page.
fn fetch_each(shared: &Shared, bus: &Bus) {
    let there = |repository: &repositories::Repository| !repository.missing;
    for repository in repositories::all(shared).into_iter().filter(there) {
        let _ = fetch(shared, bus, &repository.name, &repository.path);
    }
}
