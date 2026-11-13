//! The turns of one Codex thread, as its process runs them: a message starts a turn when none
//! runs, joins the running one through `turn/steer`, or waits in the runtime's own queue for
//! the next one, where it can be taken back. Codex's `turn/start` and `turn/steer` taking a
//! message is the agent reading it, `accepted`.

use std::collections::HashSet;

use serde_json::json;

use super::process::{Pending, Session};
use super::rpc::Answer;
use super::thread;
use crate::runner::Event;
use crate::runtimes::{Outgoing, When};

/// The session's thread, which its process starts or resumes as it opens.
pub(super) enum Thread {
    /// Not started yet: a turn's start waits for it.
    Starting,
    /// Started, with the agent's default effort when its models were read.
    Started {
        id: String,
        default_effort: Option<String>,
    },
    /// It did not start: the process reported why, and runs no turn.
    Failed,
}

/// What a process keeps of its turns.
pub(super) struct Turns {
    /// Whether a turn runs, from its `turn/start` until its end.
    running: bool,
    /// Whether the last turn ended well: after one that did not, the sessions take back the
    /// rest.
    last_ok: bool,
    /// The running turn's id, once `turn/start` answered.
    turn_id: Option<String>,
    /// Counts the turns started, so a late answer of an ended turn changes nothing.
    started: u64,
    pub(super) thread: Thread,
    /// The message whose turn starts once the thread did.
    awaiting: Option<Outgoing>,
    /// The messages waiting for the next turn, or for the running one's id to steer.
    queue: Vec<Outgoing>,
    /// The messages whose `turn/steer` is unanswered, and those of them taken back meanwhile.
    steering: HashSet<String>,
    taken_back: HashSet<String>,
    /// An interrupt asked before the running turn's id was known.
    stop: bool,
    pub(super) closing: bool,
    /// The effort of the next turns: none for the agent's default.
    pub(super) effort: Option<String>,
    /// Whether the thread may hold an effort other than the default, which Codex keeps for the
    /// turns after it: once a turn was given one, and from the start for a resumed thread,
    /// which keeps the effort it last ran on.
    overridden: bool,
}

impl Turns {
    /// The turns of a thread opened on an effort, resumed or new: a new thread on an effort
    /// starts on it.
    pub(super) fn new(effort: Option<String>, resumed: bool) -> Turns {
        Turns {
            running: false,
            last_ok: true,
            turn_id: None,
            started: 0,
            thread: Thread::Starting,
            awaiting: None,
            queue: Vec::new(),
            steering: HashSet::new(),
            taken_back: HashSet::new(),
            stop: false,
            closing: false,
            overridden: resumed || effort.is_some(),
            effort,
        }
    }

    /// The effort to give a turn: the agent's default again once another was given.
    fn turn_effort(&mut self) -> Option<String> {
        if self.effort.is_some() {
            self.overridden = true;
            return self.effort.clone();
        }
        match &self.thread {
            Thread::Started { default_effort, .. } if self.overridden => default_effort.clone(),
            _ => None,
        }
    }

    fn thread_id(&self) -> Option<String> {
        match &self.thread {
            Thread::Started { id, .. } => Some(id.clone()),
            Thread::Starting | Thread::Failed => None,
        }
    }
}

impl Session {
    /// Sends a message: it starts a turn, joins the running one, or waits for the next.
    pub(super) fn send(&mut self, message: Outgoing) {
        let turns = &mut self.turns;
        if !turns.running {
            self.start_turn(message);
        } else if let (When::Steer, Some(turn)) = (message.when, turns.turn_id.clone()) {
            self.steer(message, &turn);
        } else {
            turns.queue.push(message);
        }
    }

    /// Removes a message waiting in the queue, or one being steered should Codex refuse it.
    pub(super) fn take_back(&mut self, id: &str) {
        let turns = &mut self.turns;
        if let Some(index) = turns.queue.iter().position(|message| message.id == id) {
            turns.queue.remove(index);
            self.push(Event::Cancelled { id: id.to_owned() });
        } else if turns.steering.contains(id) {
            turns.taken_back.insert(id.to_owned());
        }
    }

    /// Ends the running turn through Codex's own interrupt: as soon as its id is known.
    pub(super) fn interrupt(&mut self) {
        let turns = &mut self.turns;
        if !turns.running {
            return;
        }
        let (Some(turn), Some(thread)) = (turns.turn_id.clone(), turns.thread_id()) else {
            turns.stop = true;
            return;
        };
        let params = json!({ "threadId": thread, "turnId": turn });
        self.request("turn/interrupt", params, Pending::Interrupt);
    }

