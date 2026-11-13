//! What Claude Code is asked in short processes, which spend no usage: the models it lists, and
//! an account's state and usage, `claude auth status` and its `get_usage` control request.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{Value, json};

use super::accounts::{Asked, folder_env};
use super::args;
use super::control::Controls;
use super::json::{field, number, string};
use crate::live::wait;
use crate::runner::Event;
use crate::runtimes::{AccountState, AccountWindow, Child, Spawn};
use crate::shared::Shared;

/// A short process gives up after this long.
pub(super) const SHORT_TIMEOUT: Duration = Duration::from_secs(10);

/// What a short process is asked for: `did` completes "Claude Code did not ... within 10
/// seconds", and `exited` completes "Claude Code exited before ...".
pub(super) struct Words {
    pub did: &'static str,
    pub exited: &'static str,
}

/// Starts `command` as a short process in `cwd`, with `env` added, writes each request as a
/// control request, and gives their answers' payloads in order: an error on the agent's, on its
/// exit, or when it has not answered within 10 seconds. It is ended as it is done with.
pub(super) async fn short(
    shared: &Shared,
    spawn: Spawn,
    requests: Vec<Value>,
    words: &Words,
) -> Result<Vec<Value>, String> {
    let mut child = Child::spawn(shared, spawn);
    let mut lines = child.lines();
    let child = Arc::new(child);
    let controls = Arc::new(Controls::new(child.clone()));
    let (reading, answers) = (child.clone(), controls.clone());
    let exited = words.exited;
    tokio::spawn(async move {
        while let Some(line) = lines.next().await {
            answers.answer(&line);
        }
        answers.end(&ended(&reading.exited().await, exited));
    });
    let asking = async {
        let mut answers = Vec::new();
        for request in requests {
            answers.push(controls.ask(request).answer().await?);
        }
        Ok(answers)
    };
    let answered = tokio::time::timeout(SHORT_TIMEOUT, asking).await;
    child.end_short();
    let seconds = SHORT_TIMEOUT.as_secs();
    let slow = format!("Claude Code did not {} within {seconds} seconds", words.did);
    answered.unwrap_or(Err(slow))
}

/// Why a short process that ended answered nothing.
fn ended(exit: &Event, before: &str) -> String {
    match exit {
        Event::Exit {
            missing: Some(true),
            stderr,
            ..
        } => format!("Claude Code is not available: {stderr}"),
        Event::Exit { stderr, .. } if !stderr.is_empty() => {
            format!("Claude Code exited before {before}: {stderr}")
        }
        _ => format!("Claude Code exited before {before}"),
    }
}

/// The windows Claude Code names, shortest first, as an account's are.
const WINDOWS: [(&str, &str); 2] = [("five_hour", "5h"), ("seven_day", "Week")];

/// The windows of a `get_usage` answer, the share used as a fraction of one: none when it
/// gives no five-hour window, as a signed-out folder's does, so the first window is always the
/// five hours. A window not open has no reset.
pub(super) fn usage_windows(answer: &Value) -> Option<Vec<AccountWindow>> {
    let limits = field(answer, "rate_limits").filter(|limits| limits.is_object())?;
    let windows: Vec<AccountWindow> = WINDOWS
        .iter()
        .filter_map(|(id, label)| {
            let window = field(limits, id)?;
            let used = number(window, "utilization")? / 100.0;
            let resets = string(window, "resets_at").and_then(crate::runtimes::accounts::instant);
            let resets_at = resets.map(uraeda_core::today::rfc3339);
            Some(AccountWindow {
                id: (*id).to_owned(),
                label: (*label).to_owned(),
                resets_at,
                used,
            })
        })
        .collect();
    (windows.first()?.id == WINDOWS[0].0).then_some(windows)
}

/// Whether `claude auth status --json` says the folder is signed out: an error when it says
/// nothing within 10 seconds. A signed-out folder exits 1, with its answer on stdout.
async fn signed_out(
    shared: &Shared,
    command: &str,
    home: &Path,
    folder: &str,
) -> Result<bool, String> {
    let mut status = shared.environment().command(command);
    status
        .args(["auth", "status", "--json"])
        .envs(folder_env(folder, home))
        .current_dir(home);
    let printed = crate::process::output(status, SHORT_TIMEOUT).await;
    let seconds = SHORT_TIMEOUT.as_secs();
    let slow =
        || format!("Claude Code did not give its authentication status within {seconds} seconds");
    let printed = printed
        .ok_or_else(slow)?
        .map_err(|error| error.to_string())?;
    let read: Value = serde_json::from_slice(&printed.stdout).map_err(|_| {
        let stderr = String::from_utf8_lossy(&printed.stderr).trim().to_owned();
        if stderr.is_empty() {
            "Claude Code gave no authentication status".to_owned()
        } else {
            stderr
        }
    })?;
    Ok(field(&read, "loggedIn") == Some(&Value::Bool(false)))
}

/// The ask of one account's folder: its status and its usage at once, from the home folder,
/// with the folder as `CLAUDE_CONFIG_DIR` unless it is the default one. Signed out wins; a
/// usage with a five-hour window is a signed-in account's, whatever the status said; a status
/// that says nothing and a usage with no windows are an error: the account stays as it was.
pub(super) fn ask(
    shared: &Shared,
    command: &str,
    home: &Path,
    folder: &str,
) -> Result<Asked, String> {
    let spawn = Spawn {
        program: command.to_owned(),
        args: args::MODELS.map(str::to_owned).to_vec(),
        cwd: home.to_owned(),
        env: folder_env(folder, home),
    };
    let words = Words {
        did: "give its usage",
        exited: "giving its usage",
    };
    let usage = short(
        shared,
        spawn,
        vec![json!({ "subtype": "get_usage" })],
        &words,
    );
    let (signed, usage) =
        wait(async { tokio::join!(signed_out(shared, command, home, folder), usage) });
    if signed == Ok(true) {
        return Ok(Asked {
            state: AccountState::SignedOut,
            windows: None,
        });
    }
    let windows = usage
        .ok()
        .and_then(|answers| usage_windows(answers.first()?));
    match (windows, signed) {
        (Some(windows), _) => Ok(Asked {
            state: AccountState::Ready,
            windows: Some(windows),
        }),
        (None, Err(why)) => Err(why),
        (None, Ok(_)) => Ok(Asked {
            state: AccountState::Ready,
            windows: None,
        }),
    }
}
