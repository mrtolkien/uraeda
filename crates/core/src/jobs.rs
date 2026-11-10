//! Jobs: the `[[jobs]]` tables of the settings file, each a prompt run at set times in a new
//! session (see `specs/decisions/run-lifecycle.md`). A job is the human's own, so it is read here
//! from their settings only. Reading never fails: a job with a problem is listed with it, and the
//! others read, as an extension does; and a file the settings cannot read gives no job and the
//! settings' own message. Jobs never make the settings unreadable.

use std::collections::HashSet;
use std::path::Path;

#[cfg(feature = "napi")]
use napi_derive::napi;
use toml_edit::{Document, Item, TableLike};

mod schedule;
mod write;

pub use schedule::{Schedule, schedule};
pub use write::{add, remove, set_on, update};

/// Why `jobs` is not read: a value that is not a list of tables.
const NOT_A_LIST: &str = "jobs is a list of [[jobs]] tables.";

/// Why `repositories` is not read: a value that is not a list of names.
const NOT_NAMES: &str = "repositories is a list of names.";

/// The rule a job with no repository fails.
const NO_REPOSITORY: &str = "A job runs in one repository at least.";

/// A job, as the settings file describes it.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Job {
    /// Unique among the jobs, as written: the second of a name has a problem.
    pub name: String,
    /// The repositories of Uraeda's list it runs in.
    pub repositories: Vec<String>,
    /// The schedule as written.
    pub schedule_text: String,
    /// The schedule, absent when it has a problem.
    pub schedule: Option<Schedule>,
    pub prompt: String,
    /// Whether it runs at its times: `true` when unset.
    pub on: bool,
    /// Whether a change its run offers waits for the human: `false` when unset.
    pub report_only: bool,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    /// The first rule it fails. A job with a problem does not run.
    pub problem: Option<String>,
}

/// The jobs of the settings file, in its order.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Jobs {
    pub jobs: Vec<Job>,
    /// Why no job is read: the settings file cannot be read, or `jobs` is not a list of tables.
    pub problem: Option<String>,
}

/// A job to write, as the Jobs page's form gives it.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JobInput {
    pub name: String,
    pub repositories: Vec<String>,
    /// The schedule's text, one of the four forms.
    pub schedule: String,
    pub prompt: String,
    pub report_only: bool,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// The jobs in the config folder `config_dir`'s settings file: none when there is no file.
pub fn read(config_dir: &Path) -> Jobs {
    let whole = |problem: &str| Jobs {
        jobs: Vec::new(),
        problem: Some(problem.to_owned()),
    };
    if let Err(error) = crate::settings::read(config_dir) {
        return whole(&error.message);
    }
    let Ok(Some((text, _))) = crate::settings::load_text(config_dir) else {
        return Jobs {
            jobs: Vec::new(),
            problem: None,
        };
    };
    // The settings read the same text, so it parses.
    let Ok(document) = Document::parse(text.as_str()) else {
        return whole("config.toml cannot be read.");
    };
    let Some(item) = document.as_table().get("jobs") else {
        return Jobs {
            jobs: Vec::new(),
            problem: None,
        };
    };
    let Some(tables) = tables(item) else {
        return whole(NOT_A_LIST);
    };
    let mut seen = HashSet::new();
    let jobs = tables
        .into_iter()
        .map(|table| {
            let name = text_of(table, "name").unwrap_or_default();
            // A job without a name is never a duplicate.
            let duplicate = !name.is_empty() && !seen.insert(name.to_owned());
            job(table, duplicate)
        })
        .collect();
    Jobs {
        jobs,
        problem: None,
    }
}

/// The tables of `jobs`, `[[jobs]]` or an inline list of tables; `None` for any other value.
pub(crate) fn tables(item: &Item) -> Option<Vec<&dyn TableLike>> {
    if let Some(tables) = item.as_array_of_tables() {
        return Some(tables.iter().map(|table| table as &dyn TableLike).collect());
    }
    item.as_array()?
        .iter()
        .map(|value| value.as_inline_table().map(|table| table as &dyn TableLike))
        .collect()
}

/// The string `key` of `table`, `None` when it is absent or not text.
pub(crate) fn text_of<'a>(table: &'a dyn TableLike, key: &str) -> Option<&'a str> {
    table.get(key).and_then(Item::as_str)
}

/// The job one table holds. `duplicate` is whether an earlier job has its name.
fn job(table: &dyn TableLike, duplicate: bool) -> Job {
    let mut types: Vec<String> = Vec::new();
    let mut optional = |key: &str| match table.get(key) {
        None => None,
        Some(item) => match item.as_str() {
            Some(text) => Some(text.to_owned()),
            None => {
                types.push(format!("{key} is text."));
                None
            }
        },
    };
    let (agent, model, effort) = (optional("agent"), optional("model"), optional("effort"));
    let mut flag = |key: &str, default: bool| match table.get(key).map(Item::as_bool) {
        None => default,
        Some(Some(value)) => value,
        Some(None) => {
            types.push(format!("{key} is true or false."));
            default
        }
    };
    let (on, report_only) = (flag("on", true), flag("report_only", false));
    let repositories: Vec<String> = match table.get("repositories") {
        None => Vec::new(),
        Some(item) => {
            let list = item.as_array();
            let names: Vec<String> = list
                .into_iter()
                .flatten()
                .filter_map(|name| name.as_str().map(str::to_owned))
                .collect();
            if list.is_none_or(|list| list.len() != names.len()) {
                types.push(NOT_NAMES.to_owned());
            }
            names
        }
    };
    let mut job = Job {
        name: text_of(table, "name").unwrap_or_default().to_owned(),
        repositories,
        schedule_text: text_of(table, "schedule").unwrap_or_default().to_owned(),
        schedule: None,
        prompt: text_of(table, "prompt").unwrap_or_default().to_owned(),
        on,
        report_only,
        agent,
        model,
        effort,
        problem: None,
    };
    let checked = check(
        &job.name,
        &job.repositories,
        &job.schedule_text,
        &job.prompt,
        duplicate,
    );
    match checked {
        Ok(schedule) => {
            job.schedule = Some(schedule);
            job.problem = types.into_iter().next();
        }
        // A list that is not names is the problem to fix, before the one it causes.
        Err(problem) if problem == NO_REPOSITORY && types.iter().any(|kind| kind == NOT_NAMES) => {
            job.problem = Some(NOT_NAMES.to_owned());
        }
        Err(problem) => job.problem = Some(problem),
    }
    job
}

/// The schedule of a job, or the first rule it fails, in the order of the data model: a name, a
/// name of its own (`duplicate` when an earlier job has it), a repository, a schedule, a prompt.
/// The reader lists this problem on the job, and a write refuses with it.
fn check(
    name: &str,
    repositories: &[String],
    schedule_text: &str,
    prompt: &str,
    duplicate: bool,
) -> Result<Schedule, String> {
    if name.trim().is_empty() {
        return Err("A job has no name.".to_owned());
    }
    if duplicate {
        return Err(format!("Two jobs are named “{name}”."));
    }
    if repositories.is_empty() {
        return Err(NO_REPOSITORY.to_owned());
    }
    let schedule = schedule(schedule_text)?;
    if prompt.trim().is_empty() {
        return Err("A job has no prompt.".to_owned());
    }
    Ok(schedule)
}
