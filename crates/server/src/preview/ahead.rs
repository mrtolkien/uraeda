//! The review watch, ahead of the human (ruling R83): the previews of the folders whose file waits
//! for the human and embeds a story start before any page reads them, and their linked stories
//! compile, so a story shows at once when the human arrives.
//!
//! - **When**: for every folder of a repository as it joins the list, the server's start
//!   included, and for a feature's folder as its turn ends done.
//! - **One after the other**: each folder's preview is started and its stories compiled before
//!   the next one starts, on one queue: several Storybooks starting at once would load the
//!   machine for minutes.
//! - **Only where it can run**: a folder whose preview folder has no `node_modules` is left: its
//!   preview would only fail, and its stories show the failure. One that failed starts again.
//! - **It ends with the server**: the queue is one task, which waits on the runtime's timer and
//!   is dropped as the server stops, or with its runtime. Only a folder's reads run on a blocking
//!   thread, each for as long as its files and one `git` take: a wait there would be one the
//!   runtime waits for as it is dropped (ruling R427).

use std::time::Duration;

use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio::time::Instant;
use uraeda_core::files::stories::StoryLink;

use super::checkout::{self, MAIN};
use super::index::match_story;
use super::runner::{Checkout, State};
use super::{Previews, Reader};
use crate::shared::Shared;

/// How long a folder's preview may take to be ready, and its stories to compile, before the
/// queue goes on to the next one.
const PATIENCE: Duration = Duration::from_secs(180);

/// How often a folder's preview, then each story's compile, is looked at while it is awaited.
const LOOK: Duration = Duration::from_millis(250);

/// What the queue warms: every waiting folder of a repository, or one folder.
struct Ask {
    repository: String,
    folder: Option<String>,
}

/// The queue's door, which the server's shared state holds.
pub(super) struct Ahead(UnboundedSender<Ask>);

/// Starts the queue, until the server stops.
pub(super) fn mount(shared: &Shared) {
    let (asks, asked) = unbounded_channel();
    shared.provide(Ahead(asks));
    tokio::spawn(run(shared.clone(), asked));
}

/// Asks the queue to warm a folder, or every waiting folder of a repository with none.
pub(super) fn ask(shared: &Shared, repository: &str, folder: Option<&str>) {
    if let Some(ahead) = shared.find::<Ahead>() {
        let ask = Ask {
            repository: repository.to_owned(),
            folder: folder.map(str::to_owned),
        };
        // The queue ended with the server: nothing is left to warm.
        let _ = ahead.0.send(ask);
    }
}

/// Warms what is asked, one ask at a time, until the server stops: what it warms then is left
/// where it is, and nothing more starts.
async fn run(shared: Shared, mut asked: UnboundedReceiver<Ask>) {
    let warming = async {
        while let Some(ask) = asked.recv().await {
            warm(&shared, &ask).await;
        }
    };
    tokio::select! {
        () = warming => {}
        () = shared.stopping() => {}
    }
}

/// What `read` gives, read on a blocking thread: none when it panicked, or the runtime ends.
async fn reading<T: Send + 'static>(
    shared: &Shared,
    read: impl FnOnce(&Shared) -> T + Send + 'static,
) -> Option<T> {
    let shared = shared.clone();
    let read = tokio::task::spawn_blocking(move || read(&shared));
    read.await.ok()
}

/// Warms the folder asked, or each folder of the repository, one after the other.
async fn warm(shared: &Shared, ask: &Ask) {
    let folders = match &ask.folder {
        Some(folder) => vec![folder.clone()],
        None => {
            let repository = ask.repository.clone();
            let read = reading(shared, move |shared| folders(shared, &repository));
            read.await.unwrap_or_default()
        }
    };
    for folder in folders.into_iter().filter(|folder| folder != MAIN) {
        warm_folder(shared, &ask.repository, folder).await;
    }
}

/// The folders of a repository's features: none when it left the list, or cannot be read.
fn folders(shared: &Shared, repository: &str) -> Vec<String> {
    let root = crate::records::repositories::path(shared, repository);
    let workspace = root
        .ok()
        .and_then(|root| uraeda_core::api::read_workspace(&root).ok());
    let features = workspace
        .map(|workspace| workspace.features)
        .unwrap_or_default();
    features.into_iter().map(|feature| feature.folder).collect()
}

/// Starts a waiting folder's preview, then compiles the stories its waiting file embeds, and
/// returns once they compiled, or after [`PATIENCE`].
async fn warm_folder(shared: &Shared, repository: &str, folder: String) {
    let Some(previews) = shared.find::<Previews>() else {
        return;
    };
    let (viewing, repository) = (previews.clone(), repository.to_owned());
    let started = reading(shared, move |shared| {
        start(shared, &viewing, &repository, &folder)
    });
    let Some(Some((checkout, stories))) = started.await else {
        return;
    };
    let until = Instant::now() + PATIENCE;
    // Ready, or gone: a preview that failed, or stopped, compiles nothing.
    let ready = awaited(until, || match previews.runner.state(&checkout.base) {
        Some(State::Ready { .. }) => Some(true),
        Some(State::Starting) => None,
        _ => Some(false),
    });
    if ready.await != Some(true) {
        return;
    }
    let Some(index) = previews.runner.index(&checkout.base).await else {
        return;
    };
    for story in &stories {
        let Some(entry) = match_story(&index, &checkout.folder, &story.path, &story.export) else {
            continue;
        };
        // Compiled, or the preview gone.
        let compiled = awaited(until, || match previews.runner.state(&checkout.base) {
            Some(State::Ready { .. }) => previews
                .runner
                .compiled(&checkout.base, entry)
                .then_some(true),
            _ => Some(false),
        });
        if compiled.await != Some(true) {
            return;
        }
    }
}

/// Starts the preview of a folder that waits with a story, where it can run: its checkout, and
/// the stories to compile. It reads files and asks git: call it from a blocking thread.
fn start(
    shared: &Shared,
    previews: &Previews,
    repository: &str,
    folder: &str,
) -> Option<(Checkout, Vec<StoryLink>)> {
    let stories = checkout::waiting_stories(shared, repository, folder);
    if stories.is_empty() {
        return None;
    }
    let checkout = checkout::runnable(shared, previews, repository, folder)?;
    let modules = checkout.dir.join(&checkout.folder).join("node_modules");
    if !modules.is_dir() {
        return None;
    }
    let reader = || Reader {
        repository: repository.to_owned(),
        folder: folder.to_owned(),
        story: None,
    };
    match previews.runner.state(&checkout.base) {
        Some(State::Failed { .. }) => previews.restart(shared, &checkout, reader()),
        _ => previews.view(shared, &checkout, reader()),
    };
    Some((checkout, stories))
}

/// What `look` gives once it gives something, looked at every [`LOOK`]: none past `until`.
async fn awaited<T>(until: Instant, mut look: impl FnMut() -> Option<T>) -> Option<T> {
    loop {
        if let Some(found) = look() {
            return Some(found);
        }
        if Instant::now() >= until {
            return None;
        }
        tokio::time::sleep(LOOK).await;
    }
}
