//! Starting a feature or a change: its plan, made at once, and the start itself, its steps given
//! to a callback as it reaches them.

use std::path::Path;

use napi::Status;
use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use uraeda_core::actions::start::StartProgress;
use uraeda_core::api;
use uraeda_core::view::{PlannedView, StartStepView, StartedView};

use super::{Job, job};

/// The callback a start gives each of its steps.
type OnStep = ThreadsafeFunction<StartStepView, (), StartStepView, Status, false, true>;

/// Gives `step` to `on_step`, when there is one.
fn report(on_step: Option<&OnStep>, step: StartProgress) {
    if let Some(on_step) = on_step {
        on_step.call(step.into(), ThreadsafeFunctionCallMode::NonBlocking);
    }
}

/// What starting a proposed feature, or a change with the kind `"change"`, would make: every check
/// of the start made, nothing written, without waiting for the repository's other writes.
#[napi(
    ts_args_type = "repo: string, proposal: string, slug?: string | undefined | null, kind?: \"feature\" | \"change\" | undefined | null",
    ts_return_type = "Promise<PlannedView>"
)]
pub fn plan_start(
    repo: String,
    proposal: String,
    slug: Option<String>,
    kind: Option<String>,
) -> AsyncTask<Job<PlannedView>> {
    job(move || {
        let kind = api::start_kind(kind.as_deref())?;
        api::plan_start(Path::new(&repo), &proposal, slug.as_deref(), kind)
    })
}

/// Starts a proposed feature, or a change with the kind `"change"`, in its own worktree, calling
/// `onStep` with each step, the commit's output line by line. With deferral on, a hook's refusal of
/// its commit puts the proposal file and the priorities back, and rejects with `hook: `. Given
/// `day`, its plan's, it runs on that day, making the folder its plan answered with.
#[napi(
    ts_args_type = "repo: string, proposal: string, slug?: string | undefined | null, kind?: \"feature\" | \"change\" | undefined | null, onStep?: ((step: StartStepView) => void) | undefined | null, day?: string | undefined | null",
    ts_return_type = "Promise<StartedView>"
)]
pub fn start_feature(
    repo: String,
    proposal: String,
    slug: Option<String>,
    kind: Option<String>,
    on_step: Option<OnStep>,
    day: Option<String>,
) -> AsyncTask<Job<StartedView>> {
    job(move || {
        let kind = api::start_kind(kind.as_deref())?;
        let on_step = |step| report(on_step.as_ref(), step);
        match day {
            Some(day) => api::start_planned(
                Path::new(&repo),
                &proposal,
                slug.as_deref(),
                kind,
                &day,
                &on_step,
            ),
            None => {
                api::start_feature(Path::new(&repo), &proposal, slug.as_deref(), kind, &on_step)
            }
        }
    })
}

/// Starts a change typed as a text, with its images, in its own worktree: the first written line
/// is its title. Given `line`, the text of a line of **Now** it starts from, the start commit
/// replaces that line by the change's link while **Now** holds it once. Its steps go to `onStep` as
/// `startFeature`'s do.
#[napi(
    ts_args_type = "repo: string, text: string, images: Array<Buffer>, slug?: string | undefined | null, line?: string | undefined | null, onStep?: ((step: StartStepView) => void) | undefined | null",
    ts_return_type = "Promise<StartedView>"
)]
pub fn start_change(
    repo: String,
    text: String,
    images: Vec<Buffer>,
    slug: Option<String>,
    line: Option<String>,
    on_step: Option<OnStep>,
) -> AsyncTask<Job<StartedView>> {
    let images: Vec<Vec<u8>> = images.iter().map(|image| image.to_vec()).collect();
    job(move || {
        api::start_change(
            Path::new(&repo),
            &text,
            &images,
            slug.as_deref(),
            line.as_deref(),
            &|step| report(on_step.as_ref(), step),
        )
    })
}
