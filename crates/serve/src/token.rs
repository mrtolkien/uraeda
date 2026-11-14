//! The token that opens the pages: 32 random bytes in hex, kept in `serve-token` of the data
//! folder, readable by its owner alone, so it stays the same from one start to the next. The human
//! signs in with it once per browser, and the phone's plugin sends it with every request.
//!
//! Two values are derived from it, neither of which gives it back: the session a signed-in
//! browser keeps in its cookie, and the key in the address of a feature's files (see
//! [`crate::files`]).

use std::fs;
use std::io::Write as _;
use std::path::Path;

/// The token's file, in the data folder.
pub const FILE: &str = "serve-token";

/// The token kept in `dir`, made and written the first time.
pub fn keep(dir: &Path) -> std::io::Result<String> {
    let path = dir.join(FILE);
    if let Ok(text) = fs::read_to_string(&path) {
        let text = text.trim();
        if text.len() == 64 && text.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Ok(text.to_string());
        }
    }
    fs::create_dir_all(dir)?;
    let token = new();
    let mut file = open_private(&path)?;
    file.write_all(token.as_bytes())?;
    Ok(token)
}

/// A new token.
pub fn new() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("the system's random bytes");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// What a signed-in browser's cookie holds.
pub fn session(token: &str) -> String {
    uraeda_vault::manifest::hash_bytes(format!("uraeda session\n{token}").as_bytes())
}

/// The key in the address of a feature's files, 32 hex characters.
pub fn files_key(token: &str) -> String {
    uraeda_vault::manifest::hash_bytes(format!("uraeda files\n{token}").as_bytes())[..32]
        .to_string()
}

/// Whether `given` is `token`, compared in a time that does not depend on where they differ.
pub fn matches(token: &str, given: &str) -> bool {
    token.len() == given.len()
        && token
            .bytes()
            .zip(given.bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0
}

#[cfg(unix)]
fn open_private(path: &Path) -> std::io::Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt as _;
    fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn open_private(path: &Path) -> std::io::Result<fs::File> {
    fs::File::create(path)
}
