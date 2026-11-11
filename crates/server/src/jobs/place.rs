//! Where a job runs: a repository of the list it names, with the Jobs extension on there, and
//! the agent it runs on, on there and available.

use uraeda_core::jobs::Job;

use crate::records::repositories;
use crate::runner::Runner;
use crate::runtimes::Runtimes;
use crate::shared::Shared;

/// The built-in extension the jobs are: off in a repository, no job starts there.
pub(crate) const EXTENSION: &str = "jobs";

/// Where a job runs in a repository: its main checkout, and whether its agent is available.
pub(crate) struct Place {
    pub root: String,
    pub available: bool,
}

/// The main checkout of a listed repository of this name whose Jobs extension is on, which the
/// job names: none where it does not run, whatever its schedule or its pause.
pub(crate) fn runs_here(shared: &Shared, job: &Job, name: &str) -> Option<String> {
    let listed = repositories::all(shared).into_iter();
    let mut listed = listed.filter(|repository| !repository.missing);
    let repository = listed.find(|repository| repository.name == name)?;
    let on = crate::extensions::is_on(shared, EXTENSION, name);
    (job.repositories.iter().any(|named| named == name) && on)
        .then(|| repository.path.to_string_lossy().into_owned())
}

/// The runtime the job's runs start on in a repository: its own, else the first one on there.
/// None when it is off there or not registered.
pub(crate) fn agent_of(shared: &Shared, job: &Job, root: &str) -> Option<String> {
    let runner = Runner::find(shared)?;
    runner.new_session_runtime(root, job.agent.as_deref()).ok()
}

/// Whether the agent the job runs on in a main checkout is available: none when no agent of it
/// is on there.
pub(crate) fn place_available(shared: &Shared, job: &Job, root: &str) -> Option<bool> {
    let agent = agent_of(shared, job, root)?;
    Some(shared.get::<Runtimes>().status(&agent).available)
}

/// Where the job starts at its times in the repository of this name: it is on, has no problem,
/// runs there, and its agent is on there. None where it does not.
pub(crate) fn place_of(shared: &Shared, job: &Job, name: &str) -> Option<Place> {
    if !job.on || job.problem.is_some() || job.schedule.is_none() {
        return None;
    }
    let root = runs_here(shared, job, name)?;
    let agent = agent_of(shared, job, &root)?;
    let available = shared.get::<Runtimes>().status(&agent).available;
    Some(Place { root, available })
}

/// Why the job's agent does not run it in the repository, in the card's words: no agent on
/// there, the one it names off or unknown, or the one it runs on not available.
pub(crate) fn agent_words(shared: &Shared, job: &Job, name: &str) -> String {
    let runtimes = shared.get::<Runtimes>();
    let agent = job
        .agent
        .clone()
        .or_else(|| runtimes.on_in(Some(name)).into_iter().next());
    let Some(agent) = agent else {
        return "Not running here: no agent is on in this repository.".to_owned();
    };
    let title = runtimes.title(&agent);
    if runtimes.get(&agent).is_none() || !runtimes.is_on(&agent, Some(name)) {
        return format!("Not running here: {title} is off in this repository.");
    }
    format!("Not running here: {title} is not available on this machine.")
}
