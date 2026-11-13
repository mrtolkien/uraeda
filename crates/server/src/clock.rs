//! The server's clock: the system's, or one a test sets.

use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, SystemTime};

/// What time it is, for everything the server dates or lets expire. A clone shares the time.
#[derive(Clone, Debug, Default)]
pub struct Clock(Option<Arc<Mutex<SystemTime>>>);

impl Clock {
    /// The system's clock, as `ura serve` runs on.
    pub fn system() -> Clock {
        Clock(None)
    }

    /// A clock that stands at `at` until it is set or advanced, for tests.
    pub fn fixed(at: SystemTime) -> Clock {
        Clock(Some(Arc::new(Mutex::new(at))))
    }

    /// The time now.
    pub fn now(&self) -> SystemTime {
        self.0.as_ref().map_or_else(SystemTime::now, |at| *lock(at))
    }

    /// Moves a fixed clock to `at`.
    ///
    /// # Panics
    ///
    /// On the system's clock, which is not the server's to set.
    pub fn set(&self, at: SystemTime) {
        *lock(self.0.as_ref().expect("only a fixed clock is set")) = at;
    }

    /// Moves a fixed clock forward.
    ///
    /// # Panics
    ///
    /// On the system's clock, which is not the server's to set.
    pub fn advance(&self, by: Duration) {
        self.set(self.now() + by);
    }
}

/// The time a fixed clock holds: a writer that panicked left it whole.
fn lock(at: &Mutex<SystemTime>) -> std::sync::MutexGuard<'_, SystemTime> {
    at.lock().unwrap_or_else(PoisonError::into_inner)
}
