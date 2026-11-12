//! The work that stops with the server: the one place a domain hangs its shutdown on.

use std::pin::Pin;
use std::sync::{Mutex, PoisonError};

use tokio::sync::watch;

/// A piece of work to run as the server stops, with its name for the log.
type Work = (&'static str, Pin<Box<dyn Future<Output = ()> + Send>>);

/// The work registered so far, and whether the server is stopping.
pub(crate) struct Stops {
    work: Mutex<Vec<Work>>,
    stopping: watch::Sender<bool>,
}

impl Default for Stops {
    fn default() -> Stops {
        Stops {
            work: Mutex::default(),
            stopping: watch::Sender::new(false),
        }
    }
}

impl Stops {
    /// Registers work to run as the server stops. Once it is stopping, the work runs at once:
    /// nothing registered is ever left running.
    pub(crate) fn add<F>(&self, name: &'static str, work: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let mut registered = self.work.lock().unwrap_or_else(PoisonError::into_inner);
        if *self.stopping.borrow() {
            tokio::spawn(work);
        } else {
            registered.push((name, Box::pin(work)));
        }
    }

    /// Waits until the server is stopping.
    pub(crate) async fn begun(&self) {
        let mut stopping = self.stopping.subscribe();
        // The sender lives as long as this value, so the wait only ends once stopping is true.
        let _ = stopping.wait_for(|stopping| *stopping).await;
    }

    /// Says the server is stopping, then runs the registered work, the last registered first, each
    /// to its end: a domain mounted later may use one mounted earlier until it has stopped.
    pub(crate) async fn run(&self) {
        let registered = {
            let mut registered = self.work.lock().unwrap_or_else(PoisonError::into_inner);
            self.stopping.send_replace(true);
            std::mem::take(&mut *registered)
        };
        for (name, work) in registered.into_iter().rev() {
            // In a task of its own: work that panics names itself, and the rest still stops.
            if tokio::spawn(work).await.is_err() {
                say_err!("uraeda: stopping {name} failed");
            }
        }
    }
}
