//! The sessions made and moved, and the human's edits of a session's stored fields and of its
//! turns: a chat, a session of a change or a feature, a rename, an archive, an effort, a
//! dismissal, Stop, a message taken back, and a blocked action allowed.

use uraeda_protocol::SessionPick;

use super::live::Reading;
use super::manager::{Runner, TAKEN_BACK, refusals};
use super::message::{chat_title, retry_message};
use super::page::Blocked;
use super::picks::{self, Picked};
use super::processes::uuid;
use super::publish::Change;
use super::running::{Shown, Starting};
use super::send::of_dropped;
use super::session::{NewSession, Session};
use super::turn::{TurnKind, TurnState};
use super::turns::TurnEnd;
use crate::extensions::{self, Happened};
use crate::live::Fault;
use crate::runtimes::{Outgoing, When};

impl Runner {
    /// Records a new session, and says it started.
    pub(super) fn create(&self, new: NewSession) -> Result<Session, Fault> {
        let row = self.store().create_session(new, self.now())?;
        if let Some(repository) = self.name_of(&row.repo) {
            let started = Happened::SessionStarted {
                repository,
                session: row.id.clone(),
                runtime: row.agent.clone(),
            };
            extensions::emit(&self.shared, &started);
        }
        self.publish(&Change::of(&row, None, None));
        Ok(row)
    }

    /// A new session in a main checkout, of a folder or a chat, on what was picked.
    fn make(&self, root: &str, folder: Option<&str>, picked: Picked) -> Result<Session, Fault> {
        self.create(NewSession {
            repo: root.to_owned(),
            folder: folder.map(str::to_owned),
            parent: None,
            role: None,
            step: None,
            worktree: None,
            agent: picked.agent,
            native_id: uuid(),
            title: None,
            model: picked.model,
            effort: picked.effort,
        })
    }

    /// Refuses a change or a feature dropped: its sessions are all archived.
    fn refuse_dropped(&self, root: &str, folder: &str) -> Result<Option<Session>, Fault> {
        let latest = self.store().latest_session(root, folder)?;
        match latest.as_ref().is_some_and(of_dropped) {
            true => Err(Fault::refused(refusals::DROPPED)),
            false => Ok(latest),
        }
    }

    /// The latest session of a change or a feature, made with none on `pick`, else on its
    /// next step's: refused for a dropped one, whose sessions are all archived, so its runs
    /// never make its worktree again.
    pub(crate) fn feature_session(
        &self,
        root: &str,
        folder: &str,
        pick: &SessionPick,
    ) -> Result<Session, Fault> {
        if let Some(latest) = self.refuse_dropped(root, folder)? {
            return Ok(latest);
        }
        let starting = self.starting_step(root, folder);
        let picked = self.new_pick(root, folder, pick, starting.as_deref())?;
        self.make(root, Some(folder), picked)
    }

    /// A new session of a change or a feature, on `pick`, else on its next step's, which
    /// becomes its latest: its runs go to it. Refused for a dropped one.
    pub(crate) fn new_session(
        &self,
        root: &str,
        folder: &str,
        pick: &SessionPick,
    ) -> Result<Session, Fault> {
        self.refuse_dropped(root, folder)?;
        let starting = self.starting_step(root, folder);
        let picked = self.new_pick(root, folder, pick, starting.as_deref())?;
        self.make(root, Some(folder), picked)
    }

    /// A new chat, without a feature, on `pick`, titled by its first message.
    pub(crate) fn new_chat(&self, root: &str, pick: &SessionPick) -> Result<Session, Fault> {
        let picked = self.new_session_pick(root, pick)?;
        self.make(root, None, picked)
    }

    /// Moves a session without a workflow to the change it became, between turns: refused
    /// while its agent works. Its open process closes, so its next turn opens in the change's
    /// worktree, and resumes its agent session there.
    pub(crate) fn attach(&self, row: &Session, folder: &str) -> Result<(), Fault> {
        self.serial(row, || {
            let mut state = self.state();
            let live = self.live_of(&mut state, row);
            if live.turn.is_some() || !live.queue.is_empty() {
                return Err(Fault::refused(refusals::AGENT_WORKING));
            }
            let mut taken = None;
            self.store()
                .edit_session(&row.id, |stored| match &stored.folder {
                    Some(folder) => taken = Some(folder.clone()),
                    None => stored.folder = Some(folder.to_owned()),
                })?;
            if let Some(taken) = taken {
                let refusal = format!("the session already belongs to {taken}");
                return Err(Fault::refused(refusal));
            }
            // Kept in memory with the folder it had: its next turn reads this one.
            if let Some(live) = state.lives.get(&row.id) {
                live.folder = Some(folder.to_owned());
            }
            self.close_proc(&mut state, &row.id);
            self.changed(&mut state, &row.id, None, None);
            Ok(())
        })
    }

