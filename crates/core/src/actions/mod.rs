//! The human actions on workflow files: each checks every condition before writing anything, and
//! returns the files it changed and the commit to make.

pub mod answer;
pub mod commit;
pub mod draft;
pub mod init;
pub mod place;
pub mod priorities;
pub mod review;
pub mod start;
pub mod text;

use crate::files::clarifications::AnswerError;
use crate::git::GitError;

/// Files an action wrote, from the top level of the working tree it wrote in, and the commit
/// that records them. No paths means nothing to commit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Change {
    pub paths: Vec<String>,
    pub subject: String,
    pub body: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ActionError {
    #[error("{0}")]
    Refused(String),
    #[error(transparent)]
    Answer(#[from] AnswerError),
    #[error(transparent)]
    Git(#[from] GitError),
    #[error("{0}")]
    Io(String),
    /// A save over a file changed since it was read: nothing was written.
    #[error("{name} changed on disk since you opened it. Your text was not saved.")]
    Changed { path: String, name: String },
    /// A commit refused by a hook: the files stay written. `output` is the hook's whole report.
    #[error("git commit failed: {message}")]
    Hook { message: String, output: String },
}

impl ActionError {
    /// A save refused because `path` changed since it was read.
    pub fn changed(path: &str) -> ActionError {
        ActionError::Changed {
            path: path.to_string(),
            name: path.rsplit('/').next().unwrap_or(path).to_string(),
        }
    }
}

/// A change and the short hash of the commit that recorded it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Committed {
    pub change: Change,
    pub commit: String,
}

impl From<std::io::Error> for ActionError {
    fn from(error: std::io::Error) -> ActionError {
        ActionError::Io(error.to_string())
    }
}

/// `Q7`, `Q7 and Q9`, `Q1, Q7, and Q9`.
pub(crate) fn list(items: &[String]) -> String {
    match items {
        [] => String::new(),
        [one] => one.clone(),
        [first, second] => format!("{first} and {second}"),
        [rest @ .., last] => format!("{}, and {last}", rest.join(", ")),
    }
}
