//! The jobs of the settings file: read, with each job's problem, and written one at a time. Reading
//! never rejects: a problem is on the job, or on `Jobs`. A refused write rejects with `refused: `,
//! and a settings file that cannot be read with `unreadable: `.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::jobs::{self, JobInput, Jobs, Schedule};

use super::{Job, job};

/// The jobs in the config folder's settings file, each with its problem.
#[napi(ts_return_type = "Promise<Jobs>")]
pub fn read_jobs(config_dir: String) -> AsyncTask<Job<Jobs>> {
    job(move || Ok(jobs::read(Path::new(&config_dir))))
}

/// The schedule `text` writes. Throws the problem otherwise: the schedule is not understood, or its
/// time is outside 00:00 to 23:59. It reads nothing, so it returns at once.
#[napi]
pub fn checked_schedule(text: String) -> napi::Result<Schedule> {
    jobs::schedule(&text).map_err(napi::Error::from_reason)
}

/// Adds a job as the last of the jobs.
#[napi(ts_return_type = "Promise<void>")]
pub fn add_job(config_dir: String, job_input: JobInput) -> AsyncTask<Job<()>> {
    job(move || jobs::add(Path::new(&config_dir), &job_input))
}

/// Replaces the job `name`, a rename included.
#[napi(ts_return_type = "Promise<void>")]
pub fn update_job(config_dir: String, name: String, job_input: JobInput) -> AsyncTask<Job<()>> {
    job(move || jobs::update(Path::new(&config_dir), &name, &job_input))
}

/// Sets whether the job `name` runs at its times.
#[napi(ts_return_type = "Promise<void>")]
pub fn set_job_on(config_dir: String, name: String, on: bool) -> AsyncTask<Job<()>> {
    job(move || jobs::set_on(Path::new(&config_dir), &name, on))
}

/// Removes the job `name`.
#[napi(ts_return_type = "Promise<void>")]
pub fn remove_job(config_dir: String, name: String) -> AsyncTask<Job<()>> {
    job(move || jobs::remove(Path::new(&config_dir), &name))
}
