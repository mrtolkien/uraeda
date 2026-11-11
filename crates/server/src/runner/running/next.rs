//! What a turn's end starts next: the session's queued turn, a wakeup, its first turn, and the
//! latest turn before one.

use super::*;

impl Runner {
    /// After a turn: the next queued turn starts, or the idle timer does.
    pub(in crate::runner) fn next(&self, state: &mut State, session: &str) {
        let now = self.now();
        let closed = state.closed;
        let Some(live) = state.lives.get(session) else {
            return;
        };
        if live.turn.is_some() {
            return;
        }
        if !live.queue.is_empty() {
            let owner = session.to_owned();
            return self.spawn(move |runner| runner.start_queued(&owner));
        }
        live.idle = None;
        // A background task still runs: the idle timer starts once it ends. A pending wakeup
        // holds the process open until a minute after it, for the agent to go on by itself.
        let idle = live
            .proc
            .as_ref()
            .filter(|proc| !proc.closing && proc.background.is_empty());
        if let Some(proc) = idle.filter(|_| !closed) {
            let wakeup = proc.wakeup.map(|wakeup| wakeup + WAKEUP_GRACE);
            let wakeup = wakeup.and_then(|until| until.duration_since(now).ok());
            let (owner, serial) = (session.to_owned(), proc.serial);
            let wait = IDLE_CLOSE.max(wakeup.unwrap_or_default());
            live.idle = Some(self.after(wait, move |runner| {
                let mut state = runner.state();
                if proc_of(&mut state, &owner, serial).is_some() {
                    runner.close_proc(&mut state, &owner);
                }
            }));
        }
        self.wake(state, session);
    }

    /// Starts the turns of the change's or feature's other sessions that waited for this one,
    /// now idle: the first to start makes the others wait again.
    pub(in crate::runner) fn wake(&self, state: &mut State, session: &str) {
        for other in state.lives.waiting(session) {
            self.next(state, &other);
        }
    }

    /// Starts the session's first queued turn, in the session's own turn, opening the process
    /// again when it is gone. It waits while another session of its change or feature works:
    /// that one wakes it once idle.
    pub(in crate::runner) fn start_queued(&self, session: &str) {
        let Ok(row) = self.row(session) else {
            return;
        };
        self.serial(&row, || self.start_first(session));
    }

    pub(in crate::runner) fn start_first(&self, session: &str) {
        let first = {
            let mut state = self.state();
            let waits = state.closed || state.lives.other_working(session, false);
            let Some(live) = state.lives.get(session) else {
                return;
            };
            let first = live.queue.front().map(|queued| queued.id);
            match first.filter(|_| !waits && live.turn.is_none()) {
                Some(first) => {
                    live.starting = true;
                    first
                }
                None => return,
            }
        };
        let prepared = self.recheck_queued(session, first);
        let prepared = prepared.and_then(|()| self.open(session, None));
        let mut state = self.state();
        let Some(live) = state.lives.get(session) else {
            return;
        };
        live.starting = false;
        let opened = match prepared {
            Ok(opened) => opened,
            Err(fault) => {
                // The turns cannot run: each fails with why.
                let turns: Vec<i64> = live.queue.drain(..).map(|queued| queued.id).collect();
                for turn in turns {
                    let failed = TurnEnd::because(TurnState::Failed, fault.message());
                    self.end(&mut state, session, turn, failed);
                }
                return self.wake(&mut state, session);
            }
        };
        // Stop, or a take-back, may have ended it while the process opened: the next one
        // starts, or the idle timer does.
        if live.queue.front().map(|queued| queued.id) != Some(first) {
            if let (Some(line), Some(proc)) = (opened.line, live.proc.as_mut()) {
                proc.line = Some(line);
            }
            return self.next(&mut state, session);
        }
        let Some(queued) = live.queue.pop_front() else {
            return;
        };
        let repo = live.repo.clone();
        let store = self.store();
        let mut started = store.start_turn(queued.id, self.now());
        if let Some(text) = opened.line {
            started = started.and_then(|()| {
                let added = store.append(queued.id, self.now(), &line(&text))?;
                if let Some(page) = store.page_of(queued.id, added.seq)? {
                    self.page_changed(&repo, queued.id, page);
                }
                Ok(())
            });
        }
        if let Err(error) = started {
            eprintln!("uraeda: turn {} could not start: {error}", queued.id);
        }
        self.run(&mut state, session, queued.id, queued.message);
    }

    /// The session's latest turn, or its latest before the turn `before`, without those taken
    /// back, which never ran.
    pub(in crate::runner) fn latest(&self, session: &str, before: Option<i64>) -> Option<Turn> {
        let turns = self.store().turns(session).ok()?;
        latest_of(&turns, before).cloned()
    }
}