    /// Ends the process once no turn runs.
    pub(super) fn close(&mut self) {
        self.turns.closing = true;
        if !self.turns.running {
            self.end_input();
        }
    }

    /// The running turn ended, as its `turn/completed` or a refused `turn/start` says: a turn
    /// that ended well starts the next message waiting, and a closing process ends.
    pub(super) fn turn_ended(&mut self, ok: bool) {
        let turns = &mut self.turns;
        turns.running = false;
        turns.last_ok = ok;
        turns.turn_id = None;
        turns.stop = false;
        if turns.closing {
            self.end_input();
            return;
        }
        // After a failed or stopped turn, the sessions take back what is left.
        if ok && !turns.queue.is_empty() {
            let next = turns.queue.remove(0);
            self.start_turn(next);
        }
    }

    /// Starts a turn on a message, once the thread started.
    fn start_turn(&mut self, message: Outgoing) {
        let turns = &mut self.turns;
        turns.running = true;
        turns.last_ok = true;
        turns.turn_id = None;
        turns.started += 1;
        if matches!(turns.thread, Thread::Starting) {
            turns.awaiting = Some(message);
        } else {
            self.ask_turn(&message);
        }
    }

    /// The thread started, or failed to: the turn that waited for it goes on.
    pub(super) fn thread_settled(&mut self) {
        if let Some(message) = self.turns.awaiting.take() {
            self.ask_turn(&message);
        }
    }

    /// Asks Codex for the turn of a message, or its review: a review runs on the thread's
    /// effort, which the thread started on.
    fn ask_turn(&mut self, message: &Outgoing) {
        let Some(thread) = self.turns.thread_id() else {
            // The process reported why it cannot run, and closes: now, when closed meanwhile.
            self.turns.running = false;
            if self.turns.closing {
                self.end_input();
            }
            return;
        };
        let waiting = Pending::TurnStart {
            started: self.turns.started,
            id: message.id.clone(),
            review: message.review,
        };
        if message.review {
            let params = thread::review_params(message, &thread);
            self.request("review/start", params, waiting);
        } else {
            let effort = self.turns.turn_effort();
            let params = thread::turn_params(message, &thread, effort.as_deref());
            self.request("turn/start", params, waiting);
        }
    }

    /// Codex answered a turn's start: it took the message, even when its turn already
    /// completed before this answer, or refused it, which ends the turn.
    pub(super) fn turn_asked(&mut self, started: u64, id: String, review: bool, answer: Answer) {
        if started != self.turns.started {
            return;
        }
        let answer = match answer {
            Ok(answer) => answer,
            Err(why) => {
                let what = if review { "review" } else { "turn" };
                self.push(Event::Result {
                    cost_usd: None,
                    denials: Vec::new(),
                    errors: vec![format!("Codex did not start the {what}: {why}")],
                    interrupted: false,
                    models: None,
                    ok: false,
                });
                self.turn_ended(false);
                return;
            }
        };
        self.push(Event::Accepted { id });
        if !self.turns.running {
            return;
        }
        let turn = answer.get("turn").and_then(|turn| turn.get("id"));
        self.turns.turn_id = turn.and_then(|id| id.as_str()).map(str::to_owned);
        if self.turns.stop {
            self.turns.stop = false;
            self.interrupt();
            return;
        }
        // The messages that came meanwhile join it.
        for waiting in std::mem::take(&mut self.turns.queue) {
            self.send(waiting);
        }
    }

    /// Joins the running turn.
    fn steer(&mut self, message: Outgoing, turn: &str) {
        let Some(thread) = self.turns.thread_id() else {
            self.turns.queue.push(message);
            return;
        };
        self.turns.steering.insert(message.id.clone());
        let input = thread::input(&message);
        let params = json!({ "expectedTurnId": turn, "input": input, "threadId": thread });
        self.request("turn/steer", params, Pending::Steer(message));
    }

    /// Codex answered a steer. Refused, as when the turn ended meanwhile, the message waits
    /// for the next turn, or starts it, unless it was taken back. After a turn that did not
    /// end well, or while closing, it only waits: the sessions take it back, as they do what
    /// that turn left.
    pub(super) fn steered(&mut self, message: Outgoing, answer: &Answer) {
        let id = message.id.clone();
        let turns = &mut self.turns;
        turns.steering.remove(&id);
        let taken_back = turns.taken_back.remove(&id);
        if answer.is_ok() {
            self.push(Event::Accepted { id });
        } else if taken_back {
            self.push(Event::Cancelled { id });
        } else if turns.running || !turns.last_ok || turns.closing {
            turns.queue.push(message);
        } else {
            self.start_turn(message);
        }
    }
}
