//! Random secrets, and how one is compared: the host token here, and sign-in's keys, sessions, and
//! device tokens.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sha2::{Digest, Sha256};

/// A new secret of `bytes` random bytes, in base64url.
///
/// # Panics
///
/// When the system gives no random bytes: nothing the server makes would be secret.
pub fn random(bytes: usize) -> String {
    let mut buffer = vec![0; bytes];
    getrandom::fill(&mut buffer).expect("the system's random bytes");
    URL_SAFE_NO_PAD.encode(buffer)
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
