//! A session's process: `claude` in print mode, its stdin kept open for the session's messages.

use std::sync::{Arc, Mutex};

use futures_util::FutureExt as _;
use serde_json::{Value, json};

use super::control::Controls;
use super::events::Parser;
use super::models;
use crate::live::locked;
use crate::process::Signal;
use crate::runtimes::{AgentProcess, Child, Emitter, Events, Lines, Outgoing, When, events};
use crate::shared::Shared;

/// A session's open process.
pub(super) struct Process {
    child: Arc<Child>,
    controls: Arc<Controls>,
    emitter: Emitter,
    events: Option<Events>,
    /// The process's own list of models, once it answered: what it runs on is named from it.
    listed: Arc<Mutex<Value>>,
}

impl Process {
    /// Reads a started process: its lines become events as they come, and it is asked what it
    /// runs on.
    pub(super) fn start(shared: &Shared, mut child: Child, parser: Parser) -> Process {
        let lines = child.lines();
        let child = Arc::new(child);
        let controls = Arc::new(Controls::new(child.clone()));
        let (emitter, stream) = events();
        let reader = Reader {
            shared: shared.clone(),
            parser,
            controls: controls.clone(),
            emitter: emitter.clone(),
        };
        tokio::spawn(reader.run(lines, child.clone()));
        let process = Process {
            child,
            controls,
            emitter,
            events: Some(stream),
            listed: Arc::default(),
        };
        process.list();
        process
    }

    /// Asks the process for its models, then for what it runs on, by their names: once, as it
    /// opens.
    fn list(&self) {
        let asked = self.controls.ask(json!({ "subtype": "list_models" }));
        let (listed, report) = (self.listed.clone(), self.reporter());
        tokio::spawn(async move {
            if let Ok(list) = asked.answer().await {
                *locked(&listed) = list;
            }
            report();
        });
    }

    /// What asks the process what it runs on, and says it as an event once it answered.
    fn reporter(&self) -> impl FnOnce() + Send + 'static {
        let (controls, listed) = (self.controls.clone(), self.listed.clone());
        let emitter = self.emitter.clone();
        move || {
            let asked = controls.ask(json!({ "subtype": "get_settings" }));
            tokio::spawn(async move {
                let Ok(settings) = asked.answer().await else {
                    return;
                };
                let runs_on = models::runs_on(&locked(&listed), &settings);
                if let Some(event) = runs_on {
                    emitter.send(event);
                }
            });
        }
    }
}

/// What reads a process's output into its events.
struct Reader {
    shared: Shared,
    parser: Parser,
    controls: Arc<Controls>,
    emitter: Emitter,
}

impl Reader {
    /// Reads the lines as they come, whether or not the events are: Claude Code loses its last
    /// lines when they are read slowly. The process's `exit` ends them.
    async fn run(mut self, mut lines: Lines, child: Arc<Child>) {
        let exited = child.exited();
        tokio::pin!(exited);
        let exit = loop {
            tokio::select! {
                biased;
                line = lines.next() => match line {
                    Some(line) => self.line(&line),
                    None => break exited.await,
                },
                // It ended, and something it started still holds its output open: what it
                // printed is read, and what may come is not waited for.
                exit = &mut exited => {
                    while let Some(Some(line)) = lines.next().now_or_never() {
                        self.line(&line);
                    }
                    break exit;
                }
            }
        };
        self.controls.end("Claude Code exited");
        self.emitter.send(exit);
    }

    /// A line: the answer to a control request, or the events it makes.
    fn line(&mut self, line: &str) {
        if self.controls.answer(line) {
            return;
        }
        for event in self.parser.line(line, self.shared.now()) {
            self.emitter.send(event);
        }
    }
}

impl AgentProcess for Process {
    fn events(&mut self) -> Events {
        self.events.take().unwrap_or_else(Events::ended)
    }

    fn send(&self, message: Outgoing) {
        let priority = match message.when {
            When::Steer => "next",
            When::Queue => "later",
        };
        self.child.write(&json!({
            "type": "user",
            "uuid": message.id,
            "priority": priority,
            "message": { "role": "user", "content": content(&message) },
        }));
    }

    fn interrupt(&self) {
        self.controls.send(json!({ "subtype": "interrupt" }));
    }

    fn kill(&self, signal: Signal) {
        self.child.signal(signal);
    }

    fn take_back(&self, id: &str) {
        let request = json!({ "subtype": "cancel_async_message", "message_uuid": id });
        self.controls.send(request);
    }

    /// From its next turn on: the sessions call it between turns only.
    fn set_effort(&self, effort: Option<&str>) -> bool {
        if self.emitter.has_exited() {
            return false;
        }
        let settings = json!({ "effortLevel": effort });
        let request = json!({ "subtype": "apply_flag_settings", "settings": settings });
        // Its answer says nothing: what the process runs on then does.
        drop(self.controls.ask(request));
        (self.reporter())();
        true
    }

    fn close(&self) {
        self.child.end_input();
    }
}

/// A process nobody holds ends as a closed one does.
impl Drop for Process {
    fn drop(&mut self) {
        self.child.end_input();
    }
}

/// A message as Claude Code reads it: its text, then a blank line and one `[Image: <path>]`
/// line per image, which the agent opens with its Read tool.
fn content(message: &Outgoing) -> String {
    let images = message.images.iter();
    let lines: Vec<String> = images
        .map(|image| format!("[Image: {}]", image.path.display()))
        .collect();
    let lines = lines.join("\n");
    match (message.text.is_empty(), lines.is_empty()) {
        (_, true) => message.text.clone(),
        (true, false) => lines,
        (false, false) => format!("{}\n\n{lines}", message.text),
    }
}
