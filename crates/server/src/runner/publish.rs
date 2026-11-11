//! What the records are told as a session changes: the session, its turn, its lists, its
//! feature, and what follows a turn's end; a page of a turn's transcript; and the runtimes.

use uraeda_protocol::{
    Agent, Feature, ItemArgs, NeedsYouList, RecommendedMessage, RepositoryArgs,
    Session as SessionRecord, SessionArgs, SessionList, SessionSearch, Turn as TurnRecord, TurnLog,
    TurnLogArgs, Workspace,
};

use super::manager::{Runner, State};
use super::session::Session;
use super::turn::TurnState;
use crate::extensions::{self, Happened};
use crate::live::Bus;

/// What changed of a session, as the records are told.
pub(super) struct Change {
    /// Its repository's main checkout.
    pub repo: String,
    pub folder: Option<String>,
    pub session: String,
    pub parent: Option<String>,
    pub turn: Option<i64>,
    /// The turn's new state.
    pub state: Option<TurnState>,
    /// The human dismissed the turn: it did not end now.
    pub dismissed: bool,
}

impl Change {
    /// A change of a session the server does not keep in memory.
    pub(super) fn of(row: &Session, turn: Option<i64>, state: Option<TurnState>) -> Change {
        Change {
            repo: row.repo.clone(),
            folder: row.folder.clone(),
            session: row.id.clone(),
            parent: row.parent.clone(),
            turn,
            state,
            dismissed: false,
        }
    }
}

impl Runner {
    /// Says a session changed: itself, the lists it is in, and its feature's status. With a
    /// turn, that turn too, and with its new state, what follows a turn's end. Held while the
    /// continue of a turn of the session is decided.
    pub(super) fn changed(
        &self,
        state: &mut State,
        session: &str,
        turn: Option<i64>,
        ended: Option<TurnState>,
    ) {
        let change = match state.lives.get(session) {
            Some(live) => {
                if let Some(held) = live.held.as_mut() {
                    held.changes.push((turn, ended));
                    return;
                }
                Change {
                    repo: live.repo.clone(),
                    folder: live.folder.clone(),
                    session: live.id.clone(),
                    parent: live.parent.clone(),
                    turn,
                    state: ended,
                    dismissed: false,
                }
            }
            None => match self.store().session(session) {
                Ok(Some(row)) => Change::of(&row, turn, ended),
                _ => return,
            },
        };
        self.publish(&change);
    }

    /// Says a change of a session to the records that show it, and to what follows a turn.
    pub(super) fn publish(&self, change: &Change) {
        let Some(repo) = self.name_of(&change.repo) else {
            return;
        };
        let bus = self.shared.get::<Bus>();
        let session = |id: &str| SessionArgs {
            repo: repo.clone(),
            id: id.to_owned(),
        };
        bus.changed::<SessionRecord>(&session(&change.session));
        if let Some(parent) = &change.parent {
            bus.changed::<SessionRecord>(&session(parent));
        }
        if let Some(turn) = change.turn {
            bus.changed::<TurnRecord>(&session(&turn.to_string()));
        }
        bus.changed::<SessionList>(&RepositoryArgs { repo: repo.clone() });
        bus.changed_where::<SessionSearch>(|args| args.repo == repo);
        if let Some(folder) = &change.folder {
            bus.changed::<Feature>(&ItemArgs {
                repo: repo.clone(),
                id: folder.clone(),
            });
        }
        bus.changed::<Workspace>(&RepositoryArgs { repo: repo.clone() });
        bus.changed::<NeedsYouList>(&());
        let ended = change.state.filter(|state| {
            !change.dismissed && !matches!(state, TurnState::Running | TurnState::Queued)
        });
        let Some(ended) = ended else {
            return;
        };
        let (chat, done) = (change.folder.is_none(), ended == TurnState::Done);
        crate::jobs::turn_ended(self, &change.session, chat, change.turn, done);
        let happened = Happened::TurnEnded {
            repository: repo.clone(),
            session: change.session.clone(),
            feature: change.folder.clone(),
            state: ended.name().to_owned(),
        };
        extensions::emit(&self.shared, &happened);
        if ended == TurnState::Done
            && let Some(folder) = change.folder.clone()
        {
            self.turn_done(repo, folder);
        }
    }

    /// What follows a feature's turn that ended done: its preview warms up for the human, and
    /// the pull requests behind the default branch are caught up.
    fn turn_done(&self, repository: String, folder: String) {
        self.spawn(move |runner| {
            crate::preview::warm_waiting(&runner.shared, &repository, &folder);
            runner.catch_up(&repository);
        });
    }

    /// Says a turn changed, and nothing else of its session: what it does now, its sub-agents,
    /// its transcript's pages.
    pub(super) fn turn_changed(&self, repo: &str, turn: i64) {
        let Some(repo) = self.name_of(repo) else {
            return;
        };
        let args = SessionArgs {
            repo,
            id: turn.to_string(),
        };
        self.shared.get::<Bus>().changed::<TurnRecord>(&args);
    }

    /// What names a page of a turn's transcript on the bus: none for a repository off the list.
    pub(super) fn page_args(&self, repo: &str, turn: i64, page: u32) -> Option<TurnLogArgs> {
        Some(TurnLogArgs {
            repo: self.name_of(repo)?,
            turn: turn.to_string(),
            page,
        })
    }

    /// Says a page of a turn's transcript changed: a line was added to it, or one of its lines
    /// changed otherwise than by growing.
    pub(super) fn page_changed(&self, repo: &str, turn: i64, page: u32) {
        if let Some(args) = self.page_args(repo, turn, page) {
            self.shared.get::<Bus>().changed::<TurnLog>(&args);
        }
    }

    /// Says the runtimes changed: which are there, on, available, their models, their usage.
    pub(super) fn agent_changed(&self) {
        let bus = self.shared.get::<Bus>();
        bus.changed_all::<Agent>();
        // What a feature's next session runs on, and whether its message can go, follow them.
        bus.changed_all::<Feature>();
        bus.changed_all::<RecommendedMessage>();
    }
}
