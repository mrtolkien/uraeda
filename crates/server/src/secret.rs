//! Random secrets, how one is stored, and how one is compared: the host token here, and sign-in's
//! keys, sessions, device tokens, pairing codes, and one-time links.

use std::fmt;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// A new secret of `bytes` random bytes, in base64url.
///
/// # Panics
///
/// When the system gives no random bytes: nothing the server makes would be secret.
pub fn random(bytes: usize) -> String {
    URL_SAFE_NO_PAD.encode(random_bytes(bytes))
}

/// `count` random bytes, for a secret written another way than base64url.
///
/// # Panics
///
/// When the system gives no random bytes: nothing the server makes would be secret.
pub fn random_bytes(count: usize) -> Vec<u8> {
    let mut buffer = vec![0; count];
    getrandom::fill(&mut buffer).expect("the system's random bytes");
    buffer
}

/// A secret's hash, its SHA-256 in base64url: the only form a key, a session's secret, a device's
/// token, a pairing code, or a one-time link is kept in, in a file or in memory.
///
/// It has no `==`, no order, and no text to read, on purpose: [`Hashed::is`] is the one way to
/// compare it, in constant time. A test of sign-in stops compiling when it gains one.
#[derive(Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Hashed(String);

impl Hashed {
    /// The hash of a secret.
    pub fn of(secret: &str) -> Hashed {
        Hashed(URL_SAFE_NO_PAD.encode(Sha256::digest(secret.as_bytes())))
    }

    /// Whether `secret` is the secret this is the hash of, in a time that says nothing of how
    /// much of a guess was right.
    pub fn is(&self, secret: &str) -> bool {
        same(&Hashed::of(secret).0, &self.0)
    }
}

impl fmt::Debug for Hashed {
    /// Nothing of the hash: a log never holds one.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Hashed(..)")
    }
}

/// Whether two secrets are the same, in a time that says nothing of where they differ: their
/// hashes are compared whole.
pub fn same(given: &str, expected: &str) -> bool {
    let given = Sha256::digest(given.as_bytes());
    let expected = Sha256::digest(expected.as_bytes());
    given
        .iter()
        .zip(expected.iter())
        .fold(0, |differences, (a, b)| differences | (a ^ b))
        == 0
}
