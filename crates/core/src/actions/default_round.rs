//! The rounds of questions that live on the default branch, outside any feature folder: the
//! inbox's triage and the decisions check. Each is a file at the top of `specs/`, answered as a
//! feature's round is, and committed alone with a subject of its own.

use std::fs;

use crate::files::document::hash;
use crate::files::frontmatter;
use crate::today::Date;

use super::place::Place;
use super::{ActionError, Change, Committed, answer, commit};

/// A round of questions on the default branch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DefaultRound {
    /// `INBOX-TRIAGE.md`: the agent's proposed triage of the inbox.
    Triage,
    /// `DECISIONS-CHECK.md`: the agent's questions about the decisions' coherence.
    DecisionsCheck,
}

impl DefaultRound {
    /// Every round, in the order they are read.
    pub const ALL: [Self; 2] = [Self::Triage, Self::DecisionsCheck];

    /// The file's path from the repository's root.
    pub const fn path(self) -> &'static str {
        match self {
            Self::Triage => "specs/INBOX-TRIAGE.md",
            Self::DecisionsCheck => "specs/DECISIONS-CHECK.md",
        }
    }

    /// The file's name, which is also its template's.
    pub fn file_name(self) -> &'static str {
        self.path().trim_start_matches("specs/")
    }

    /// The round's id among workflow files: it has no feature folder.
    pub const fn id(self) -> &'static str {
        match self {
            Self::Triage => "inbox-triage",
            Self::DecisionsCheck => "decisions-check",
        }
    }

    /// The subject of the commit submitting the round's answers.
    pub const fn answered_subject(self) -> &'static str {
        match self {
            Self::Triage => "chore: answer the inbox triage",
            Self::DecisionsCheck => "chore: answer the decisions check",
        }
    }

    /// The round with this id, none for an unknown one.
    pub fn from_id(id: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|round| round.id() == id)
    }

    /// The round whose file is named `name`, from the top of `specs/`.
    pub fn from_file_name(name: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|round| round.file_name() == name)
    }
}

/// Refuses the round as changed unless its text has the hash `base`: the page that writes or
/// submits it saw all of it.
pub fn ensure_unchanged(place: &Place, round: DefaultRound, base: &str) -> Result<(), ActionError> {
    if hash(&fs::read_to_string(place.root.join(round.path()))?) == base {
        Ok(())
    } else {
        Err(ActionError::changed(round.path()))
    }
}

/// The commit of the round alone, answered.
fn commit_round(place: &Place, round: DefaultRound) -> Result<Committed, ActionError> {
    commit::commit(
        place,
        &Change {
            paths: vec![round.path().to_string()],
            subject: round.answered_subject().to_string(),
            body: None,
        },
    )
}

/// Submits the round, answered as a feature's is, and commits it alone. Refused before anything is
/// written when it changed since it was read with the hash `previous`, or other files are staged.
pub fn submit(
    place: &Place,
    round: DefaultRound,
    previous: &str,
    today: Date,
) -> Result<Committed, ActionError> {
    ensure_unchanged(place, round, previous)?;
    super::place::ensure_only_staged(place, &[round.path().to_string()])?;
    answer::record(place, round.path(), today, false)?;
    commit_round(place, round)
}

/// Commits the round again after a hook refused its submit: only an answered round that the last
/// commit does not hold.
pub fn retry(place: &Place, round: DefaultRound) -> Result<Committed, ActionError> {
    let path = round.path();
    let text = fs::read_to_string(place.root.join(path))?;
    let answered = frontmatter::parse(&text)
        .ok()
        .is_some_and(|front| front.text("status") == Some("answered"));
    let git = crate::git::Git::open(&place.root)?;
    let committed = git
        .head()
        .and_then(|head| git.read_file(head, path).ok().flatten());
    if !answered || committed.as_deref() == Some(text.as_bytes()) {
        return Err(ActionError::Refused(format!(
            "{} has nothing to commit again",
            answer::name_of(path)
        )));
    }
    super::place::ensure_only_staged(place, &[path.to_string()])?;
    commit_round(place, round)
}
