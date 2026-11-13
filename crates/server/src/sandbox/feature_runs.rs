//! The runs of the feature whose pull request is open, `PULL_REQUEST`, so a session's panels and a
//! feature's run map have something to show: its plan's session, then its build's, whose workflow
//! run read, edited, ran the tests, and started two implementers and a reviewer as sub-sessions,
//! the reviewer's title ending with the commits it reviewed, as the runner names it. Not the
//! feature at work, whose live run the sandbox starts only while it has no session.

use std::time::{Duration, SystemTime};

use serde_json::{Value, json};

use super::sample::folders::PULL_REQUEST as FEATURE;
use super::sessions::{Opening, turn};
use crate::runner::{Event, NewSession, Store};

/// A session of the feature: its parent and role for a sub-session, and its title.
struct Of<'a> {
    parent: Option<&'a str>,
    role: Option<&'a str>,
    step: Option<&'a str>,
    title: Option<&'a str>,
}

/// Writes the feature's sessions in the project at `root`, the first started at `at`.
pub(super) fn seed(store: &Store, root: &str, at: SystemTime) -> Result<(), String> {
    let minutes = |count: u64| at + Duration::from_secs(60 * count);
    let new = |of: Of<'_>, at| new_session(store, root, of, at);
    let run = |session: &str, opening, events: Vec<Value>, at| {
        // A tool's call is its start and its end, together.
        let events = events.into_iter().flat_map(|event| match event {
            Value::Array(both) => both,
            one => vec![one],
        });
        let events = events.map(serde_json::from_value);
        let events: Vec<Event> = events
            .collect::<Result<_, _>>()
            .map_err(|error| error.to_string())?;
        turn(store, session, opening, events, at).map_err(|error| error.to_string())
    };
    let spec = format!("specs/{FEATURE}/spec.md");
    let plan = format!("specs/{FEATURE}/plan.md");

    let planner = new(feature("plan"), minutes(0))?;
    let events = vec![
        tool("spec", "read", "Read", &spec),
        thought(),
        tool("plan", "edit", "Write", &plan),
    ];
    run(
        &planner,
        Opening::workflow("Write the plan.", "plan", 14),
        events,
        minutes(0),
    )?;

    let builder = new(feature("implementation"), minutes(20))?;
    let events = vec![
        tool("plan", "read", "Read", &plan),
        thought(),
        agent("task-6", "Task 6"),
        tool("wave", "other", "mcp__uraeda__review", "wave 2"),
        tool("part", "edit", "Edit", "src/shortcuts/part-0.ts"),
        tool("tests", "execute", "Bash", "npm test"),
        agent("task-7", "Task 7"),
    ];
    let opening = Opening::workflow("Build the plan's tasks.", "implementation", 46);
    run(&builder, opening, events, minutes(20))?;

    let subs = [
        ("implementer", "Task 6", 21, 17, true),
        ("reviewer", "wave 2 on 3c1f0a2..9be47d1", 39, 6, true),
        ("implementer", "Task 7", 47, 12, false),
    ];
    for (role, title, start, took, ok) in subs {
        let sub = Of {
            parent: Some(&builder),
            role: Some(role),
            step: None,
            title: Some(title),
        };
        let session = new(sub, minutes(start))?;
        let mut events = vec![
            tool("read", "read", "Read", &plan),
            tool("edit", "edit", "Edit", "src/shortcuts/part-1.ts"),
            json!({
                "type": "tokens",
                "total": { "cacheRead": 0, "cacheWrite": 0, "input": 41_200, "output": 3_100 },
            }),
        ];
        if !ok {
            events.push(json!({
                "type": "result", "ok": false, "interrupted": false, "denials": [],
                "errors": ["The tests failed: 2 of 14."],
            }));
        }
        let opening = Opening::workflow(title, "implementation", took);
        run(&session, opening, events, minutes(start))?;
    }
    Ok(())
}

/// The feature's own session at `step`.
fn feature(step: &str) -> Of<'_> {
    Of {
        parent: None,
        role: None,
        step: Some(step),
        title: None,
    }
}

fn new_session(store: &Store, root: &str, of: Of<'_>, at: SystemTime) -> Result<String, String> {
    let nanos = at
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let made = store.create_session(
        NewSession {
            repo: root.to_owned(),
            folder: Some(FEATURE.to_owned()),
            parent: of.parent.map(str::to_owned),
            role: of.role.map(str::to_owned),
            step: of.step.map(str::to_owned),
            worktree: None,
            agent: "fake".to_owned(),
            native_id: format!("sandbox-run-{nanos}"),
            title: of.title.map(str::to_owned),
            model: None,
            effort: None,
        },
        at,
    );
    made.map(|session| session.id)
        .map_err(|error| error.to_string())
}

/// A tool call that ran and ended well, by its id, kind, name, and target.
fn tool(id: &str, kind: &str, name: &str, target: &str) -> Value {
    json!([
        { "type": "toolStart", "id": id, "kind": kind, "name": name, "target": target },
        { "type": "toolEnd", "id": id, "isError": false, "output": "" },
    ])
}

/// A call of `run_agent`, whose target is its task.
fn agent(id: &str, task: &str) -> Value {
    tool(id, "other", "mcp__uraeda__run_agent", task)
}

fn thought() -> Value {
    json!({ "type": "thought", "text": "Which task goes first, and what it needs." })
}
