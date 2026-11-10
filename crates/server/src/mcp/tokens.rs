//! The tokens of the MCP endpoint: one per agent process, the only sign-in `/mcp` takes.

use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

use crate::secret::{self, Hashed};

/// A random token per agent process, kept only as its hash, with the session it was issued to.
/// A session holds one token at a time, as it runs one process at a time.
#[derive(Default)]
pub(super) struct Tokens {
    /// The hash of each session's token, by session.
    hashes: Mutex<HashMap<String, Hashed>>,
}

impl Tokens {
    /// A new token for `session`'s new process: 32 random bytes. The token of its earlier
    /// process is revoked.
    pub(super) fn issue(&self, session: &str) -> String {
        let token = secret::random(32);
        let mut hashes = self.hashes.lock().unwrap_or_else(PoisonError::into_inner);
        hashes.insert(session.to_owned(), Hashed::of(&token));
        token
    }

    /// Revokes a token: one no longer issued is left as it is.
    pub(super) fn revoke(&self, token: &str) {
        let mut hashes = self.hashes.lock().unwrap_or_else(PoisonError::into_inner);
        hashes.retain(|_, kept| !kept.is(token));
    }

    /// The session of an `Authorization: Bearer <token>` header: none for no header, another
    /// scheme, or a token not issued now. Every token is compared, each in constant time, so the
    /// answer's timing tells nothing of which one was close.
    pub(super) fn session_of(&self, authorization: Option<&str>) -> Option<String> {
        let token = authorization?.strip_prefix("Bearer ")?;
        let hashes = self.hashes.lock().unwrap_or_else(PoisonError::into_inner);
        let mut found = None;
        for (session, kept) in hashes.iter() {
            if kept.is(token) {
                found = Some(session.clone());
            }
        }
        found
    }
}
