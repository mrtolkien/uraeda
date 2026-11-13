//! Writing the run options of `[runs]`: each table edited where it is, its comments and unknown
//! keys kept (see `specs/decisions/run-options.md`).

use std::path::Path;

use toml_edit::{ArrayOfTables, Item, Table, TableLike, Value};

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

/// Replaces `[[runs.reviewers]]` with `reviewers`, removed when unset or empty. Each reviewer keeps
/// its own table, with its comments and unknown keys, found by its agent and model, its command, or
/// else its agent; a table no reviewer keeps is removed, and a reviewer without one gets a new one.
fn write_reviewers(runs: &mut dyn TableLike, reviewers: Option<&[ReviewerOptions]>) {
    let reviewers = reviewers.unwrap_or_default();
    let old = runs.remove("reviewers");
    if reviewers.is_empty() {
        return;
    }
    let mut old: Vec<Option<Table>> = old
        .and_then(|item| item.into_array_of_tables().ok())
        .map(|tables| tables.into_iter().map(Some).collect())
        .unwrap_or_default();
    // The tables' places in the file, given in turn to the reviewers' tables, so that the file
    // shows them in their new order.
    let mut places: Vec<isize> = old.iter().flatten().filter_map(Table::position).collect();
    places.sort_unstable();
    let mut kept: Vec<Option<Table>> = reviewers.iter().map(|_| None).collect();
    let passes: [fn(&ReviewerOptions, &Table) -> bool; 2] = [same_reviewer, same_agent];
    for pass in passes {
        for (reviewer, slot) in reviewers.iter().zip(kept.iter_mut()) {
            if slot.is_some() {
                continue;
            }
            *slot = old
                .iter_mut()
                .find(|table| table.as_ref().is_some_and(|table| pass(reviewer, table)))
                .and_then(Option::take);
        }
    }
    let mut tables = ArrayOfTables::new();
    for (index, (reviewer, table)) in reviewers.iter().zip(kept).enumerate() {
        let mut table = table.unwrap_or_default();
        // A reviewer past the old tables' count follows the last of them.
        if let Some(place) = places.get(index).or(places.last()) {
            table.set_position(Some(*place));
        }
        put_pick(
            &mut table,
            &reviewer.agent,
            &reviewer.model,
            &reviewer.effort,
        );
        put(&mut table, "instructions", reviewer.instructions.as_deref());
        put(&mut table, "command", reviewer.command.as_deref());
        tables.push(table);
    }
    runs.insert("reviewers", Item::ArrayOfTables(tables));
}

/// Whether `table` is `reviewer`'s: the same agent and model, or the same command.
fn same_reviewer(reviewer: &ReviewerOptions, table: &Table) -> bool {
    let text = |key: &str| table.get(key).and_then(Item::as_str);
    match &reviewer.command {
        Some(command) => text("command") == Some(command),
        None => {
            text("command").is_none()
                && text("agent") == reviewer.agent.as_deref()
                && text("model") == reviewer.model.as_deref()
        }
    }
}

/// Whether `table` runs `reviewer`'s agent, whatever its model.
fn same_agent(reviewer: &ReviewerOptions, table: &Table) -> bool {
    reviewer.agent.is_some()
        && table.get("command").is_none()
        && table.get("agent").and_then(Item::as_str) == reviewer.agent.as_deref()
}
