//! Claude Code's control requests, as a process writes them and reads their answers.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};
use tokio::sync::oneshot;

use super::json::{self, string, words};
use crate::live::locked;
use crate::runtimes::Child;
use crate::secret;

/// The answer to a control request: its payload, or the agent's error.
type Answer = Result<Value, String>;

/// A process's control requests, and the answers it waits for, by their ids.
pub(super) struct Controls {
    child: Arc<Child>,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    waiting: HashMap<String, oneshot::Sender<Answer>>,
    /// Why no request is answered any more, once the process ended.
    ended: Option<String>,
}

impl Controls {
    /// The control requests of a process.
    pub(super) fn new(child: Arc<Child>) -> Controls {
        Controls {
            child,
            state: Mutex::default(),
        }
    }

    /// Writes a request, its answer unread.
    pub(super) fn send(&self, request: Value) {
        self.write(&request, &secret::random(12));
    }

    /// Writes a request at once, and gives what waits for its answer's payload: the agent's
    /// error, or why the process ended, when it gives none.
    pub(super) fn ask(&self, request: Value) -> Asked {
        let (answer, asked) = oneshot::channel();
        let id = secret::random(12);
        {
            let mut state = locked(&self.state);
            if let Some(why) = &state.ended {
                let _ = answer.send(Err(why.clone()));
                return Asked(asked);
            }
            state.waiting.insert(id.clone(), answer);
        }
        self.write(&request, &id);
        Asked(asked)
    }

    fn write(&self, request: &Value, id: &str) {
        let line = json!({ "type": "control_request", "request_id": id, "request": request });
        self.child.write(&line);
    }

    /// Gives a line to the request it answers: false when it is no answer.
    pub(super) fn answer(&self, line: &str) -> bool {
        let Some((id, answer)) = control_answer(line) else {
            return false;
        };
        if let Some(waiting) = locked(&self.state).waiting.remove(&id) {
            let _ = waiting.send(answer);
        }
        true
    }

    /// Fails the requests waiting, and those asked from now on, with why.
    pub(super) fn end(&self, why: &str) {
        let mut state = locked(&self.state);
        state.ended.get_or_insert_with(|| why.to_owned());
        for (_, waiting) in state.waiting.drain() {
            let _ = waiting.send(Err(why.to_owned()));
        }
    }
}

/// A request that was written, and waits for its answer.
pub(super) struct Asked(oneshot::Receiver<Answer>);

impl Asked {
    /// The answer's payload, or why there is none.
    pub(super) async fn answer(self) -> Answer {
        let answer = self.0.await;
        answer.unwrap_or_else(|_| Err("Claude Code exited".to_owned()))
    }
}

/// The answer a `control_response` line carries, with its request's id: none for other lines.
fn control_answer(line: &str) -> Option<(String, Answer)> {
    if !line.contains("\"control_response\"") {
        return None;
    }
    let message = json::read(line)?;
    if string(&message, "type") != Some("control_response") {
        return None;
    }
    let response = message.as_object()?.get("response")?;
    response.as_object()?;
    let id = string(response, "request_id")?.to_owned();
    let answer = if string(response, "subtype") == Some("success") {
        Ok(response.get("response").cloned().unwrap_or_default())
    } else {
        Err(words(response, "error").unwrap_or("Refused").to_owned())
    };
    Some((id, answer))
}
