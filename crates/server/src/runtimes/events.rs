//! The stream of one process's events: written by its runtime from any thread, read in order
//! by one reader, and ended by exactly one `exit`.

use std::sync::{Arc, Mutex};

use tokio::sync::mpsc;

use crate::live::locked;
use crate::runner::Event;

/// A new stream: what a runtime writes its process's events on, and what its reader reads.
pub fn events() -> (Emitter, Events) {
    let (sender, receiver) = mpsc::unbounded_channel();
    let emitter = Emitter(Arc::new(Mutex::new(Some(sender))));
    let events = Events {
        receiver,
        exited: false,
    };
    (emitter, events)
}

/// The writing end of a process's events, cheap to clone, for any thread or task: the task
/// that reads an agent's output, a VM's thread.
///
/// It never waits and never fills: an agent's output is read as it comes, since an agent that
/// is read slowly loses its last lines, and an event is small.
#[derive(Clone)]
pub struct Emitter(Arc<Mutex<Option<mpsc::UnboundedSender<Event>>>>);

impl Emitter {
    /// Writes an event: whether it was taken. An `exit` is the last one: it ends the stream,
    /// and every event after it is dropped, as is one whose reader is gone.
    pub fn send(&self, event: Event) -> bool {
        let mut sender = locked(&self.0);
        let Some(open) = sender.as_ref() else {
            return false;
        };
        let last = matches!(event, Event::Exit { .. });
        let taken = open.send(event).is_ok();
        if last || !taken {
            *sender = None;
        }
        taken
    }

    /// Whether the stream ended: its `exit` was written, or its reader is gone.
    pub fn has_exited(&self) -> bool {
        locked(&self.0).is_none()
    }
}

/// The reading end of a process's events, for its one reader.
///
/// The events come in the order they were written, and the last is always one `exit`: the
/// process's own, or, for a runtime that went silent without one, as a VM that was stopped, an
/// `exit` with no code. After it, the stream gives nothing.
pub struct Events {
    receiver: mpsc::UnboundedReceiver<Event>,
    exited: bool,
}

impl Events {
    /// A stream that has ended already: it gives its `exit`, then nothing.
    pub fn ended() -> Events {
        events().1
    }

    /// The next event, awaited in a task: none once the `exit` was read.
    pub async fn next(&mut self) -> Option<Event> {
        if self.exited {
            return None;
        }
        let next = self.receiver.recv().await;
        Some(self.read(next))
    }

    /// The next event, waited for on a blocking thread, as a handler's: none once the `exit`
    /// was read.
    ///
    /// # Panics
    ///
    /// In a task: await [`Events::next`] there.
    pub fn blocking_next(&mut self) -> Option<Event> {
        if self.exited {
            return None;
        }
        let next = self.receiver.blocking_recv();
        Some(self.read(next))
    }

    /// What was received, or the `exit` of a stream whose writers are gone.
    fn read(&mut self, received: Option<Event>) -> Event {
        let event = received.unwrap_or(Event::Exit {
            code: None,
            missing: None,
            stderr: String::new(),
        });
        self.exited = matches!(event, Event::Exit { .. });
        event
    }
}
