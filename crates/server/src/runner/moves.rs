//! The move of a session a usage limit refused: at once to another listed account with room
//! that holds its conversation, as the models and run lifecycle decisions say; else the run
//! waits for its own account's reset, a session's limit only.

use super::event::{Limit, LimitKind};
use super::manager::Runner;
use crate::runtimes::accounts;

impl Runner {
    /// Whether a limit that failed a turn of `session` is one the continuer decides: a
    /// session's limit always, any other only for a session on an account, which may move.
    pub(super) fn limit_decides(&self, session: &str, limit: &Limit) -> bool {
        if limit.kind == LimitKind::Session {
            return true;
        }
        let row = self.store().session(session).ok().flatten();
        let on = row.filter(|row| row.account.is_some());
        let runtime = on.and_then(|row| self.runtimes().get(&row.agent));
        runtime.is_some_and(|runtime| runtime.accounts().is_some())
    }

    /// Moves a session a limit refused to another account of its runtime's, and returns its
    /// id: the pick of the listed accounts with room that hold the session's transcript, on
    /// usage asked again when stale. None, and the session stays, when it runs on no account,
    /// when no other has room, or when none holds its transcript, where it would start over.
    /// Its next process opens on the new account, and resumes the conversation.
    pub(super) fn move_account(&self, session: &str) -> Option<String> {
        let store = self.store();
        let row = store.session(session).ok().flatten()?;
        let current = row.account.clone()?;
        let runtime = self.runtimes().get(&row.agent)?;
        let listed = runtime.accounts()?.list();
        if listed.iter().all(|account| account.id == current) {
            return None;
        }
        self.refresh_accounts(&row.agent);
        // The session may have been removed or moved while the usage was asked.
        let now = store.session(session).ok().flatten()?;
        if now.account.as_ref() != Some(&current) {
            return None;
        }
        let (_, merged) = self.accounts_of(&row.agent);
        let others: Vec<_> = merged
            .into_iter()
            .filter(|account| {
                account.id != current && runtime.has_session(&now.native_id, Some(&account.id))
            })
            .collect();
        let picked = accounts::pick_with_room(&others)?.id.clone();
        let moved = store.edit_session(session, |row| row.account = Some(picked.clone()));
        moved.ok().flatten()?;
        Some(picked)
    }
}
