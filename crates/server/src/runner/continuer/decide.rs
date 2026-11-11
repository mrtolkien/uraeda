//! What arms the continues: the server's start, an agent back, the switches changed, and a
//! stopped turn's decision, with its timer.

use super::*;

impl Runner {
    /// Arms every pending continue, as the server starts: the ones of a kind now off are
    /// dropped. Then continues the runs the server's stop cut in the last 6 hours, whose agent
    /// kept their session, once the agent works.
    pub(in crate::runner) fn start_continues(&self) {
        self.runs_changed();
        let store = self.store();
        let now = self.now();
        // The limits' overdue waits go a minute apart, in their order, as they would have.
        let mut overdue = now;
        {
            let mut state = self.state();
            for turn in store.pending_continues().unwrap_or_default() {
                let at = turn.continue_at.unwrap_or(now);
                if turn.continue_reason != Some(ContinueReason::Limit) || at > now {
                    self.arm(&mut state, turn.id, at);
                } else if store.move_continue(turn.id, at, overdue).unwrap_or(false) {
                    self.arm(&mut state, turn.id, overdue);
                    overdue += MINUTE;
                }
            }
            state.continues.started = true;
        }
        self.agent_back();
    }

    /// Continues the runs the server's stop cut, once the agent works: at the start, or when a
    /// check finds it back. Safe twice: a cut decided once has its continue's reason.
    pub(in crate::runner) fn agent_back(&self) {
        if !self.state().continues.started || !self.runs().after_restart {
            return;
        }
        let store = self.store();
        let since = self
            .now()
            .checked_sub(RESTART_WINDOW)
            .unwrap_or(SystemTime::UNIX_EPOCH);
        let cuts = store.server_cuts(SERVER_STOPPED, since).unwrap_or_default();
        let sessions = cuts.into_iter().filter_map(|turn| {
            let session = store.session(&turn.session_id).ok()??;
            Some((turn, session))
        });
        // Sub-sessions first: their parents wait for them.
        let (subs, parents): (Vec<_>, Vec<_>) =
            sessions.partition(|(_, session)| session.parent.is_some());
        for (turn, session) in subs.into_iter().chain(parents) {
            let kept = picks::runs_on(self, &session)
                && self.runtimes().get(&session.agent).is_some_and(|runtime| {
                    runtime.has_session(&session.native_id, session.account.as_deref())
                });
            if kept {
                let taken = self.takeovers(&session.id);
                self.decide(&turn, ContinueReason::Restart, Runner::now, taken);
            }
        }
    }

    /// Drops the pending continues of each kind whose setting is now off: their runs ask.
    pub(crate) fn runs_changed(&self) {
        let runs = self.runs();
        let store = self.store();
        for reason in [
            ContinueReason::Limit,
            ContinueReason::Account,
            ContinueReason::Restart,
        ] {
            if runs.on(reason) {
                continue;
            }
            let mut state = self.state();
            for turn in store.drop_continues(reason).unwrap_or_default() {
                state.continues.timers.remove(&turn.id);
                self.say(&mut state, &turn, turn.state);
                self.left(&mut state, &turn.session_id);
            }
        }
    }

