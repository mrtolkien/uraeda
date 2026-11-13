//! The change between two values of a record, as the fewest operations that are cheap to find.

use std::collections::{HashMap, HashSet};

use serde_json::{Map, Value};

use crate::change::{Op, Path};

/// The change that makes `old` into `new`: `apply(old, diff(old, new))` gives `new`.
///
/// A text that only grew is one `append`. A list whose items each have an `id` changes by
/// `insert`, `remove`, and `move`, and its items that stay change in place; any other list, and
/// one that was or becomes empty, is `set` whole. Fields come in the order of their names, so the
/// change does not depend on how a record's fields were ordered.
#[must_use]
pub fn diff(old: &Value, new: &Value) -> Vec<Op> {
    let mut ops = Vec::new();
    walk(&mut Vec::new(), old, new, &mut ops);
    ops
}

fn walk(path: &mut Path, old: &Value, new: &Value, ops: &mut Vec<Op>) {
    if old == new {
        return;
    }
    match (old, new) {
        (Value::String(old), Value::String(new)) if new.starts_with(old.as_str()) => {
            let text = new[old.len()..].to_owned();
            ops.push(Op::Append {
                path: path.clone(),
                text,
            });
        }
        (Value::Object(old), Value::Object(new)) => fields(path, old, new, ops),
        (Value::Array(old), Value::Array(new)) => match (ids(old), ids(new)) {
            (Some(old_ids), Some(new_ids)) => {
                let lists = Lists {
                    old,
                    new,
                    old_ids,
                    new_ids,
                };
                items(path, &lists, ops);
            }
            _ => ops.push(set(path, Value::Array(new.clone()))),
        },
        _ => ops.push(set(path, new.clone())),
    }
}

fn set(path: &Path, value: Value) -> Op {
    Op::Set {
        path: path.clone(),
        value,
    }
}

/// A path one step further.
fn with(path: &Path, name: &str) -> Path {
    path.iter().cloned().chain([name.to_owned()]).collect()
}

/// A record's fields that went, then each of its fields now, changed or new.
fn fields(path: &mut Path, old: &Map<String, Value>, new: &Map<String, Value>, ops: &mut Vec<Op>) {
    let mut gone: Vec<_> = old.keys().filter(|name| !new.contains_key(*name)).collect();
    gone.sort();
    for name in gone {
        ops.push(Op::Remove {
            path: with(path, name),
        });
    }
    let mut names: Vec<_> = new.keys().collect();
    names.sort();
    for name in names {
        path.push(name.clone());
        match old.get(name) {
            Some(held) => walk(path, held, &new[name], ops),
            None => ops.push(set(path, new[name].clone())),
        }
        path.pop();
    }
}

/// The `id` of each item of a list that has items, when each has one of its own.
fn ids(list: &[Value]) -> Option<Vec<&str>> {
    let ids: Vec<&str> = list
        .iter()
        .map(|item| item.as_object()?.get("id")?.as_str())
        .collect::<Option<_>>()?;
    let distinct = ids.iter().collect::<HashSet<_>>().len() == ids.len();
    (distinct && !ids.is_empty()).then_some(ids)
}

/// Two lists of items with ids, and those ids, in each list's order.
struct Lists<'a> {
    old: &'a [Value],
    new: &'a [Value],
    old_ids: Vec<&'a str>,
    new_ids: Vec<&'a str>,
}

/// A list's items that went; then, from its end, each item that is new or has to move, before the
/// item that follows it; then the change inside each item that was there.
fn items(path: &mut Path, lists: &Lists, ops: &mut Vec<Op>) {
    let was: HashMap<&str, usize> = lists.old_ids.iter().copied().zip(0..).collect();
    let kept: HashSet<&str> = lists.new_ids.iter().copied().collect();
    for id in lists.old_ids.iter().filter(|id| !kept.contains(*id)) {
        ops.push(Op::Remove {
            path: with(path, id),
        });
    }
    let stays = staying(&lists.new_ids, &was);
    let mut before = None;
    for (index, id) in lists.new_ids.iter().enumerate().rev() {
        if !was.contains_key(id) {
            ops.push(Op::Insert {
                path: path.clone(),
                value: lists.new[index].clone(),
                before,
            });
        } else if !stays[index] {
            ops.push(Op::Move {
                path: with(path, id),
                before,
            });
        }
        before = Some((*id).to_owned());
    }
    for (item, id) in lists.new.iter().zip(&lists.new_ids) {
        if let Some(&index) = was.get(id) {
            path.push((*id).to_owned());
            walk(path, &lists.old[index], item, ops);
            path.pop();
        }
    }
}

/// For each item of the new list, whether it stays where it is: the items of the longest run that
/// is already in its new order, so the fewest items move.
fn staying(new_ids: &[&str], was: &HashMap<&str, usize>) -> Vec<bool> {
    // Each item that was there: its place now, and its place before.
    let kept: Vec<(usize, usize)> = new_ids
        .iter()
        .enumerate()
        .filter_map(|(now, id)| Some((now, *was.get(id)?)))
        .collect();
    // The last item of the best run of each length, and for each item the one before it in its run.
    let mut ends: Vec<usize> = Vec::new();
    let mut previous: Vec<Option<usize>> = Vec::with_capacity(kept.len());
    for (item, &(_, before)) in kept.iter().enumerate() {
        let length = ends.partition_point(|&end| kept[end].1 < before);
        previous.push(length.checked_sub(1).map(|shorter| ends[shorter]));
        if length == ends.len() {
            ends.push(item);
        } else {
            ends[length] = item;
        }
    }
    let mut stays = vec![false; new_ids.len()];
    let mut item = ends.last().copied();
    while let Some(index) = item {
        stays[kept[index].0] = true;
        item = previous[index];
    }
    stays
}
