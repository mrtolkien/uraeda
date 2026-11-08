//! The extensions as the running server last saw them: each one's state and problems, loading and
//! compiling its code included, which the server writes to `extensions-status.json` in the data
//! folder whenever they change. `ura extension list` reads it, so an agent that wrote an
//! extension sees what the server made of it. The server writes it; this module only reads it.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// The file's name, in the data folder.
pub const STATUS_FILE: &str = "extensions-status.json";

/// The file's format version: a file of another version reads as none.
pub const STATUS_VERSION: u32 = 1;

/// The file: when the server wrote it, an ISO 8601 time, and each extension it knew.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct ServerStatus {
    pub version: u32,
    pub at: String,
    pub extensions: Vec<ServerExtension>,
}

/// An extension as the server saw it: `on`, `off`, `broken`, or `waiting`, for `waiting_for`'s
/// session to end its turn before reloading.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerExtension {
    pub name: String,
    pub state: String,
    #[serde(default)]
    pub problems: Vec<ServerProblem>,
    #[serde(default)]
    pub waiting_for: Option<String>,
}

/// A problem the server met: its file and line when known, and its message.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct ServerProblem {
    #[serde(default)]
    pub file: String,
    #[serde(default)]
    pub line: Option<u32>,
    pub message: String,
}

impl ServerProblem {
    /// The problem as messages show it: its file and line first, as `server.ts:3: …`.
    pub fn text(&self) -> String {
        match (self.file.as_str(), self.line) {
            ("", _) => self.message.clone(),
            (file, Some(line)) => format!("{file}:{line}: {}", self.message),
            (file, None) => format!("{file}: {}", self.message),
        }
    }
}

/// The status the server last wrote in `data_dir`: none when it never wrote one, or the file is
/// unreadable or of another version.
pub fn read_status(data_dir: &Path) -> Option<ServerStatus> {
    let text = fs::read_to_string(data_dir.join(STATUS_FILE)).ok()?;
    let status: ServerStatus = serde_json::from_str(&text).ok()?;
    (status.version == STATUS_VERSION).then_some(status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn reads_what_the_server_wrote() {
        let dir = TempDir::new().unwrap();
        let text = r#"{"version":1,"at":"2026-11-08T10:00:00.000Z","extensions":[
            {"name":"deploy","state":"broken","problems":[{"file":"server.ts","line":3,"message":"boom"},{"file":"page.tsx","message":"no"}],"waitingFor":null},
            {"name":"wiki","state":"waiting","problems":[],"waitingFor":"Fix it"}]}"#;
        fs::write(dir.path().join(STATUS_FILE), text).unwrap();
        let status = read_status(dir.path()).unwrap();
        assert_eq!(status.at, "2026-11-08T10:00:00.000Z");
        let texts: Vec<String> = status.extensions[0]
            .problems
            .iter()
            .map(ServerProblem::text)
            .collect();
        assert_eq!(texts, ["server.ts:3: boom", "page.tsx: no"]);
        assert_eq!(status.extensions[1].waiting_for.as_deref(), Some("Fix it"));
    }

    #[test]
    fn none_without_a_file_a_readable_one_or_its_version() {
        let dir = TempDir::new().unwrap();
        assert_eq!(read_status(dir.path()), None);
        fs::write(dir.path().join(STATUS_FILE), "{not json").unwrap();
        assert_eq!(read_status(dir.path()), None);
        let other = r#"{"version":2,"at":"x","extensions":[]}"#;
        fs::write(dir.path().join(STATUS_FILE), other).unwrap();
        assert_eq!(read_status(dir.path()), None);
    }
}
