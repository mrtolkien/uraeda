//! The sandbox's agent: the fake runtime, registered as `fake`, `claude`, and `codex`, each with
//! its own mark, so the sample sessions show every agent's and no agent of the machine runs. It
//! answers every message with a canned reply, streamed as a real agent's; a message that asks
//! for it `slowly` with a long reply streamed over a minute, and one `at length` with a reply eight
//! times as long, about 12,000 words, in the same minute, as the web benchmark streams; and a
//! workflow's message with a turn at work, tool calls and sub-agents for twelve hours. It runs nothing, and changes no file.

use std::sync::Arc;
use std::time::{Duration, SystemTime};

use serde_json::{Value, json};
use uraeda_protocol::{AccountState, AccountWindow};

use crate::Failure;
use crate::runtimes::fake::{Fake, Script, Step};
use crate::runtimes::{self, Account, Outgoing};
use crate::shared::Shared;

/// The reply to any message.
pub const CANNED_REPLY: &str = "This is the sandbox's fake agent: it answers every message with \
                                this text, and changes no file.";

/// The word in a message that asks for the long reply, streamed slowly.
pub const SLOWLY: &str = "slowly";

/// The words in a message that ask for the very long reply, 40 times a usual one, as the spike
/// measured a phone's browser with.
pub const AT_LENGTH: &str = "at length";
/// How long the canned reply streams, and the long one.
const REPLY: Duration = Duration::from_secs(3);
const SLOW_REPLY: Duration = Duration::from_secs(60);

/// How long a turn at work streams tool calls, and each call runs: as long as a sandbox is open
/// in a day, so a session at work stays at work.
const AT_WORK: Duration = Duration::from_secs(12 * 60 * 60);
const AT_WORK_CALL: Duration = Duration::from_secs(15);

/// The runtimes the agent is registered as, `fake` first, which new sessions run on, each with
/// its name and its mark.
const KINDS: [(&str, &str, &str); 3] = [
    ("fake", "Fake agent", "uraeda:harness-agent"),
    ("claude", "Claude Code", "uraeda:harness-claude"),
    ("codex", "Codex", "uraeda:harness-openai"),
];

/// Registers the sandbox's agent under each of its names, in place of the built-ins.
pub(crate) fn register(shared: &Shared) -> Result<(), Failure> {
    for (name, title, icon) in KINDS {
        let fake = Fake::new();
        fake.set(|behaviour| {
            behaviour.name = title.to_owned();
            behaviour.icon = icon.to_owned();
            behaviour.reports_runs_on = true;
            // It never says a message was taken back, which a take-back waits for: a message
            // sent during a turn waits for the next.
            behaviour.capabilities.steer = false;
            behaviour.capabilities.take_back = false;
            if name == "claude" {
                behaviour.accounts = accounts(shared.now());
                behaviour.account_problems = vec![
                    "account b is signed out, in /sandbox/.claude-b".to_owned(),
                    "account d has no folder at /sandbox/.claude-d".to_owned(),
                ];
            }
        });
        fake.fallback(|message| Some(answer(message)));
        let registered = runtimes::register(shared, name, Arc::new(fake))?;
        // Registered for as long as the server runs.
        std::mem::forget(registered);
    }
    Ok(())
}

/// The turn the agent plays for a message.
fn answer(message: &Outgoing) -> Script {
    if message.text.starts_with("/uraeda ") {
        return at_work();
    }
    if message.text.to_lowercase().contains(AT_LENGTH) {
        return Script::reply(&long_reply().repeat(8), SLOW_REPLY);
    }
    if message.text.to_lowercase().contains(SLOWLY) {
        return Script::reply(&long_reply(), SLOW_REPLY);
    }
    Script::reply(CANNED_REPLY, REPLY)
}

/// The long reply: paragraphs, a list, a table, and code, about 1,500 words.
pub fn long_reply() -> String {
    let paragraph = "The sandbox streams this reply slowly, a word at a time, so a screen can be \
                     watched as a long answer grows: the transcript keeps the end in view, the \
                     blocks already drawn stay where they are, and the one that grows is the \
                     last.";
    let mut text = String::from("## A long reply\n\n");
    for part in 1..=12 {
        text.push_str(&format!("### Part {part}\n\n{paragraph}\n\n"));
        text.push_str("- a first point, short\n- a second point, which runs a little longer\n\n");
        if part % 4 == 0 {
            text.push_str("| Step | Reads | Writes |\n| --- | --- | --- |\n");
            text.push_str(
                "| Discovery | The proposal | The round |\n| Spec | The answers | The spec |\n\n",
            );
            text.push_str("```rust\nfn main() {\n    println!(\"streamed\");\n}\n```\n\n");
        }
    }
    text
}

/// A tool call of a turn at work.
struct Call {
    kind: &'static str,
    name: &'static str,
    target: &'static str,
    output: &'static str,
}