    /// Archives every session of a dropped change or feature, their sub-sessions too, and
    /// closes their processes.
    pub(crate) fn archive_folder(&self, root: &str, folder: &str) -> Result<(), Fault> {
        let store = self.store();
        let now = self.now();
        for row in store.folder_sessions(root, folder)? {
            let subs = store.sub_sessions(&row.id)?;
            for row in std::iter::once(row).chain(subs) {
                self.close_proc(&mut self.state(), &row.id);
                store.edit_session(&row.id, |row| row.archived_at = Some(now))?;
                self.publish(&Change::of(&row, None, None));
            }
        }
        Ok(())
    }

    /// Renames a session, by the title's first line that is not blank, cut at 80 characters.
    /// A sub-session keeps its task's name, which its parent's calls find it by.
    pub(crate) fn rename(&self, row: &Session, title: &str) -> Result<(), Fault> {
        if row.parent.is_some() {
            return Err(Fault::refused(refusals::SUB_SESSION_NAME));
        }
        if title.trim().is_empty() {
            return Err(Fault::refused(refusals::BLANK));
        }
        let title = chat_title(title, false);
        self.store()
            .edit_session(&row.id, |row| row.title = Some(title))?;
        self.publish(&Change::of(row, None, None));
        Ok(())
    }

    /// Archives a chat, or brings it back.
    pub(crate) fn archive(&self, row: &Session, archived: bool) -> Result<(), Fault> {
        if row.folder.is_some() {
            return Err(Fault::refused("A feature's session is not archived."));
        }
        let at = archived.then(|| self.now());
        self.store()
            .edit_session(&row.id, |row| row.archived_at = at)?;
        self.publish(&Change::of(row, None, None));
        Ok(())
    }

    /// Changes the effort the session runs on, none for its agent's default: refused when its
    /// model does not take it. Only stored: its next turn's process takes it as it opens, so a
    /// running turn keeps its effort.
    pub(crate) fn set_effort(&self, row: &Session, effort: Option<String>) -> Result<(), Fault> {
        self.check_effort(&row.agent, row.model.as_deref(), effort.as_deref())?;
        self.store()
            .edit_session(&row.id, |row| row.effort = effort)?;
        self.publish(&Change::of(row, None, None));
        Ok(())
    }

    /// Records that the human saw the session.
    pub(crate) fn seen(&self, row: &Session) -> Result<(), Fault> {
        let now = self.now();
        self.store()
            .edit_session(&row.id, |row| row.seen_at = Some(now))?;
        self.publish(&Change::of(row, None, None));
        Ok(())
    }

    /// Dismisses a failed or stopped turn of the session's, or a done one sent at `catch-up`:
    /// it no longer asks for the human. Refused while the turn runs or waits, and for a
    /// message taken back, which the status skips; a turn dismissed already, or another done
    /// one, is left as it is.
    pub(crate) fn dismiss(&self, row: &Session, turn: i64) -> Result<(), Fault> {
        let store = self.store();
        let found = store.turn(turn)?.filter(|found| found.session_id == row.id);
        let found = found.ok_or_else(|| Fault::refused(format!("no turn {turn}")))?;
        if matches!(found.state, TurnState::Running | TurnState::Queued) {
            return Err(Fault::refused(refusals::STILL_RUNNING));
        }
        if found.state == TurnState::Stopped && found.reason.as_deref() == Some(TAKEN_BACK) {
            return Err(Fault::refused(refusals::TAKEN_BACK));
        }
        // A decision of its continue under way is dropped too.
        self.taken_over(&mut self.state(), &row.id);
        if store.dismiss(turn, self.now())? {
            // `dismissed` keeps a done catch-up's from what follows a turn's end: it ended
            // before.
            self.publish(&Change {
                dismissed: true,
                ..Change::of(row, Some(turn), Some(found.state))
            });
        }
        Ok(())
    }

