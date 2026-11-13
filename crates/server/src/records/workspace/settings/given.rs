//! The settings the server's environment gives for one run: each is in force over the file, and
//! is never written into it.

use uraeda_core::settings as core;

use crate::Failure;
use crate::env::Environment;

/// The variable giving the allowed host names, separated by commas.
const ALLOWED_HOSTS: &str = "URAEDA_ALLOWED_HOSTS";
/// The variable giving the automatic continues in a row.
const AUTOMATIC_CONTINUES: &str = "URAEDA_AUTOMATIC_CONTINUES";
/// The variable turning the continue after a restart of the server on or off.
const AFTER_RESTART: &str = "URAEDA_CONTINUE_AFTER_RESTART";
/// The variable turning the continue at a usage limit's reset on or off.
const AFTER_LIMIT: &str = "URAEDA_CONTINUE_AFTER_LIMIT";
/// The variable turning the catch-up of open pull requests on or off.
const CATCH_UP: &str = "URAEDA_CATCH_UP_PULL_REQUESTS";
/// The variable turning the scheduled jobs on or off.
const SCHEDULED_JOBS: &str = "URAEDA_SCHEDULED_JOBS";
/// The variable every Claude Code session inherits its effort from, over any effort picked.
const CLAUDE_EFFORT: &str = "CLAUDE_CODE_EFFORT_LEVEL";

/// A value given for this run, with the name of the variable that gives it.
type Named<T> = Option<(&'static str, T)>;

/// What the environment gives for this run.
pub(super) struct Given {
    pub allowed_hosts: Named<Vec<String>>,
    pub automatic_continues: Named<u32>,
    pub after_restart: Named<bool>,
    pub after_limit: Named<bool>,
    pub catch_up: Named<bool>,
    pub scheduled_jobs: Named<bool>,
    /// `ura serve --no-scheduled-jobs`, over the variable and the file.
    pub no_scheduled_jobs: bool,
    /// Not a setting of Uraeda's: the settings show it, since it wins over the effort picked.
    pub claude_effort: Option<String>,
}

impl Given {
    /// Reads the variables, each checked by its setting's rule. An empty variable is unset.
    ///
    /// # Errors
    ///
    /// The variable's name and its problem, for a number out of its range, or a switch that is
    /// neither `true` nor `false`.
    pub(super) fn read(environment: &Environment) -> Result<Given, Failure> {
        let named = |name: &'static str| environment.var(name).map(|value| (name, value));
        let hosts = |(name, typed): (&'static str, &str)| (name, host_names(typed));
        let effort = environment.var(CLAUDE_EFFORT).map(str::trim);
        Ok(Given {
            allowed_hosts: named(ALLOWED_HOSTS).map(hosts),
            automatic_continues: named(AUTOMATIC_CONTINUES).map(continues).transpose()?,
            after_restart: named(AFTER_RESTART).map(switch).transpose()?,
            after_limit: named(AFTER_LIMIT).map(switch).transpose()?,
            catch_up: named(CATCH_UP).map(switch).transpose()?,
            scheduled_jobs: named(SCHEDULED_JOBS).map(switch).transpose()?,
            no_scheduled_jobs: false,
            claude_effort: effort
                .filter(|effort| !effort.is_empty())
                .map(str::to_owned),
        })
    }
}

/// The host names of a variable: separated by commas, trimmed, in lower case.
fn host_names(typed: &str) -> Vec<String> {
    let names = typed.split(',').map(|name| name.trim().to_lowercase());
    names.filter(|name| !name.is_empty()).collect()
}

/// The automatic continues in a row a variable gives, by the core's rule: from 1 to 10.
fn continues((name, typed): (&'static str, &str)) -> Result<(&'static str, u32), Failure> {
    let count = core::automatic_continues(typed).map_err(|problem| format!("{name}: {problem}"))?;
    let count = u32::try_from(count).map_err(|_| format!("{name}: {typed} is no count"))?;
    Ok((name, count))
}

/// A switch a variable gives: `true` or `false`, trimmed.
fn switch((name, typed): (&'static str, &str)) -> Result<(&'static str, bool), Failure> {
    match typed.trim() {
        "true" => Ok((name, true)),
        "false" => Ok((name, false)),
        _ => Err(format!("{name} is true or false.").into()),
    }
}
