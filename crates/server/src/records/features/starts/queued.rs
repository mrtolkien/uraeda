//! A start as a write of the queue: it lands behind the writes queued before it, with its steps
//! in its write, and holds its folder and its slug while it is there.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Weak};

use uraeda_core::actions::start::StartProgress;
use uraeda_core::api::{self, ApiError};
use uraeda_core::view::{PlannedView, StartedView};
use uraeda_core::workspace::Kind;
use uraeda_protocol::WriteName;

use super::steps::{self, Progress};
use crate::live::{Fault, locked};
use crate::records::repositories;
use crate::records::writing::{self, Queued, Write};
use crate::shared::Shared;

/// The starts in the queue of each repository, by its main checkout: what they hold, and the
/// turn their plans take.
#[derive(Default)]
pub(in crate::records::features) struct Starts {
    plans: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
    held: Mutex<HashMap<PathBuf, Vec<Weak<Taken>>>>,
}

/// What a start in the queue holds: the folder it planned, and its slug.
struct Taken {
    folder: Option<String>,
    slug: Option<String>,
}

impl Starts {
    /// The turn of a repository's plans: held while a start is planned and queued, so a plan
    /// sees every start queued before it.
    pub(super) fn plan_turn(&self, root: &Path) -> Arc<Mutex<()>> {
        locked(&self.plans)
            .entry(root.to_owned())
            .or_default()
            .clone()
    }

    /// Refuses a planned start whose folder or slug a start still in the queue holds, in the
    /// core's own words for a taken slug.
    pub(super) fn free(&self, root: &Path, planned: &PlannedView, kind: Kind) -> Result<(), Fault> {
        let held = locked(&self.held);
        let starts = held.get(root).into_iter().flatten();
        let taken = starts.filter_map(Weak::upgrade).any(|taken| {
            taken.folder.as_ref() == Some(&planned.folder)
                || taken.slug.as_ref() == Some(&planned.slug)
        });
        let (folder, slug) = (&planned.folder, &planned.slug);
        match (taken, kind) {
            (false, _) => Ok(()),
            (true, Kind::Feature) => Err(Fault::refused(format!(
                "A feature named {slug} exists already"
            ))),
            (true, Kind::Change) => Err(Fault::refused(format!(
                "{folder} exists: choose another slug with --slug"
            ))),
        }
    }

    /// Holds a start's folder and slug until what is returned drops, as its landing ends.
    fn hold(&self, root: &Path, folder: Option<&str>, slug: Option<&str>) -> Arc<Taken> {
        let taken = Arc::new(Taken {
            folder: folder.map(str::to_owned),
            slug: slug.map(str::to_owned),
        });
        let mut held = locked(&self.held);
        let starts = held.entry(root.to_owned()).or_default();
        starts.retain(|start| start.strong_count() > 0);
        starts.push(Arc::downgrade(&taken));
        taken
    }
}

/// A start to queue: its name in the queue, and what it holds while it is there.
pub(super) struct Start {
    /// The client's name for it.
    pub name: Option<WriteName>,
    /// Its name when the client gave none, and the page a refusal opens.
    pub label: String,
    pub href: &'static str,
    /// The folder and the branch it planned: none for a typed change, which the core cannot
    /// plan.
    pub folder: Option<String>,
    pub branch: Option<String>,
    /// The slug it takes.
    pub slug: Option<String>,
}

/// A start's run in the core: on the main checkout, its steps given to the second argument.
pub(super) trait Run:
    FnOnce(&Path, &dyn Fn(StartProgress)) -> Result<StartedView, ApiError> + Send + 'static
{
}

impl<F> Run for F where
    F: FnOnce(&Path, &dyn Fn(StartProgress)) -> Result<StartedView, ApiError> + Send + 'static
{
}

/// What a start made, and the session its first run went to: none when no run was sent.
pub(super) struct Landed {
    pub started: StartedView,
    pub session: Option<String>,
}

/// What follows a start that ran, as its last step: its first run, or the messages kept for
/// its folder while it landed. It gives the session a first run went to.
pub(super) trait Then: FnOnce(&StartedView) -> Option<String> + Send + 'static {}

impl<F> Then for F where F: FnOnce(&StartedView) -> Option<String> + Send + 'static {}

/// Queues a start behind the writes queued before it, with its steps in its write. The lists'
/// writes wait for it until its commit landed, and its feature's until it ended. It commits
/// within its landing, with the hooks. Once it ran, `then` starts its agent, as its last step.
pub(super) fn queue(
    shared: &Shared,
    repo: &str,
    start: Start,
    run: impl Run,
    then: impl Then,
) -> Result<Queued<Landed>, Fault> {
    let root = repositories::path(shared, repo)?;
    let default = api::read_workspace(&root)?.default_branch;
    let default = default.as_deref().unwrap_or("the default branch");
    let steps = steps::of(default, start.branch.as_deref());
    let write = Write::of_lists()
        .named(start.name)
        .or_named(start.label, start.href)
        .steps(steps.clone());
    let write = match &start.folder {
        Some(folder) => write.and_feature(folder),
        None => write,
    };
    let starts = shared.get::<Starts>();
    let held = starts.hold(&root, start.folder.as_deref(), start.slug.as_deref());
    let clock = shared.clone();
    writing::land(shared, repo, write, move |root, landing| {
        // Its folder and its slug are free again once it landed or was refused.
        let _held = held;
        let progress = Progress::begun(steps, landing, &clock);
        match run(root, &|step| progress.step(step)) {
            Ok(started) => {
                progress.agent();
                let session = then(&started);
                progress.done();
                Ok(Landed { started, session })
            }
            Err(refusal) => {
                let fault = Fault::from(refusal);
                progress.refused(fault.message());
                Err(fault)
            }
        }
    })
}
