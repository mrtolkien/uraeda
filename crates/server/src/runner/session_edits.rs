//! What the sessions read and write of a session after it was made: its fields, its folder,
//! and the lists of a repository's, a folder's, and a parent's sessions.

use std::time::SystemTime;

use rusqlite::OptionalExtension;

use super::session::{self, Session};
use super::store::{Store, StoreError, millis};

/// What `LIKE` reads as itself in a text: `%`, `_`, and the escape, each escaped.
fn contains(text: &str) -> String {
    let mut pattern = String::from("%");
    for letter in text.chars() {
        if matches!(letter, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(letter);
    }
    pattern.push('%');
    pattern
}

impl Store {
    /// Changes a session's fields as `edit` says, and returns it: none for an id that is no
    /// session's. Its id, repository, parent, role, worktree, and creation stay as they are.
    pub fn edit_session(
        &self,
        id: &str,
        edit: impl FnOnce(&mut Session),
    ) -> Result<Option<Session>, StoreError> {
        self.write(|db| {
            let found = db
                .prepare_cached("SELECT * FROM sessions WHERE id = ?1")?
                .query_row([id], session::session)
                .optional()?;
            let Some(mut row) = found else {
                return Ok(None);
            };
            edit(&mut row);
            db.prepare_cached(
                "UPDATE sessions SET folder = ?1, step = ?2, agent = ?3, native_id = ?4,
                   title = ?5, model = ?6, effort = ?7, ran_model = ?8, ran_effort = ?9,
                   seen_at = ?10, archived_at = ?11
                 WHERE id = ?12",
            )?
            .execute((
                &row.folder,
                &row.step,
                &row.agent,
                &row.native_id,
                &row.title,
                &row.model,
                &row.effort,
                &row.ran_model,
                &row.ran_effort,
                row.seen_at.map(millis),
                row.archived_at.map(millis),
                id,
            ))?;
            Ok::<_, StoreError>(Some(row))
        })
    }

    /// Removes a session while it has no turn, as the one made for a start that never landed.
    pub fn remove_empty_session(&self, id: &str) -> Result<(), StoreError> {
        self.write(|db| {
            db.prepare_cached(
                "DELETE FROM sessions WHERE id = ?1
                   AND NOT EXISTS (SELECT 1 FROM turns WHERE session_id = ?1)",
            )?
            .execute([id])?;
            Ok::<_, StoreError>(())
        })
    }

    /// The sessions of a change or a feature, the latest started first, its sub-sessions left
    /// out: the first is the one its runs go to.
    pub fn folder_sessions(&self, repo: &str, folder: &str) -> Result<Vec<Session>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT * FROM sessions WHERE repo = ?1 AND folder = ?2 AND parent IS NULL
                 ORDER BY created_at DESC, rowid DESC",
            )?;
            let rows = read.query_map((repo, folder), session::session)?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// The latest started session of a change or a feature, the one its runs go to: never a
    /// sub-session.
    pub fn latest_session(&self, repo: &str, folder: &str) -> Result<Option<Session>, StoreError> {
        Ok(self.folder_sessions(repo, folder)?.into_iter().next())
    }

    /// The sub-sessions a session's runs started, the first started first.
    pub fn sub_sessions(&self, parent: &str) -> Result<Vec<Session>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT * FROM sessions WHERE parent = ?1 ORDER BY created_at, rowid",
            )?;
            let rows = read.query_map([parent], session::session)?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// A repository's sessions, the last updated first, sub-sessions left out, at most `limit`:
    /// with a `query`, those whose title, folder, messages, or texts hold it, whatever its
    /// case.
    pub fn sessions_of(
        &self,
        repo: &str,
        limit: u32,
        query: Option<&str>,
    ) -> Result<Vec<Session>, StoreError> {
        self.read(|db| {
            let rows = match query {
                None => db
                    .prepare_cached(
                        "SELECT * FROM sessions WHERE repo = ?1 AND parent IS NULL
                         ORDER BY updated_at DESC, rowid DESC LIMIT ?2",
                    )?
                    .query_map((repo, limit), session::session)?
                    .collect::<rusqlite::Result<_>>()?,
                Some(query) => db
                    .prepare_cached(
                        "SELECT * FROM sessions s WHERE repo = ?1 AND parent IS NULL AND (
                           lower(s.title) LIKE lower(?2) ESCAPE '\\'
                           OR lower(s.folder) LIKE lower(?2) ESCAPE '\\'
                           OR EXISTS (
                             SELECT 1 FROM turns t JOIN events e ON e.turn_id = t.id
                             WHERE t.session_id = s.id AND e.type IN ('message', 'text')
                               AND lower(json_extract(e.data, '$.text')) LIKE lower(?2)
                                   ESCAPE '\\'))
                         ORDER BY updated_at DESC, rowid DESC LIMIT ?3",
                    )?
                    .query_map((repo, contains(query), limit), session::session)?
                    .collect::<rusqlite::Result<_>>()?,
            };
            Ok(rows)
        })
    }

    /// The main checkouts the store holds sessions of.
    pub fn repositories(&self) -> Result<Vec<String>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached("SELECT DISTINCT repo FROM sessions")?;
            let rows = read.query_map([], |row| row.get(0))?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// Records a change of a session, at `at`: it moves up its repository's list.
    pub fn touch_session(&self, id: &str, at: SystemTime) -> Result<(), StoreError> {
        self.write(|db| super::turns::touch(db, id, at))
    }
}
