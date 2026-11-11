//! Codex's short commands, each run to its end within a time: `codex --version`, and
//! `codex debug models`.

use std::time::Duration;

use crate::runner::Event;
use crate::runtimes::{Child, Spawn};
use crate::shared::Shared;

/// Runs a command to its end, and gives what it printed, its lines joined.
///
/// # Errors
///
/// Why it printed nothing to rely on: it could not start, it failed, with the end of what it
/// wrote to its stderr, or it took longer than `within`, and was ended.
pub(super) async fn run(shared: &Shared, spawn: Spawn, within: Duration) -> Result<String, String> {
    let name = format!("{} {}", spawn.program, spawn.args.join(" "));
    let mut child = Child::spawn(shared, spawn);
    let mut lines = child.lines();
    let output = async {
        let mut printed = Vec::new();
        while let Some(line) = lines.next().await {
            printed.push(line);
        }
        (printed.join("\n"), child.exited().await)
    };
    let Ok((printed, exit)) = tokio::time::timeout(within, output).await else {
        child.end_short();
        let seconds = within.as_secs_f64();
        return Err(format!("{name} did not end within {seconds} seconds"));
    };
    match exit {
        Event::Exit { code: Some(0), .. } => Ok(printed),
        Event::Exit { stderr, .. } if !stderr.is_empty() => Err(format!("{name} failed: {stderr}")),
        _ => Err(format!("{name} failed")),
    }
}