    /// Stops the session's running turn, which keeps the session, and the turns queued after
    /// it, or the run's wait to continue, or its agent's own wakeup, for good. Its
    /// sub-sessions stop too.
    pub(crate) fn stop(&self, row: &Session) {
        let mut state = self.state();
        self.live_of(&mut state, row);
        self.stop_run(&mut state, &row.id);
        self.stop_subs(&mut state, &row.id);
    }

    /// Stops a session's run: see [`Runner::stop`].
    pub(super) fn stop_run(&self, state: &mut super::manager::State, session: &str) {
        let queued: Vec<i64> = match state.lives.get(session) {
            Some(live) => live.queue.drain(..).map(|queued| queued.id).collect(),
            None => Vec::new(),
        };
        for turn in queued {
            self.end(state, session, turn, TurnEnd::of(TurnState::Stopped));
        }
        self.halt(state, session, TurnEnd::of(TurnState::Stopped));
        self.stop_wakeup(state, session);
        for turn in self.cancel_continue(state, session, true) {
            self.changed(state, session, Some(turn), Some(TurnState::Stopped));
        }
        state.lives.prune(session);
    }

    /// Takes back a message of the session the agent has not read: a queued turn's at once,
    /// which ends it, or a message written to the agent through its own take-back, which ends
    /// with its `cancelled` event. Refused once the agent read it, or once the session no
    /// longer keeps it.
    pub(crate) fn take_back(&self, row: &Session, message: &str) -> Result<(), Fault> {
        let read = || Fault::refused(refusals::READ);
        let mut state = self.state();
        // A message no longer kept belongs to a turn that ended with nothing left to read.
        let live = state.lives.get(&row.id).ok_or_else(read)?;
        let sent = live.messages.get(message).ok_or_else(read)?;
        let first = live.turn.as_ref().is_some_and(|turn| turn.first == message);
        match sent.state {
            Reading::TakenBack => return Ok(()),
            Reading::Read => return Err(read()),
            Reading::Pending if first => return Err(read()),
            Reading::Pending => {}
        }
        let turn = sent.turn;
        let queued = live
            .queue
            .iter()
            .position(|queued| queued.message.id == message);
        if let Some(queued) = queued {
            live.queue.remove(queued);
            self.mark(&mut state, &row.id, message, Reading::TakenBack);
            let taken = TurnEnd::because(TurnState::Stopped, TAKEN_BACK);
            self.end(&mut state, &row.id, turn, taken);
            state.lives.prune(&row.id);
            return Ok(());
        }
        let Some(proc) = live
            .proc
            .as_ref()
            .filter(|proc| proc.capabilities.take_back)
        else {
            let name = live.proc.as_ref().map(|proc| proc.name.clone());
            let name = name.unwrap_or_else(|| "The agent".to_owned());
            return Err(Fault::refused(format!("{name} cannot take a message back")));
        };
        proc.agent.take_back(message);
        Ok(())
    }

    /// Allows one blocked action of a turn: opens the session's process again with its rule,
    /// for that process only, and asks the agent to try again, in a turn of its own.
    pub(crate) fn allow(&self, row: &Session, turn: i64, denial: u64) -> Result<i64, Fault> {
        picks::ready(self, row)?;
        self.serial(row, || {
            self.as_human(&row.id, || {
                let store = self.store();
                let own = store
                    .turn(turn)?
                    .is_some_and(|found| found.session_id == row.id);
                let blocked = store.blocked(turn)?;
                let found = blocked.into_iter().find(|blocked| blocked.seq == denial);
                let Some(found) = found.filter(|_| own) else {
                    let refusal = format!("no blocked action {denial} in turn {turn}");
                    return Err(Fault::refused(refusal));
                };
                if !usable(found.rule.as_deref()) {
                    return Err(Fault::refused(refusals::NO_RULE));
                }
                self.allow_blocked(&row.id, turn, vec![found])
            })
        })
    }