/// What the turn at work cycles through: reading, searching, editing, testing.
const CALLS: [Call; 4] = [
    Call {
        kind: "read",
        name: "Read",
        target: "specs/2026-10-17-redesign-clarifications/plan.md",
        output: "The plan's current task.",
    },
    Call {
        kind: "search",
        name: "Grep",
        target: "Clarifications",
        output: "src/Clarifications.tsx",
    },
    Call {
        kind: "edit",
        name: "Edit",
        target: "src/Clarifications.tsx",
        output: "The file was updated.",
    },
    Call {
        kind: "execute",
        name: "Bash",
        target: "npm test",
        output: "Tests passed.",
    },
];

/// The sub-agents the turn at work starts first, which run to its end.
const SUBAGENTS: [&str; 3] = [
    "Review the question cards",
    "Find the callers of Clarifications",
    "Run the browser tests",
];

/// A turn at work: its sub-agents started, then a tool call every 15 seconds for
/// twelve hours, each sub-agent making one with it.
fn at_work() -> Script {
    let mut steps = Vec::new();
    for (index, description) in SUBAGENTS.iter().enumerate() {
        steps.push(event(json!({
            "type": "toolStart", "id": format!("at-work-agent-{index}"), "kind": "other",
            "name": "Agent", "input": { "description": description, "prompt": description },
            "subagent": { "description": description },
        })));
    }
    let count = AT_WORK.as_secs() / AT_WORK_CALL.as_secs();
    for index in 0..count {
        let call = &CALLS[usize::try_from(index).unwrap_or_default() % CALLS.len()];
        let id = format!("at-work-{index}");
        steps.push(tool_start(&id, call, None));
        for agent in 0..SUBAGENTS.len() {
            let parent = format!("at-work-agent-{agent}");
            let child = format!("{parent}-call-{index}");
            steps.push(tool_start(&child, &CALLS[0], Some(&parent)));
            steps.push(tool_end(&child, CALLS[0].output));
        }
        steps.push(Step::Wait(AT_WORK_CALL));
        steps.push(tool_end(&id, call.output));
    }
    for agent in 0..SUBAGENTS.len() {
        steps.push(tool_end(&format!("at-work-agent-{agent}"), "Done."));
    }
    Script(steps)
}

/// A step that is an event, from its JSON.
fn event(value: Value) -> Step {
    let read = serde_json::from_value(value).expect("a sandbox event reads");
    Step::Event(read)
}

/// A tool call's start, a sub-agent's when it has a parent.
fn tool_start(id: &str, call: &Call, parent: Option<&str>) -> Step {
    let input = json!({ "file_path": call.target });
    let mut start = json!({
        "type": "toolStart", "id": id, "kind": call.kind, "name": call.name,
        "target": call.target, "input": input,
    });
    if let Some(parent) = parent {
        start["parent"] = json!(parent);
    }
    event(start)
}

/// A tool call's end.
fn tool_end(id: &str, output: &str) -> Step {
    event(json!({ "type": "toolEnd", "id": id, "isError": false, "output": output }))
}

/// The sample accounts of Claude Code: `default` in use, `b` signed out, `c` its week used up,
/// `d` its folder missing, and `e` unused. Their folders are made up: nothing opens them.
fn accounts(now: SystemTime) -> Vec<Account> {
    let resets = |hours: u64| {
        let at = now + Duration::from_secs(hours * 3_600);
        Some(jiff::Timestamp::try_from(at).map_or_else(|_| String::new(), |at| at.to_string()))
    };
    let window = |id: &str, label: &str, used: f64, hours: Option<u64>| AccountWindow {
        id: id.to_owned(),
        label: label.to_owned(),
        resets_at: hours.and_then(resets),
        used,
    };
    let account = |name: &str, state, windows: Vec<AccountWindow>| Account {
        id: if name == "default" {
            "/sandbox/.claude".to_owned()
        } else {
            format!("/sandbox/.claude-{name}")
        },
        name: name.to_owned(),
        state,
        known: !windows.is_empty(),
        windows,
        asked_at: Some(now),
    };
    vec![
        account(
            "default",
            AccountState::Ready,
            vec![
                window("five_hour", "5h", 0.42, Some(3)),
                window("seven_day", "Week", 0.34, Some(80)),
            ],
        ),
        account("b", AccountState::SignedOut, Vec::new()),
        account(
            "c",
            AccountState::Ready,
            vec![
                window("five_hour", "5h", 0.2, Some(4)),
                window("seven_day", "Week", 1.0, Some(30)),
            ],
        ),
        account("d", AccountState::Missing, Vec::new()),
        account(
            "e",
            AccountState::Ready,
            vec![
                window("five_hour", "5h", 0.0, None),
                window("seven_day", "Week", 0.1, Some(100)),
            ],
        ),
    ]
}