    /// Waits the turn for its continue of `reason` at `at`, or, at the session's cap, marks it
    /// capped: nothing when that kind is off, its repository is no longer listed, the session
    /// is not its folder's latest, nor a chat, the turn is not its latest, or it was refused
    /// an action the human has not allowed. A commit in the feature's worktree since the
    /// session's last continue sets its count back to 0 first. The run taken over since
    /// `taken`, or the switch turned off, while it reads, drops it.
    pub(in crate::runner) fn decide(
        &self,
        turn: &Turn,
        reason: ContinueReason,
        at: impl FnOnce(&Runner) -> SystemTime,
        taken: u64,
    ) {
        let store = self.store();
        let Ok(Some(session)) = store.session(&turn.session_id) else {
            return;
        };
        // A repository removed from the server's list shows its runs nowhere: none goes on
        // there.
        if !self.hosted(&session.repo) || !self.runs().on(reason) || !self.current(&session) {
            return;
        }
        let blocked = store.blocked(turn.id).unwrap_or_default();
        if blocked.iter().any(|blocked| !blocked.allowed) {
            return;
        }
        let commit = worktree_commit(&session);
        let runs = self.runs();
        let mut state = self.state();
        // The human's message, Stop, or a dismiss while the commit was read takes the run
        // over.
        let now = store.turn(turn.id).ok().flatten();
        let latest = self.latest(&session.id, None).map(|latest| latest.id);
        let stands =
            now.is_some_and(|now| now.dismissed_at.is_none() && now.continue_reason.is_none());
        if state.continues.taken(&session.id) != taken
            || !runs.on(reason)
            || !stands
            || latest != Some(turn.id)
        {
            return;
        }
        match commit {
            None => drop(state.continues.decided_at.remove(&session.id)),
            Some(commit) => {
                let recorded = state.continues.commits.remove(&session.id);
                if recorded.is_some_and(|recorded| recorded != commit) {
                    let _ = store.set_continues(&session.id, 0);
                }
                state
                    .continues
                    .decided_at
                    .insert(session.id.clone(), commit);
            }
        }
        let count = store.session(&session.id).ok().flatten();
        if count.map_or(0, |row| row.continues) >= runs.cap {
            let _ = store.decide_continue(turn.id, None, reason, TAKEN_BACK);
            return;
        }
        let time = at(self);
        if store
            .decide_continue(turn.id, Some(time), reason, TAKEN_BACK)
            .unwrap_or(false)
        {
            self.arm(&mut state, turn.id, time);
        }
    }

    /// When a limit's continue goes: a minute after its reset, an hour from now without one,
    /// never sooner than a minute from now. The runs waiting for one reset go a minute apart:
    /// it steps a minute at a time while another limit's continue waits in that minute.
    pub(in crate::runner) fn limit_continue_at(&self, limit: &Limit) -> SystemTime {
        let now = self.now();
        let reset = limit.resets_at.as_deref().and_then(|at| {
            let at: jiff::Timestamp = at.parse().ok()?;
            Some(SystemTime::from(at))
        });
        let at = reset.map_or(now + RETRY_WITHOUT_RESET, |reset| reset + MINUTE);
        let mut time = at.max(now + MINUTE);
        let store = self.store();
        while store
            .limit_continue_within(time, time + MINUTE)
            .unwrap_or(false)
        {
            time += MINUTE;
        }
        time
    }

    /// Whether the session's runs continue: a chat, a sub-session, or its folder's latest
    /// session, not archived.
    pub(in crate::runner) fn current(&self, session: &Session) -> bool {
        if session.archived_at.is_some() {
            return false;
        }
        let Some(folder) = session
            .folder
            .as_deref()
            .filter(|_| session.parent.is_none())
        else {
            return true;
        };
        let latest = self.store().latest_session(&session.repo, folder);
        latest
            .ok()
            .flatten()
            .is_some_and(|latest| latest.id == session.id)
    }

    /// Arms the turn's timer for `at`: the wait is the server's clock's, and none for a time
    /// that passed.
    pub(in crate::runner) fn arm(&self, state: &mut State, turn: i64, at: SystemTime) {
        state.continues.timers.remove(&turn);
        if state.continues.closed || state.closed {
            return;
        }
        let wait = at.duration_since(self.now()).unwrap_or_default();
        let timer = self.after(wait, move |runner| runner.fire(turn));
        state.continues.timers.insert(turn, timer);
    }

    /// Forgets a continue's turn once it ends: one that never started, taken back, stopped, or
    /// refused, clears the reason of the turn it continued, which would read capped again.
    pub(in crate::runner) fn unclaim(&self, state: &mut State, turn: &Turn) {
        let Some(continued) = state.continues.claimed.remove(&turn.id) else {
            return;
        };
        if turn.started_at.is_none() {
            let _ = self.store().cancel_continue(continued, false);
        }
    }

    /// Says a turn's change, its session kept in memory or not.
    pub(in crate::runner) fn say(&self, state: &mut State, turn: &Turn, ended: TurnState) {
        if state.lives.get(&turn.session_id).is_some() {
            return self.changed(state, &turn.session_id, Some(turn.id), Some(ended));
        }
        if let Ok(Some(row)) = self.store().session(&turn.session_id) {
            self.publish(&Change::of(&row, Some(turn.id), Some(ended)));
        }
    }
}
