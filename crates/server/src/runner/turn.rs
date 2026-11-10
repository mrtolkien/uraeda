//! The store's turns: one message to the agent, until the agent settles.

use std::time::SystemTime;

use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use rusqlite::{Connection, Row, named_params};

use super::event::TokenCounts;
use super::store::{Store, StoreError, millis, time};

/// An enum the store keeps as a text, under the name the Node server gave each value.
macro_rules! named {
    ($(#[$doc:meta])* $name:ident { $($(#[$about:meta])* $variant:ident = $text:literal,)* }) => {
        $(#[$doc])*
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        pub enum $name {
            $($(#[$about])* $variant,)*
        }

        impl $name {
            /// Its name in the store, and in the protocol.
            pub fn name(self) -> &'static str {
                match self {
                    $(Self::$variant => $text,)*
                }
            }

            /// The value of a name, none for a name it does not have.
            pub fn named(name: &str) -> Option<Self> {
                match name {
                    $($text => Some(Self::$variant),)*
                    _ => None,
                }
            }
        }

        impl ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
                Ok(ToSqlOutput::from(self.name()))
            }
        }

        impl FromSql for $name {
            fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
                let name = value.as_str()?;
                Self::named(name).ok_or_else(|| {
                    FromSqlError::Other(
                        format!("{name} is no {}", stringify!($name)).into(),
                    )
                })
            }
        }
    };
}

named! {
    /// Why a turn runs.
    TurnKind {
        /// A workflow step.
        Workflow = "workflow",
        /// The human's message.
        Chat = "chat",
        /// A blocked action the human allowed, tried again.
        Allow = "allow",
    }
}

named! {
    /// Where a turn is.
    TurnState {
        /// It waits behind another turn.
        Queued = "queued",
        Running = "running",
        Done = "done",
        Failed = "failed",
        Stopped = "stopped",
    }
}

named! {
    /// Why Uraeda continues a run by itself.
    ContinueReason {
        /// The server restarted while it ran.
        Restart = "restart",
        /// A usage limit that failed it has reset.
        Limit = "limit",
    }
}

/// A turn, as the store keeps it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Turn {
    /// Its number, which only grows: a session's turns are in the order of their ids.
    pub id: i64,
    pub session_id: String,
    pub kind: TurnKind,
    /// Workflow turns: what started it, as `answers` or `manual`, by the Node server's names.
    pub trigger: Option<String>,
    /// Workflow turns: the core's step when it started.
    pub step: Option<String>,
    /// Allow turns: the allow rules, a line each.
    pub allowed: Option<String>,
    /// A catch-up's commit of the default branch, which it started for.
    pub caught_up_to: Option<String>,
    pub state: TurnState,
    /// Why it failed or stopped, in the UI's words.
    pub reason: Option<String>,
    /// None while it is queued.
    pub started_at: Option<SystemTime>,
    pub ended_at: Option<SystemTime>,
    /// When the human dismissed its failure or its stop.
    pub dismissed_at: Option<SystemTime>,
    /// When Uraeda continues the run by itself, none when no continue waits.
    pub continue_at: Option<SystemTime>,
    /// Why the run continues, or why it would have past the cap.
    pub continue_reason: Option<ContinueReason>,
    /// The tokens of its own work, none when the agent reported none.
    pub tokens: Option<TokenCounts>,
}

/// A new turn's fields: see [`Turn`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewTurn {
    pub session_id: String,
    pub kind: TurnKind,
    pub trigger: Option<String>,
    pub step: Option<String>,
    pub allowed: Option<String>,
    pub caught_up_to: Option<String>,
    /// `Running` for a turn that starts now, `Queued` for one that waits.
    pub state: TurnState,
}

impl Store {
    /// Adds a turn to its session, which it updates, and returns its id. A running turn starts
    /// at `at`.
    pub fn add_turn(&self, new: NewTurn, at: SystemTime) -> Result<i64, StoreError> {
        let started = (new.state == TurnState::Running).then_some(at);
        let turn = Turn {
            // Taken from the store: the next one.
            id: 0,
            session_id: new.session_id,
            kind: new.kind,
            trigger: new.trigger,
            step: new.step,
            allowed: new.allowed,
            caught_up_to: new.caught_up_to,
            state: new.state,
            reason: None,
            started_at: started,
            ended_at: None,
            dismissed_at: None,
            continue_at: None,
            continue_reason: None,
            tokens: None,
        };
        self.write(|db| {
            let id = insert(db, &turn, None)?;
            db.prepare_cached("UPDATE sessions SET updated_at = ?1 WHERE id = ?2")?
                .execute((millis(at), &turn.session_id))?;
            Ok::<_, StoreError>(id)
        })
    }

