//! The check of a reply that ended and waits for its background tasks: a command that never
//! ends would hold its turn forever, and its parent's `run_agent` call with it. Only the agent
//! can tell a long build from one that is stuck, so it is asked first.

use super::*;
use crate::runner::manager::UNANSWERED;
use crate::runner::message::{quiet_check, waiting_label};

impl Runner {
    /// Arms the running turn's check, which looks at it after `wait`: `quiet`.
    pub(in crate::runner) fn ask_after(&self, state: &mut State, session: &str, wait: Duration) {
        let (closed, owner) = (state.closed, session.to_owned());
        let Some(turn) = state.lives.get(session).and_then(|live| live.turn.as_mut()) else {
            return;
        };
        let id = turn.id;
        turn.quiet = (!closed).then(|| {
            self.after(wait, move |runner| {
                let mut state = runner.state();
                runner.quiet(&mut state, &owner, id);
            })
        });
    }

    /// The check's time came. A turn whose reply ended, that waits for its background tasks,
    /// and showed nothing for `QUIET`, is asked about them in a message steered into it; with
    /// nothing shown `QUIET` after that, it fails, and its process closes, which ends its
    /// commands. Nothing for an agent that cannot be steered.
    fn quiet(&self, state: &mut State, session: &str, id: i64) {
        let Some(live) = state.lives.get(session) else {
            return;
        };
        let Some(turn) = live.turn.as_ref().filter(|turn| turn.id == id) else {
            return;
        };
        if turn.stop.is_some() {
            return;
        }
        let left = QUIET.saturating_sub(turn.heard.elapsed());
        if !left.is_zero() {
            return self.ask_after(state, session, left);
        }
        let waits = live.proc.as_ref().filter(|proc| {
            turn.replied && !proc.closing && !proc.background.is_empty() && proc.capabilities.steer
        });
        let Some(proc) = waits else {
            return self.ask_after(state, session, QUIET);
        };
        if turn.asked {
            self.halt(
                state,
                session,
                TurnEnd::because(TurnState::Failed, UNANSWERED),
            );
            self.close_proc(state, session);
            return;
        }
        let shown = Shown {
            origin: Origin::Workflow,
            text: quiet_check(&waiting_label(&proc.background)),
            opening: None,
            images: Vec::new(),
        };
        if let Err(error) = self.steer_into(state, session, id, shown, Vec::new()) {
            eprintln!("uraeda: turn {id} could not be asked about its background tasks: {error:?}");
        }
        if let Some(turn) = state.lives.get(session).and_then(|live| live.turn.as_mut()) {
            turn.asked = true;
        }
        self.ask_after(state, session, QUIET);
    }
}
