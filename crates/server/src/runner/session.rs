//! The store's sessions: one agent session Uraeda runs, a feature's, a change's, or a chat.

use std::time::SystemTime;

use rusqlite::{Connection, OptionalExtension, Row, named_params};

use super::store::{Store, StoreError, millis, time};
use crate::secret;

/// A session, as the store keeps it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Session {
    /// Uraeda's own id, a UUID.
    pub id: String,
    /// The repository's main checkout.
    pub repo: String,
    /// The change's or feature's folder, none for a chat without one.
    pub folder: Option<String>,
    /// The session that started it, as a sub-session of a run.
    pub parent: Option<String>,
    /// A sub-session's role in its parent's run, like `implementer`.
    pub role: Option<String>,
    /// The workflow step it was started for, like `spec`.
    pub step: Option<String>,
    /// The worktree it works in, when not its feature's.
    pub worktree: Option<String>,
    /// The runtime's name: `claude`.
    pub agent: String,
    /// The agent's own session id.
    pub native_id: String,
    /// None for a feature's session: its feature's name shows.
    pub title: Option<String>,
    /// The model picked, by the agent's id: none for the agent's default.
    pub model: Option<String>,
    /// The effort picked, by the agent's id: none for the agent's default.
    pub effort: Option<String>,
    /// The model the agent last reported running on, by its name for people.
    pub ran_model: Option<String>,
    /// The effort the agent last reported running on, by its name for people.
    pub ran_effort: Option<String>,
    /// The automatic continues in a row.
    pub continues: u32,
    pub created_at: SystemTime,
    /// The last turn's start or end.
    pub updated_at: SystemTime,
    /// When the human last saw it ended.
    pub seen_at: Option<SystemTime>,
    pub archived_at: Option<SystemTime>,
}

/// A new session's fields: see [`Session`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewSession {
    pub repo: String,
    pub folder: Option<String>,
    pub parent: Option<String>,
    pub role: Option<String>,
    pub step: Option<String>,
    pub worktree: Option<String>,
    pub agent: String,
    pub native_id: String,
    pub title: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

impl Store {
    /// Records a new session, with a new id, created and updated at `at`.
    pub fn create_session(&self, new: NewSession, at: SystemTime) -> Result<Session, StoreError> {
        let session = Session {
            id: uuid(),
            repo: new.repo,
            folder: new.folder,
            parent: new.parent,
            role: new.role,
            step: new.step,
            worktree: new.worktree,
            agent: new.agent,
            native_id: new.native_id,
            title: new.title,
            model: new.model,
            effort: new.effort,
            ran_model: None,
            ran_effort: None,
            continues: 0,
            // To the millisecond, as the store keeps it: what is returned is what is read back.
            created_at: time(millis(at)),
            updated_at: time(millis(at)),
            seen_at: None,
            archived_at: None,
        };
        self.write(|db| insert(db, &session).map_err(StoreError::from))?;
        Ok(session)
    }

    /// The session of an id, none when there is none.
    pub fn session(&self, id: &str) -> Result<Option<Session>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached("SELECT * FROM sessions WHERE id = ?1")?;
            Ok(read.query_row([id], session).optional()?)
        })
    }
}

/// Adds a session's row, whole.
pub(super) fn insert(db: &Connection, session: &Session) -> rusqlite::Result<()> {
    let mut add = db.prepare_cached(
        "INSERT INTO sessions
           (id, repo, folder, parent, role, step, worktree, agent, native_id, title, model,
            effort, ran_model, ran_effort, continues, created_at, updated_at, seen_at,
            archived_at)
         VALUES
           (:id, :repo, :folder, :parent, :role, :step, :worktree, :agent, :native_id, :title,
            :model, :effort, :ran_model, :ran_effort, :continues, :created_at, :updated_at,
            :seen_at, :archived_at)",
    )?;
    add.execute(named_params! {
        ":id": session.id,
        ":repo": session.repo,
        ":folder": session.folder,
        ":parent": session.parent,
        ":role": session.role,
        ":step": session.step,
        ":worktree": session.worktree,
        ":agent": session.agent,
        ":native_id": session.native_id,
        ":title": session.title,
        ":model": session.model,
        ":effort": session.effort,
        ":ran_model": session.ran_model,
        ":ran_effort": session.ran_effort,
        ":continues": session.continues,
        ":created_at": millis(session.created_at),
        ":updated_at": millis(session.updated_at),
        ":seen_at": session.seen_at.map(millis),
        ":archived_at": session.archived_at.map(millis),
    })?;
    Ok(())
}

/// A session, from its row.
pub(super) fn session(row: &Row) -> rusqlite::Result<Session> {
    let at = |column: &str| row.get::<_, Option<i64>>(column).map(|at| at.map(time));
    Ok(Session {
        id: row.get("id")?,
        repo: row.get("repo")?,
        folder: row.get("folder")?,
        parent: row.get("parent")?,
        role: row.get("role")?,
        step: row.get("step")?,
        worktree: row.get("worktree")?,
        agent: row.get("agent")?,
        native_id: row.get("native_id")?,
        title: row.get("title")?,
        model: row.get("model")?,
        effort: row.get("effort")?,
        ran_model: row.get("ran_model")?,
        ran_effort: row.get("ran_effort")?,
        continues: row.get("continues")?,
        created_at: time(row.get("created_at")?),
        updated_at: time(row.get("updated_at")?),
        seen_at: at("seen_at")?,
        archived_at: at("archived_at")?,
    })
}

/// A new random UUID, version 4, as the Node server's sessions have: imported sessions and new
/// ones are named alike.
fn uuid() -> String {
    let mut bytes = secret::random_bytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..]
    )
}
