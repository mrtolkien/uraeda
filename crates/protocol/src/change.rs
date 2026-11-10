//! A change to a record's value: small operations, each on one place of the value, and how a
//! holder of the value applies them.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

/// A place in a value, from its top: each step is a field's name in a record, or an item's `id`
/// in a list. The empty path is the whole value.
pub type Path = Vec<String>;

/// One operation of a change.
///
/// A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
/// `id`, a text no other item of the list has: any other list changes whole, by `set`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Op {
    /// What is at `path` becomes `value`: the whole value, a record's field, there before or not,
    /// or a list's item.
    Set { path: Path, value: Value },
    /// The text at `path` grows by `text`, at its end.
    Append { path: Path, text: String },
    /// The list at `path` gains the item `value`, before its item `before`, or at its end.
    Insert {
        path: Path,
        value: Value,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        before: Option<String>,
    },
    /// The field or the item at `path` goes.
    Remove { path: Path },
    /// The item at `path` moves before the item `before` of its list, or to its end.
    Move {
        path: Path,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        before: Option<String>,
    },
}

/// Why a change does not apply: the value is not the one the change was made for.
#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum ApplyError {
    #[error("nothing is at `{0}`")]
    Missing(String),
    #[error("`{0}` is not a text")]
    NotText(String),
    #[error("`{0}` is not a list")]
    NotList(String),
    #[error("the list at `{0}` already has an item `{1}`")]
    Duplicate(String, String),
    #[error("the whole value is neither a field nor an item")]
    Whole,
}

/// Applies a change to the value it was made for, one operation after the other.
///
/// # Errors
///
/// When an operation does not fit the value. The operations before it stay applied: the holder
/// asks for the whole value again.
pub fn apply(value: &mut Value, ops: &[Op]) -> Result<(), ApplyError> {
    ops.iter().try_for_each(|op| apply_one(value, op))
}

fn apply_one(root: &mut Value, op: &Op) -> Result<(), ApplyError> {
    match op {
        Op::Set { path, value } => set(root, path, value.clone()),
        Op::Append { path, text } => match at(root, path)? {
            Value::String(held) => {
                held.push_str(text);
                Ok(())
            }
            _ => Err(ApplyError::NotText(shown(path))),
        },
        Op::Insert {
            path,
            value,
            before,
        } => {
            let list = list_at(root, path)?;
            if let Some(id) = value["id"].as_str().filter(|id| index(list, id).is_some()) {
                return Err(ApplyError::Duplicate(shown(path), id.to_owned()));
            }
            let to = place(list, path, before.as_deref())?;
            list.insert(to, value.clone());
            Ok(())
        }
        Op::Remove { path } => take(root, path).map(drop),
        Op::Move { path, before } => {
            let (id, list_path) = path.split_last().ok_or(ApplyError::Whole)?;
            let list = list_at(root, list_path)?;
            let from = index(list, id).ok_or_else(|| ApplyError::Missing(shown(path)))?;
            let item = list.remove(from);
            let to = place(list, list_path, before.as_deref())?;
            list.insert(to, item);
            Ok(())
        }
    }
}

/// What is at a path of a value, or nothing: how a holder reads one place of the value without
/// changing it.
#[must_use]
pub fn get<'a>(value: &'a Value, path: &[String]) -> Option<&'a Value> {
    path.iter().try_fold(value, |value, name| match value {
        Value::Object(fields) => fields.get(name),
        Value::Array(list) => index(list, name).map(|found| &list[found]),
        _ => None,
    })
}

/// A path as an error shows it.
fn shown(path: &[String]) -> String {
    path.join("/")
}

/// Where the item `id` is in a list, looked for from its end, where a reply grows.
fn index(list: &[Value], id: &str) -> Option<usize> {
    list.iter().rposition(|item| item["id"] == id)
}

/// Where an item goes in the list at `path`: before the item `before`, or at the end.
fn place(list: &[Value], path: &[String], before: Option<&str>) -> Result<usize, ApplyError> {
    let Some(id) = before else {
        return Ok(list.len());
    };
    index(list, id).ok_or_else(|| ApplyError::Missing(format!("{}/{id}", shown(path))))
}

/// What is one step into a value: a record's field, or a list's item.
fn step<'a>(value: &'a mut Value, name: &str) -> Option<&'a mut Value> {
    match value {
        Value::Object(fields) => fields.get_mut(name),
        Value::Array(list) => index(list, name).map(|found| &mut list[found]),
        _ => None,
    }
}

/// What is at a path.
fn at<'a>(root: &'a mut Value, path: &[String]) -> Result<&'a mut Value, ApplyError> {
    path.iter()
        .try_fold(root, |value, name| step(value, name))
        .ok_or_else(|| ApplyError::Missing(shown(path)))
}

/// The list at a path.
fn list_at<'a>(root: &'a mut Value, path: &[String]) -> Result<&'a mut Vec<Value>, ApplyError> {
    match at(root, path)? {
        Value::Array(list) => Ok(list),
        _ => Err(ApplyError::NotList(shown(path))),
    }
}

fn set(root: &mut Value, path: &[String], value: Value) -> Result<(), ApplyError> {
    let Some((name, parent)) = path.split_last() else {
        *root = value;
        return Ok(());
    };
    match at(root, parent)? {
        Value::Object(fields) => {
            fields.insert(name.clone(), value);
        }
        held => *step(held, name).ok_or_else(|| ApplyError::Missing(shown(path)))? = value,
    }
    Ok(())
}

/// Takes the field or the item at a path out of its record or its list.
fn take(root: &mut Value, path: &[String]) -> Result<Value, ApplyError> {
    let (name, parent) = path.split_last().ok_or(ApplyError::Whole)?;
    let taken = match at(root, parent)? {
        Value::Object(fields) => fields.remove(name),
        Value::Array(list) => index(list, name).map(|from| list.remove(from)),
        _ => None,
    };
    taken.ok_or_else(|| ApplyError::Missing(shown(path)))
}
