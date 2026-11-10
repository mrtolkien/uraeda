//! Writing the jobs: each write edits the settings file as it is, under the folder's lock, and
//! changes only its job's table: every other table, comment, unknown key, and the order stay. A
//! write refuses what the reader would flag, with the same text, and while the settings file
//! cannot be read.

use std::path::Path;

use toml_edit::{Array, ArrayOfTables, Item, RawString, Table, TableLike, Value};

use super::{JobInput, NOT_A_LIST, check, tables, text_of};
use crate::api::ApiError;
use crate::settings::{change_document, change_path, refused, set};

/// Adds `job` as the last of the jobs: a new `[[jobs]]` table.
pub fn add(config_dir: &Path, job: &JobInput) -> Result<(), ApiError> {
    check_input(job)?;
    change_document(config_dir, &[], |document| {
        let root = document.as_table_mut();
        if names(root)?.contains(&job.name) {
            return Err(taken(&job.name));
        }
        // With no table in the file yet, its comments are the document's trailing text, which a
        // first table would end up above: they go above the table instead, as the header does.
        let first = root.iter().all(|(_, item)| item.is_value()) && root.get("jobs").is_none();
        let mut table = Table::new();
        apply(&mut table, job);
        match root.get_mut("jobs") {
            None => {
                let mut list = ArrayOfTables::new();
                list.push(table);
                root.insert("jobs", Item::ArrayOfTables(list));
            }
            Some(Item::ArrayOfTables(list)) => list.push(table),
            Some(Item::Value(Value::Array(list))) => {
                list.push(Value::InlineTable(table.into_inline_table()));
            }
            Some(_) => return Err(refused(NOT_A_LIST)),
        }
        let trailing = document.trailing().as_str().unwrap_or_default().to_owned();
        if first && !trailing.trim().is_empty() {
            document.set_trailing("");
            if let Some(Item::ArrayOfTables(list)) = document.as_table_mut().get_mut("jobs") {
                let comment = format!("{}\n\n", trailing.trim_end());
                list.iter_mut()
                    .for_each(|table| table.decor_mut().set_prefix(&comment));
            }
        }
        Ok(())
    })
    .map(|_| ())
}

/// Replaces the job `name` with `job`, a rename included: only the keys whose value differs are
/// written, each keeping its comment, and `report_only`, `agent`, `model`, and `effort` are
/// removed when they return to their default. `on` is not touched.
pub fn update(config_dir: &Path, name: &str, job: &JobInput) -> Result<(), ApiError> {
    check_input(job)?;
    edit(config_dir, |root| {
        let place = place(root, name)?;
        if job.name != name && names(root)?.contains(&job.name) {
            return Err(taken(&job.name));
        }
        let table = table_mut(root, place).ok_or_else(|| refused(NOT_A_LIST))?;
        apply(table, job);
        Ok(())
    })
}

/// Sets whether the job `name` runs at its times: `on`, written in its table.
pub fn set_on(config_dir: &Path, name: &str, on: bool) -> Result<(), ApiError> {
    edit(config_dir, |root| {
        let place = place(root, name)?;
        let table = table_mut(root, place).ok_or_else(|| refused(NOT_A_LIST))?;
        set(table, "on", Value::from(on));
        Ok(())
    })
}

/// Removes the job `name`, its table and the comment above it. A comment above it that a blank
/// line sets apart, like the file's header, is not its own: it stays, above the next table.
pub fn remove(config_dir: &Path, name: &str) -> Result<(), ApiError> {
    edit(config_dir, |root| {
        let place = place(root, name)?;
        let mut left = None;
        let empty = match root.get_mut("jobs") {
            Some(Item::ArrayOfTables(list)) => {
                let table = list.remove(place);
                left = table.position().zip(own_comment(&table));
                list.is_empty()
            }
            Some(Item::Value(Value::Array(list))) => {
                list.remove(place);
                list.is_empty()
            }
            _ => return Err(refused(NOT_A_LIST)),
        };
        if empty {
            root.remove("jobs");
        }
        if let Some((position, comment)) = left
            && let Some(next) = next_position(root, position)
        {
            prepend(root, next, &comment);
        }
        Ok(())
    })
}

/// Applies `change` to the file's top level, under the folder's lock.
fn edit(
    config_dir: &Path,
    change: impl FnOnce(&mut dyn TableLike) -> Result<(), ApiError>,
) -> Result<(), ApiError> {
    change_path(config_dir, &[], change).map(|_| ())
}

/// Refuses a job the reader would flag, with its problem.
fn check_input(job: &JobInput) -> Result<(), ApiError> {
    check(
        &job.name,
        &job.repositories,
        &job.schedule,
        &job.prompt,
        false,
    )
    .map(|_| ())
    .map_err(refused)
}

fn taken(name: &str) -> ApiError {
    refused(format!("A job named “{name}” exists already."))
}