    /// Allows every blocked action of the session's latest turn that has a rule at once: one
    /// reopen of its process with every rule, and one turn asking the agent to try them again.
    /// Refused while a turn runs or waits, and with no such action.
    pub(crate) fn allow_all(&self, row: &Session) -> Result<i64, Fault> {
        picks::ready(self, row)?;
        self.serial(row, || {
            self.as_human(&row.id, || {
                self.refuse_working(&row.id)?;
                let store = self.store();
                let latest = store.turns(&row.id)?.last().map(|turn| turn.id);
                let covered = match latest {
                    Some(latest) => covered(store.blocked(latest)?),
                    None => Vec::new(),
                };
                match (latest, covered.is_empty()) {
                    (Some(latest), false) => self.allow_blocked(&row.id, latest, covered),
                    _ => Err(Fault::refused(refusals::NOTHING_TO_ALLOW)),
                }
            })
        })
    }

    /// Refuses an allow while a turn of the session runs or waits.
    fn refuse_working(&self, session: &str) -> Result<(), Fault> {
        let mut state = self.state();
        let live = state.lives.get(session);
        let working = live.is_some_and(|live| live.turn.is_some() || !live.queue.is_empty());
        match working {
            true => Err(Fault::refused(refusals::WORKING)),
            false => Ok(()),
        }
    }

    /// The one way that allows: refuses while a turn runs or waits, opens the process again
    /// with the rules, which fails before anything is marked, begins the retry turn, then
    /// marks each blocked action allowed. The rules go once each, in the order first seen.
    /// The retry keeps the allowed turn's catch-up commit, and no step: nothing else reads it
    /// as a workflow turn.
    fn allow_blocked(&self, session: &str, turn: i64, blocked: Vec<Blocked>) -> Result<i64, Fault> {
        self.refuse_working(session)?;
        let mut rules: Vec<String> = Vec::new();
        for rule in blocked.iter().filter_map(|blocked| blocked.rule.clone()) {
            if !rules.contains(&rule) {
                rules.push(rule);
            }
        }
        let opened = self.open(session, Some(rules.clone()))?;
        let id = uuid();
        // Every blocked action is asked again, though some share a rule.
        let actions: Vec<(String, Option<String>)> = blocked
            .iter()
            .map(|blocked| (blocked.tool.clone(), blocked.target.clone()))
            .collect();
        let text = retry_message(&actions);
        let store = self.store();
        // A retry of a catch-up catches up with the same commit: its stop reads as the
        // catch-up's.
        let caught_up_to = store.turn(turn)?.and_then(|turn| turn.caught_up_to);
        let retry = Starting {
            kind: TurnKind::Allow,
            trigger: None,
            step: None,
            allowed: Some(rules.join("\n")),
            caught_up_to,
            lines: opened.line.into_iter().collect(),
            after: Vec::new(),
            shown: Shown {
                origin: super::event::Origin::Human,
                text: text.clone(),
                opening: None,
                images: Vec::new(),
            },
            message: Outgoing {
                id,
                text,
                images: Vec::new(),
                when: When::Queue,
                review: false,
            },
        };
        let mut state = self.state();
        let started = self.begin(&mut state, session, retry)?;
        let repo = state.lives.get(session).map(|live| live.repo.clone());
        for blocked in &blocked {
            let allowed = super::event::Event::Allowed {
                denial: blocked.seq,
            };
            store.append(turn, self.now(), &allowed)?;
            if let (Some(repo), Some(page)) = (&repo, store.page_of(turn, blocked.seq)?) {
                self.page_changed(repo, turn, page);
            }
        }
        self.changed(&mut state, session, Some(turn), None);
        Ok(started)
    }

    /// How many blocked actions of a session's latest turn "Allow all" would allow.
    pub(crate) fn allowable(&self, turn: i64) -> u32 {
        let blocked = self.store().blocked(turn).unwrap_or_default();
        u32::try_from(covered(blocked).len()).unwrap_or(u32::MAX)
    }
}

/// A rule is one line: the turn stores its rules a line each.
fn usable(rule: Option<&str>) -> bool {
    rule.is_some_and(|rule| !rule.contains('\n'))
}

/// A turn's blocked actions that are not allowed yet and have a rule: what "Allow all" allows,
/// and what the session's `allowable` counts, so the button's number and the press cannot
/// differ.
fn covered(blocked: Vec<Blocked>) -> Vec<Blocked> {
    let covered = |blocked: &Blocked| !blocked.allowed && usable(blocked.rule.as_deref());
    blocked.into_iter().filter(covered).collect()
}
