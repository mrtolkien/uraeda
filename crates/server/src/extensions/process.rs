//! `uraeda:process`: the commands an extension runs, each a [`Child`] as an agent's is: in the
//! server's environment, leading a process group of its own, and ended with everything it
//! started.
//!
//! Each belongs to the VM that started it. When the VM ends, however it ends, every one still
//! running is asked to end, and killed 5 seconds later.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::{Value, json};
use tokio::task::JoinHandle;

use super::vm::Vm;
use crate::runner::Event;
use crate::runtimes::{Child, Signal, Spawn};
use crate::shared::Shared;

/// The processes one VM started.
pub(super) struct Processes {
    shared: Shared,
    /// The folder a command runs in when the extension names none: its own.
    folder: PathBuf,
    running: HashMap<u64, Running>,
}

/// A process, and the task that hands its output to the VM.
struct Running {
    child: Arc<Child>,
    forward: JoinHandle<()>,
}

/// What `spawn` takes.
#[derive(Deserialize)]
struct Asked {
    id: u64,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: HashMap<String, String>,
}

impl Processes {
    pub(super) fn new(shared: &Shared, folder: PathBuf) -> Processes {
        Processes {
            shared: shared.clone(),
            folder,
            running: HashMap::new(),
        }
    }

    /// Runs the operation `process.<op>`.
    pub(super) fn op(&mut self, vm: &Vm, op: &str, payload: Value) -> Result<Value, String> {
        if op == "spawn" {
            return self.spawn(vm, payload);
        }
        let id = payload["id"].as_u64().unwrap_or_default();
        // One that exited takes nothing more, as an agent's process.
        let Some(running) = self.running.get(&id) else {
            return Ok(Value::Null);
        };
        match op {
            "write" => running.child.write(&payload["value"]),
            "end" => running.child.end_input(),
            "kill" => running.child.signal(signal(&payload["signal"])?),
            _ => return Err(format!("uraeda:process has no `{op}`")),
        }
        Ok(Value::Null)
    }

    /// Starts a command, and hands the VM each line of its output, then its exit.
    fn spawn(&mut self, vm: &Vm, payload: Value) -> Result<Value, String> {
        let asked: Asked =
            serde_json::from_value(payload).map_err(|error| format!("uraeda:process: {error}"))?;
        self.running
            .retain(|_, running| !running.forward.is_finished());
        let mut child = Child::spawn(
            &self.shared,
            Spawn {
                program: asked.command,
                args: asked.args,
                cwd: asked.cwd.map_or_else(|| self.folder.clone(), PathBuf::from),
                env: asked.env.into_iter().collect(),
            },
        );
        let (mut lines, pid, id) = (child.lines(), child.leader(), asked.id);
        let child = Arc::new(child);
        let (told, exiting) = (vm.clone(), child.clone());
        let forward = tokio::spawn(async move {
            while let Some(line) = lines.next().await {
                told.dispatch("process.line", json!({ "id": id, "line": line }));
            }
            let exit = exiting.exited().await;
            told.dispatch("process.exit", exited(id, exit));
        });
        self.running.insert(id, Running { child, forward });
        Ok(json!({ "pid": pid }))
    }

    /// Ends every process still running: its VM is gone, and nothing reads it any more.
    pub(super) fn release(&mut self) {
        for (_, running) in self.running.drain() {
            running.forward.abort();
            running.child.end_short();
        }
    }
}

/// A process's exit, as its `exited` resolves to.
fn exited(id: u64, exit: Event) -> Value {
    let Event::Exit {
        code,
        missing,
        stderr,
    } = exit
    else {
        return json!({ "id": id, "code": null, "missing": false, "stderr": "" });
    };
    let missing = missing.unwrap_or_default();
    json!({ "id": id, "code": code, "missing": missing, "stderr": stderr })
}

fn signal(name: &Value) -> Result<Signal, String> {
    let signals = [Signal::Interrupt, Signal::Terminate, Signal::Kill];
    let named = name.as_str().unwrap_or_default();
    let found = signals.into_iter().find(|signal| signal.name() == named);
    found.ok_or_else(|| "a signal is SIGINT, SIGTERM, or SIGKILL".to_owned())
}