/// The names of the jobs in file order, empty for a job without one.
fn names(root: &dyn TableLike) -> Result<Vec<String>, ApiError> {
    let Some(item) = root.get("jobs") else {
        return Ok(Vec::new());
    };
    let tables = tables(item).ok_or_else(|| refused(NOT_A_LIST))?;
    Ok(tables
        .into_iter()
        .map(|table| text_of(table, "name").unwrap_or_default().to_owned())
        .collect())
}

/// Where the first job `name` is in the list, as written.
fn place(root: &dyn TableLike, name: &str) -> Result<usize, ApiError> {
    names(root)?
        .iter()
        .position(|listed| listed == name)
        .ok_or_else(|| refused(format!("There is no job named “{name}”.")))
}

/// The table of the job at `place`.
fn table_mut(root: &mut dyn TableLike, place: usize) -> Option<&mut dyn TableLike> {
    match root.get_mut("jobs")? {
        Item::ArrayOfTables(list) => list
            .iter_mut()
            .nth(place)
            .map(|table| table as &mut dyn TableLike),
        Item::Value(Value::Array(list)) => list
            .get_mut(place)?
            .as_inline_table_mut()
            .map(|table| table as &mut dyn TableLike),
        _ => None,
    }
}

/// Writes `job` in `table`: a key whose value is the same is left as it is, and the optional keys
/// at their default are removed.
fn apply(table: &mut dyn TableLike, job: &JobInput) {
    put(table, "name", Some(&job.name));
    let same = table
        .get("repositories")
        .and_then(Item::as_array)
        .is_some_and(|list| {
            list.iter()
                .map(Value::as_str)
                .eq(job.repositories.iter().map(|name| Some(name.as_str())))
        });
    if !same {
        let list: Array = job.repositories.iter().map(String::as_str).collect();
        set(table, "repositories", Value::Array(list));
    }
    put(table, "schedule", Some(&job.schedule));
    match job.report_only {
        true if table.get("report_only").and_then(Item::as_bool) != Some(true) => {
            set(table, "report_only", Value::from(true));
        }
        true => {}
        false => {
            table.remove("report_only");
        }
    }
    put(table, "agent", job.agent.as_deref());
    put(table, "model", job.model.as_deref());
    put(table, "effort", job.effort.as_deref());
    put(table, "prompt", Some(&job.prompt));
}

/// Sets `key` to the text `value`, or removes it when `None`; unchanged when it holds that text.
fn put(table: &mut dyn TableLike, key: &str, value: Option<&str>) {
    match value {
        Some(value) if text_of(table, key) == Some(value) => {}
        Some(value) => set(table, key, Value::from(value)),
        None => {
            table.remove(key);
        }
    }
}

/// The comment above a removed table that is not its own, a blank line after it, or `None`.
fn own_comment(table: &Table) -> Option<String> {
    let prefix = table.decor().prefix().and_then(RawString::as_str)?;
    let lines: Vec<&str> = prefix.split_inclusive('\n').collect();
    let blank = lines
        .iter()
        .rposition(|line| line.ends_with('\n') && line.trim().is_empty())?;
    let kept = lines[..=blank].concat();
    (!kept.trim().is_empty()).then_some(kept)
}

/// The position of the first table of `table` after `at`, in the file's order.
fn next_position(table: &dyn TableLike, at: isize) -> Option<isize> {
    let after = |position: Option<isize>| position.filter(|position| *position > at);
    table
        .iter()
        .filter_map(|(_, item)| match item {
            Item::Table(inner) => after(inner.position())
                .into_iter()
                .chain(next_position(inner, at))
                .min(),
            Item::ArrayOfTables(list) => list
                .iter()
                .filter_map(|inner| after(inner.position()))
                .min(),
            _ => None,
        })
        .min()
}

/// Puts `comment`, then a blank line, above the table at `position`, before its own comment.
fn prepend(table: &mut dyn TableLike, position: isize, comment: &str) -> bool {
    for (_, item) in table.iter_mut() {
        let found = match item {
            Item::Table(inner) => {
                if inner.position() == Some(position) {
                    above(inner, comment);
                    true
                } else {
                    prepend(inner, position, comment)
                }
            }
            Item::ArrayOfTables(list) => list
                .iter_mut()
                .find(|inner| inner.position() == Some(position))
                .map(|inner| above(inner, comment))
                .is_some(),
            _ => false,
        };
        if found {
            return true;
        }
    }
    false
}

fn above(table: &mut Table, comment: &str) {
    let own = table
        .decor()
        .prefix()
        .and_then(RawString::as_str)
        .unwrap_or_default();
    let prefix = format!("{}\n\n{}", comment.trim_end(), own.trim_start_matches('\n'));
    table.decor_mut().set_prefix(prefix);
}
