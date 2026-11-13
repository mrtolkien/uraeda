//! The scheduled jobs' record and actions: a repository's `Jobs`, the jobs that name it with
//! their problem, next run, and history; their writes in the settings file, which the core
//! makes; and "Run now". Each write answers nothing: the record shows the change.

mod view;

use uraeda_core::jobs::{self, JobInput as CoreInput};
use uraeda_protocol::{
    JobInput, Jobs, JobsAdd, JobsRan, JobsRemove, JobsRunNow, JobsSetOn, JobsUpdate,
};

use crate::Failure;
use crate::live::{Call, Fault, Registry};
use crate::shared::Shared;

/// Registers the record `Jobs` and the actions `jobs.*`.
pub(super) fn register(_: &Shared, registry: &Registry) -> Result<(), Failure> {
    registry.record::<Jobs>(|shared, args| view::jobs(shared, &args.repo));
    registry.action::<JobsAdd>(|call, input| {
        written(call, |dir| jobs::add(dir, &core_input(input.job)))
    });
    registry.action::<JobsUpdate>(|call, input| {
        let (from, to) = (
            input.name.trim().to_owned(),
            input.job.name.trim().to_owned(),
        );
        written(call, |dir| {
            jobs::update(dir, &input.name, &core_input(input.job))
        })?;
        // A rename moves the job's runs too: its page keeps its history under the new name.
        call.shared()
            .get::<crate::runner::Store>()
            .rename_job(&from, &to)?;
        crate::jobs::announce(call.shared());
        Ok(())
    });
    registry.action::<JobsSetOn>(|call, input| {
        written(call, |dir| jobs::set_on(dir, &input.name, input.on))
    });
    registry
        .action::<JobsRemove>(|call, input| written(call, |dir| jobs::remove(dir, &input.name)));
    registry.action::<JobsRunNow>(|call, input| {
        let session = crate::jobs::run_now(call.shared(), &input.repo, &input.name)?;
        Ok(JobsRan { session })
    });
    Ok(())
}

/// The config folder changed: the jobs may have, and the scheduler looks for their times.
pub(super) fn config_changed(shared: &Shared) {
    crate::jobs::config_changed(shared);
}

/// Writes the settings file through the core, then shows the change and looks for the times
/// due: a job saved or resumed just before its time runs at it.
fn written(
    call: &Call,
    write: impl FnOnce(&std::path::Path) -> Result<(), uraeda_core::api::ApiError>,
) -> Result<(), Fault> {
    write(call.shared().config_dir())?;
    crate::jobs::config_changed(call.shared());
    Ok(())
}

/// The core's form of a job to write.
fn core_input(job: JobInput) -> CoreInput {
    CoreInput {
        name: job.name,
        repositories: job.repositories,
        schedule: job.schedule,
        prompt: job.prompt,
        report_only: job.report_only,
        agent: job.agent,
        model: job.model,
        effort: job.effort,
    }
}
