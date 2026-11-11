//! Claude Code's `system` lines: the session's start, its background tasks, and its retries.

use std::collections::HashMap;

use serde_json::Value;

use super::json::{field, is_true, number, objects, string, text, words};
use crate::runner::{BackgroundKind, BackgroundTask, Event};

/// The plugin the skill loads as, which every process must report loaded.
const PLUGIN: &str = "uraeda";

/// The events of a `system` line. `tasks`, kept across a process's lines, maps its background
/// tasks to the tool calls that started them.
pub(super) fn events(message: &Value, tasks: &mut HashMap<String, String>) -> Vec<Event> {
    match string(message, "subtype") {
        Some("init") => vec![Event::Init {
            session_id: text(message, "session_id").to_owned(),
            problem: plugin_problem(message),
        }],
        Some("task_started") => {
            let started = string(message, "task_id").zip(string(message, "tool_use_id"));
            if let Some((task, tool)) = started {
                tasks.insert(task.to_owned(), tool.to_owned());
            }
            Vec::new()
        }
        Some("background_tasks_changed") => background(message, tasks).into_iter().collect(),
        Some("api_retry") => vec![retry(message)],
        _ => Vec::new(),
    }
}

/// Why the process must not run: the skill loads as the `uraeda` plugin, which an error, or its
/// absence from the plugins loaded, leaves out.
fn plugin_problem(message: &Value) -> Option<String> {
    let plugins = objects(message, "plugins").into_iter();
    let plugins: Vec<&str> = plugins.map(|plugin| text(plugin, "name")).collect();
    // Printed as `null` when every plugin loaded.
    let errors = objects(message, "plugin_errors").into_iter();
    let errors: Vec<&str> = errors
        .map(|error| {
            let said = words(error, "message").or_else(|| words(error, "type"));
            said.unwrap_or("unknown error")
        })
        .collect();
    if errors.is_empty() && plugins.contains(&PLUGIN) {
        return None;
    }
    let why = match (errors.is_empty(), plugins.join(", ")) {
        (false, _) => errors.join("; "),
        (true, loaded) if loaded.is_empty() => "the plugins loaded were none".to_owned(),
        (true, loaded) => format!("the plugins loaded were {loaded}"),
    };
    Some(format!("The Uraeda skill did not load: {why}"))
}

/// Every live background task of the run, but those the agent marks ambient: sub-agents and
/// workflows, and every other kind, like a background shell, as a command.
fn background(message: &Value, tasks: &HashMap<String, String>) -> Option<Event> {
    field(message, "tasks")?.as_array()?;
    let live = objects(message, "tasks").into_iter();
    let live = live.filter(|task| !is_true(task, "ambient"));
    let live = live.map(|task| {
        let agent = matches!(
            string(task, "task_type"),
            Some("local_agent" | "local_workflow")
        );
        let id = text(task, "task_id");
        BackgroundTask {
            kind: if agent {
                BackgroundKind::Subagent
            } else {
                BackgroundKind::Command
            },
            tool: tasks.get(id).map_or(id, String::as_str).to_owned(),
        }
    });
    Some(Event::Background {
        tasks: live.collect(),
    })
}

/// The agent's API failed, and it tries again.
fn retry(message: &Value) -> Event {
    #[expect(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "a count and a delay: whole, and none below zero"
    )]
    let count = |key| number(message, key).unwrap_or(0.0) as u64;
    Event::Retry {
        attempt: u32::try_from(count("attempt")).unwrap_or(u32::MAX),
        delay_ms: count("retry_delay_ms"),
        error: words(message, "error").unwrap_or("unknown").to_owned(),
    }
}
