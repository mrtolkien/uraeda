//! The messages sent to a feature while its start is still in the write queue: kept in memory
//! only, sent once the start lands, dropped if it is refused or the server stops, never sent
//! twice.

use std::collections::HashMap;

use super::manager::Runner;
use super::send::Message;

/// A start under way: the session its messages go to, once one is kept, and the messages.
pub(super) struct Waiting {
    messages: Vec<Message>,
    /// The run step the start begins with: a session made for it runs on that step's pick.
    run_step: &'static str,
    session: Option<String>,
}

/// The starts still in the write queue, by their repository's main checkout and their folder.
#[derive(Default)]
pub(super) struct Kept {
    waiting: HashMap<(String, String), Waiting>,
}

fn key(root: &str, folder: &str) -> (String, String) {
    (root.to_owned(), folder.to_owned())
}

impl Runner {
    /// Opens the start of a folder, which begins with `run_step`: the messages sent to it wait
    /// until [`Runner::take_kept`] or [`Runner::drop_start`].
    pub(crate) fn open_start(&self, root: &str, folder: &str, run_step: &'static str) {
        let waiting = Waiting {
            messages: Vec::new(),
            run_step,
            session: None,
        };
        self.state()
            .starts
            .waiting
            .insert(key(root, folder), waiting);
    }

    /// The run step the start of a folder begins with, while it is in the queue.
    pub(super) fn starting_step(&self, root: &str, folder: &str) -> Option<String> {
        let state = self.state();
        let waiting = state.starts.waiting.get(&key(root, folder));
        waiting.map(|waiting| waiting.run_step.to_owned())
    }

    /// Whether the start of a folder is still in the queue, keeping its messages.
    pub(crate) fn start_waits(&self, root: &str, folder: &str) -> bool {
        self.state().starts.waiting.contains_key(&key(root, folder))
    }

    /// Keeps a message for the start of a folder, to go to `session`, the feature's: the text
    /// of every message kept, for the start's write. None when the start is no longer in the
    /// queue: the message goes as to any feature.
    pub(crate) fn keep_for_start(
        &self,
        root: &str,
        folder: &str,
        session: &str,
        message: Message,
    ) -> Option<String> {
        let mut state = self.state();
        let waiting = state.starts.waiting.get_mut(&key(root, folder))?;
        waiting.session = Some(session.to_owned());
        waiting.messages.push(message);
        let texts: Vec<&str> = waiting
            .messages
            .iter()
            .map(|kept| kept.text.as_str())
            .collect();
        Some(texts.join("\n\n"))
    }

    /// Closes the start of a folder, which landed, and takes its messages, to send in order to
    /// their session: taken once, so none is sent twice.
    pub(crate) fn take_kept(&self, root: &str, folder: &str) -> Option<(String, Vec<Message>)> {
        let waiting = self.state().starts.waiting.remove(&key(root, folder))?;
        Some((waiting.session?, waiting.messages))
    }

    /// Closes the start of a folder, which was refused, its messages dropped: the session made
    /// for them goes, while it has no turn.
    pub(crate) fn drop_start(&self, root: &str, folder: &str) {
        let waiting = self.state().starts.waiting.remove(&key(root, folder));
        if let Some(session) = waiting.and_then(|waiting| waiting.session) {
            let _ = self.store().remove_empty_session(&session);
        }
    }

    /// Drops every start's messages, as the server stops: a start landing after sends nothing.
    pub(super) fn drop_kept(&self) {
        let waiting = std::mem::take(&mut self.state().starts.waiting);
        let sessions = waiting.into_values().filter_map(|waiting| waiting.session);
        for session in sessions {
            let _ = self.store().remove_empty_session(&session);
        }
    }
}
