//! Secrets that work once, within a time: the pairing codes and the one-time links. They live in
//! memory only, as hashes, and a restart of the server ends them all.

use std::sync::{Mutex, PoisonError};
use std::time::{Duration, SystemTime};

use crate::secret::Hashed;

/// A secret held until it is used or its time passes, with what it stands for.
struct Held<T> {
    secret: Hashed,
    expires: SystemTime,
    what: T,
}

/// The secrets of one kind that were made and not used yet.
pub(crate) struct Once<T> {
    lives: Duration,
    held: Mutex<Vec<Held<T>>>,
}

impl<T> Once<T> {
    /// Secrets that each live `lives` after they are made, on the server's clock.
    pub(crate) fn new(lives: Duration) -> Once<T> {
        Once {
            lives,
            held: Mutex::default(),
        }
    }

    /// Holds a new secret, for what it stands for. The ones whose time passed go.
    pub(crate) fn hold(&self, secret: &str, what: T, now: SystemTime) {
        let mut held = self.held.lock().unwrap_or_else(PoisonError::into_inner);
        held.retain(|held| held.expires >= now);
        held.push(Held {
            secret: Hashed::of(secret),
            expires: now + self.lives,
            what,
        });
    }

    /// What a secret stands for, the first time it is used within its time: nothing after, and
    /// nothing for a secret that was never made.
    pub(crate) fn take(&self, secret: &str, now: SystemTime) -> Option<T> {
        let mut held = self.held.lock().unwrap_or_else(PoisonError::into_inner);
        let found = held.iter().position(|held| held.secret.is(secret))?;
        let taken = held.swap_remove(found);
        (taken.expires >= now).then_some(taken.what)
    }
}
