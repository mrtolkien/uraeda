//! How a session's process starts: it introduces the client, gives Codex the skill folders,
//! reads the model names for what the thread runs on and the agent's default effort, then
//! starts or resumes the thread, within the time a start may take.

use std::time::Duration;

use serde_json::json;

use super::json::filled;
use super::models::{Listed, Listing, Next, config_of, models};
use super::permissions::{applied_problem, git_main_root, trust};
use super::process::{Pending, Session};
use super::rpc::{Answer, Rpc};
use super::thread::thread_params;
use super::turns::Thread;
use crate::runner::Event;
use crate::runtimes::Signal;

/// Where a process is of its start: introducing the client, giving the skill folders, reading
/// the model names, then starting or resuming the thread.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Step {
    Initialize,
    Skills,
    Models,
    Thread,
    /// The thread started, or the start failed.
    Over,
}

impl Session {
    /// Introduces the client, asking for the experimental API.
    pub(super) fn begin(&mut self) {
        let params = json!({
            "capabilities": { "experimentalApi": true, "requestAttestation": false },
            "clientInfo": { "name": "uraeda", "title": "Uraeda", "version": "1" },
        });
        self.request("initialize", params, Pending::Initialize);
    }

    /// Codex took the client: it is told so, and given the skill folders it reads besides its
    /// own, Uraeda's, then the extensions'.
    pub(super) fn introduced(&mut self, answer: Answer) {
        if let Err(why) = answer {
            return self.fail_start(&why);
        }
        if self.step != Step::Initialize {
            return;
        }
        self.wire.write(Rpc::<Pending>::notify("initialized"));
        self.step = Step::Skills;
        let own = std::iter::once(&self.setup.folders.skills);
        let roots: Vec<&std::path::PathBuf> = own.chain(&self.options.skills).collect();
        let params = json!({ "extraRoots": roots });
        self.request("skills/extraRoots/set", params, Pending::Skills);
    }

    /// Reads the model names, for what the thread runs on, and the agent's default effort.
    pub(super) fn skills_given(&mut self, answer: Answer) {
        if let Err(why) = answer {
            return self.fail_start(&why);
        }
        if self.step != Step::Skills {
            return;
        }
        self.step = Step::Models;
        let (list, config) = Listing::asks();
        self.request("model/list", list, Pending::Page);
        self.request("config/read", config, Pending::Config);
    }

    pub(super) fn listed(&mut self, next: Next) {
        if self.step != Step::Models {
            return;
        }
        match next {
            Next::Wait => {}
            Next::Page(params) => self.request("model/list", params, Pending::Page),
            Next::Done(listed) => self.start_thread(Some(&listed)),
            // Without the names, what it runs on shows by ids.
            Next::Failed(_) => self.start_thread(None),
        }
    }

    /// Starts or resumes the thread, with the trust Codex's settings give its directory:
    /// unread settings give none, and Codex then decides it, and may write it.
    fn start_thread(&mut self, listed: Option<&Listed>) {
        let cwd = &self.options.cwd;
        let trusted = listed.map(|listed| {
            let mut config = config_of(&listed.config);
            let level = trust(cwd, git_main_root(cwd).as_deref(), config.get("projects"));
            // The session's model's defaults, the configured effort first.
            if let Some(model) = &self.options.model {
                config["model"] = json!(model);
            }
            (models(&listed.rows, &config), level)
        });
        if let Some((list, _)) = &trusted {
            for model in &list.models {
                self.reader.name(&model.id, &model.name);
            }
            self.default_effort.clone_from(&list.defaults.effort);
        }
        let level = trusted.as_ref().map(|(_, level)| level.as_str());
        let instructions = self.setup.instructions();
        let params = thread_params(&self.options, &instructions, level);
        self.step = Step::Thread;
        self.request(self.method(), params, Pending::Thread);
    }

    fn method(&self) -> &'static str {
        if self.options.resume {
            "thread/resume"
        } else {
            "thread/start"
        }
    }

    /// The thread's answer: its id, and what it runs on, which reach the transcript at its
    /// start, even when Codex does not report them, as on resume. Codex's settings could still
    /// widen what it was asked for: it runs only as asked.
    pub(super) fn thread_answered(&mut self, answer: Answer) {
        if self.step != Step::Thread {
            return;
        }
        let answer = match answer {
            Ok(answer) => answer,
            Err(why) => return self.fail_start(&why),
        };
        let thread = answer.get("thread");
        let Some(id) = thread.and_then(|thread| filled(thread, "id")) else {
            return self.fail_start(&format!("{} gave no thread", self.method()));
        };
        if let Some(problem) = applied_problem(&answer) {
            return self.fail_start(&problem);
        }
        self.step = Step::Over;
        let mut started = json!({ "id": id });
        for key in ["model", "reasoningEffort"] {
            if let Some(value) = filled(&answer, key) {
                started[key] = json!(value);
            }
        }
        for event in self
            .reader
            .read("thread/started", &json!({ "thread": started }))
        {
            self.push(event);
        }
        self.turns.thread = Thread::Started {
            id: id.to_owned(),
            default_effort: self.default_effort.take(),
        };
        self.thread_settled();
    }

    /// The start failed: the process says why, unless it was closed meanwhile, and runs no
    /// turn.
    fn fail_start(&mut self, why: &str) {
        if self.step == Step::Over {
            return;
        }
        self.step = Step::Over;
        if !self.turns.closing {
            self.push(Event::Init {
                session_id: String::new(),
                problem: Some(format!("Codex did not start the session: {why}")),
            });
        }
        self.turns.thread = Thread::Failed;
        self.thread_settled();
    }

    /// The start took longer than it may: a Codex that never answers fails the turn instead of
    /// holding it, and its process is killed.
    pub(super) fn late(&mut self, after: Duration) {
        if self.step == Step::Over {
            return;
        }
        let seconds = after.as_secs_f64();
        self.fail_start(&format!("Codex did not answer within {seconds} seconds"));
        self.wire.signal(Signal::Kill);
        self.settle();
    }
}
