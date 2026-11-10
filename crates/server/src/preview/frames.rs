//! The frame secret: the only place that knows the secret a preview's and a mockup's path carry,
//! since a sandboxed frame sends no cookie. One for the whole server, in memory, made at each
//! start and replaced whenever a session or a device ends.

use std::sync::{PoisonError, RwLock};

use crate::{guard, secret};

/// The secret's random bytes.
const BYTES: usize = 32;

/// The secret of preview paths, `/r/<repository>/preview/<secret>/<folder>/`, and mockup paths,
/// `/r/<repository>/mockups/<secret>/<path>`.
pub(crate) struct Frames {
    current: RwLock<String>,
}

impl Frames {
    /// A new secret: 32 random bytes, in base64url.
    pub(super) fn new() -> Frames {
        Frames {
            current: RwLock::new(secret::random(BYTES)),
        }
    }

    /// The current secret, which only a signed-in client receives, in a record's address.
    pub(crate) fn current(&self) -> String {
        self.current
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Whether `text` is the current secret, compared in constant time.
    pub(crate) fn check(&self, text: &str) -> bool {
        secret::same(text, &self.current())
    }

    /// Whether `path` is a preview's or a mockup's path whose secret is the current one.
    pub(crate) fn allows(&self, path: &str) -> bool {
        guard::frame_secret(path).is_some_and(|secret| self.check(secret))
    }

    /// Makes a new secret at once: the old one is refused from then on.
    pub(super) fn replace(&self) {
        let mut current = self.current.write().unwrap_or_else(PoisonError::into_inner);
        *current = secret::random(BYTES);
    }
}