    /// The session's turns, the oldest first.
    pub fn turns(&self, session_id: &str) -> Result<Vec<Turn>, StoreError> {
        self.read(|db| {
            let mut read =
                db.prepare_cached("SELECT * FROM turns WHERE session_id = ?1 ORDER BY id")?;
            let turns = read.query_map([session_id], turn)?;
            Ok(turns.collect::<rusqlite::Result<_>>()?)
        })
    }
}

/// Adds a turn's row, whole, under `id`, or under the next id for none, and returns its id.
pub(super) fn insert(db: &Connection, turn: &Turn, id: Option<i64>) -> rusqlite::Result<i64> {
    let count = |count: fn(&TokenCounts) -> u64| {
        let tokens = turn.tokens.as_ref()?;
        Some(i64::try_from(count(tokens)).unwrap_or(i64::MAX))
    };
    let mut add = db.prepare_cached(
        "INSERT INTO turns
           (id, session_id, kind, trigger, step, allowed, caught_up_to, state, reason,
            started_at, ended_at, dismissed_at, continue_at, continue_reason, input_tokens,
            cache_write_tokens, cache_read_tokens, output_tokens)
         VALUES
           (:id, :session_id, :kind, :trigger, :step, :allowed, :caught_up_to, :state, :reason,
            :started_at, :ended_at, :dismissed_at, :continue_at, :continue_reason, :input,
            :cache_write, :cache_read, :output)",
    )?;
    add.execute(named_params! {
        ":id": id,
        ":session_id": turn.session_id,
        ":kind": turn.kind,
        ":trigger": turn.trigger,
        ":step": turn.step,
        ":allowed": turn.allowed,
        ":caught_up_to": turn.caught_up_to,
        ":state": turn.state,
        ":reason": turn.reason,
        ":started_at": turn.started_at.map(millis),
        ":ended_at": turn.ended_at.map(millis),
        ":dismissed_at": turn.dismissed_at.map(millis),
        ":continue_at": turn.continue_at.map(millis),
        ":continue_reason": turn.continue_reason,
        ":input": count(|tokens| tokens.input),
        ":cache_write": count(|tokens| tokens.cache_write),
        ":cache_read": count(|tokens| tokens.cache_read),
        ":output": count(|tokens| tokens.output),
    })?;
    Ok(db.last_insert_rowid())
}

/// A turn, from its row.
fn turn(row: &Row) -> rusqlite::Result<Turn> {
    let at = |column: &str| row.get::<_, Option<i64>>(column).map(|at| at.map(time));
    Ok(Turn {
        id: row.get("id")?,
        session_id: row.get("session_id")?,
        kind: row.get("kind")?,
        trigger: row.get("trigger")?,
        step: row.get("step")?,
        allowed: row.get("allowed")?,
        caught_up_to: row.get("caught_up_to")?,
        state: row.get("state")?,
        reason: row.get("reason")?,
        started_at: at("started_at")?,
        ended_at: at("ended_at")?,
        dismissed_at: at("dismissed_at")?,
        continue_at: at("continue_at")?,
        continue_reason: row.get("continue_reason")?,
        tokens: tokens(row)?,
    })
}

/// A turn's tokens, none when all four counts are: a missing count alone reads as 0.
fn tokens(row: &Row) -> rusqlite::Result<Option<TokenCounts>> {
    let count = |column: &str| row.get::<_, Option<u64>>(column);
    let counts = [
        count("cache_read_tokens")?,
        count("cache_write_tokens")?,
        count("input_tokens")?,
        count("output_tokens")?,
    ];
    if counts.iter().all(Option::is_none) {
        return Ok(None);
    }
    let [cache_read, cache_write, input, output] = counts.map(Option::unwrap_or_default);
    Ok(Some(TokenCounts {
        cache_read,
        cache_write,
        input,
        output,
    }))
}
