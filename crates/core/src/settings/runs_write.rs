//! Writing the run options of `[runs]`: each table edited where it is, its comments and unknown
//! keys kept (see `specs/decisions/run-options.md`).

use std::path::Path;

use toml_edit::{ArrayOfTables, Item, TableLike, Value};

use super::runs::{ReviewerOptions, RunOptions, RunPick, StepOptions, check_run_options};
use super::{Settings, change_path, nested, set};
use crate::api::ApiError;

/// Replaces the run options of `dir`'s file with `options`, writing only the values set, and
/// removes the old `build_in_fresh_session`. Every other key of `[runs]`, its comments, and its
/// order stay. Refused when the options do not pass `check_run_options`, or the file cannot be
/// read.
pub fn set_run_options(dir: &Path, options: &RunOptions) -> Result<Settings, ApiError> {
    check_run_options(options)?;
    change_path(dir, &["runs"], |runs| {
        runs.remove("build_in_fresh_session");
        put(runs, "review_depth", options.review_depth.as_deref());
        write_steps(dir, runs, &options.steps)?;
        write_implementers(dir, runs, options.implementers.as_ref())?;
        write_reviewers(runs, options.reviewers.as_deref());
        Ok(())
    })
}

/// Sets `key` to `value`, keeping the old value's comment, or removes it when `value` is `None`.
fn put(table: &mut dyn TableLike, key: &str, value: Option<&str>) {
    match value {
        Some(value) => set(table, key, Value::from(value)),
        None => {
            table.remove(key);
        }
    }
}

/// Writes an agent, a model, and an effort in `table`, removing each one unset.
fn put_pick(
    table: &mut dyn TableLike,
    agent: &Option<String>,
    model: &Option<String>,
    effort: &Option<String>,
) {
    put(table, "agent", agent.as_deref());
    put(table, "model", model.as_deref());
    put(table, "effort", effort.as_deref());
}

/// Replaces `[runs.steps]` with `steps`: a step's table kept where it was and edited, the options
/// of a step not listed removed, and a table left empty removed. Unknown keys stay.
fn write_steps(
    dir: &Path,
    runs: &mut dyn TableLike,
    steps: &[StepOptions],
) -> Result<(), ApiError> {
    if !runs.contains_key("steps") {
        if steps.is_empty() {
            return Ok(());
        }
        // Implicit, so that `[runs.steps]` shows no header of its own above its steps' tables.
        let mut created = toml_edit::Table::new();
        created.set_implicit(true);
        runs.insert("steps", Item::Table(created));
    }
    let table = nested(dir, runs, &["steps"])?;
    let gone: Vec<StepOptions> = table
        .iter()
        .map(|(name, _)| name.to_owned())
        .filter(|name| !steps.iter().any(|step| step.step == *name))
        .map(|step| StepOptions {
            step,
            ..StepOptions::default()
        })
        .collect();
    for step in gone.iter().chain(steps) {
        let inner = nested(dir, table, &[&step.step])?;
        put_pick(inner, &step.agent, &step.model, &step.effort);
        match step.new_session {
            Some(new_session) => set(inner, "new_session", Value::from(new_session)),
            None => {
                inner.remove("new_session");
            }
        }
        if inner.is_empty() {
            table.remove(&step.step);
        }
    }
    if table.is_empty() {
        runs.remove("steps");
    }
    Ok(())
}

/// Replaces `[runs.implementers]` with `pick`, its unknown keys kept, removed when left empty.
fn write_implementers(
    dir: &Path,
    runs: &mut dyn TableLike,
    pick: Option<&RunPick>,
) -> Result<(), ApiError> {
    if pick.is_none() && !runs.contains_key("implementers") {
        return Ok(());
    }
    let pick = pick.cloned().unwrap_or_default();
    let table = nested(dir, runs, &["implementers"])?;
    put_pick(table, &pick.agent, &pick.model, &pick.effort);
    if table.is_empty() {
        runs.remove("implementers");
    }
    Ok(())
}

/// Replaces `[[runs.reviewers]]` with `reviewers`, each table still there edited in its place,
/// removed when unset or empty.
fn write_reviewers(runs: &mut dyn TableLike, reviewers: Option<&[ReviewerOptions]>) {
    let reviewers = reviewers.unwrap_or_default();
    if reviewers.is_empty() {
        runs.remove("reviewers");
        return;
    }
    if runs
        .get("reviewers")
        .and_then(Item::as_array_of_tables)
        .is_none()
    {
        runs.insert("reviewers", Item::ArrayOfTables(ArrayOfTables::new()));
    }
    let Some(tables) = runs
        .get_mut("reviewers")
        .and_then(Item::as_array_of_tables_mut)
    else {
        return;
    };
    while tables.len() > reviewers.len() {
        tables.remove(tables.len() - 1);
    }
    for (index, reviewer) in reviewers.iter().enumerate() {
        if index == tables.len() {
            tables.push(toml_edit::Table::new());
        }
        let Some(table) = tables.get_mut(index) else {
            continue;
        };
        put_pick(table, &reviewer.agent, &reviewer.model, &reviewer.effort);
        put(table, "instructions", reviewer.instructions.as_deref());
        put(table, "command", reviewer.command.as_deref());
    }
}
