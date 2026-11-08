//! The extensions as the running server last saw them: each one's state and problems, loading and
//! compiling its code included, which the server writes to `run/extensions-status.json` in the
//! data folder whenever they change, with its process id, and removes as it stops. `ura extension
//! list` reads it, so an agent that wrote an extension sees what the server made of it. The server
//! writes it; this module only reads it, and reads a file whose server is gone as none.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// The file's name, in the data folder's `run/`, where the files that live while a server runs go.
pub const STATUS_FILE: &str = "extensions-status.json";

/// The file's format version: a file of another version reads as none.
pub const STATUS_VERSION: u32 = 1;

/// The file: the server's process id, when it wrote it, an ISO 8601 time, and each extension it
/// knew.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct ServerStatus {
    pub version: u32,
    pub pid: u32,
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

/// The status the server last wrote in `data_dir`: none when it never wrote one, the file is
/// unreadable or of another version, or its server no longer runs, as one killed leaves it.
pub fn read_status(data_dir: &Path) -> Option<ServerStatus> {
    let text = fs::read_to_string(data_dir.join("run").join(STATUS_FILE)).ok()?;
    let status: ServerStatus = serde_json::from_str(&text).ok()?;
    (status.version == STATUS_VERSION && runs(status.pid)).then_some(status)
}

/// Whether a process of id `pid` runs: one of another user's counts.
#[cfg(unix)]
fn runs(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return false;
    };
    if pid <= 0 {
        return false;
    }
    // SAFETY: `kill` takes no pointer; signal 0 only checks that the process exists.
    let sent = unsafe { libc::kill(pid, 0) };
    sent == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

/// Without unix, a file is read as its server's while it is there.
#[cfg(not(unix))]
fn runs(_pid: u32) -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn reads_what_the_server_wrote() {
        let dir = TempDir::new().unwrap();
        let text = format!(
            r#"{{"version":1,"pid":{},"at":"2026-11-08T10:00:00.000Z","extensions":[
            {{"name":"deploy","state":"broken","problems":[{{"file":"server.ts","line":3,"message":"boom"}},{{"file":"page.tsx","message":"no"}}],"waitingFor":null}},
            {{"name":"wiki","state":"waiting","problems":[],"waitingFor":"Fix it"}}]}}"#,
            std::process::id()
        );
        fs::create_dir(dir.path().join("run")).unwrap();
        fs::write(dir.path().join("run").join(STATUS_FILE), text).unwrap();
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
        fs::create_dir(dir.path().join("run")).unwrap();
        fs::write(dir.path().join("run").join(STATUS_FILE), "{not json").unwrap();
        assert_eq!(read_status(dir.path()), None);
        let of = |version: u32, pid: u32| {
            format!(r#"{{"version":{version},"pid":{pid},"at":"x","extensions":[]}}"#)
        };
        fs::write(
            dir.path().join("run").join(STATUS_FILE),
            of(2, std::process::id()),
        )
        .unwrap();
        assert_eq!(read_status(dir.path()), None);
        // Without a process id, as a server before them wrote it.
        let unknown = r#"{"version":1,"at":"x","extensions":[]}"#;
        fs::write(dir.path().join("run").join(STATUS_FILE), unknown).unwrap();
        assert_eq!(read_status(dir.path()), None);
    }

    // Break: the process id not checked, so a server killed left its last status read.
    #[cfg(unix)]
    #[test]
    fn none_once_its_server_no_longer_runs() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("run")).unwrap();
        let mut child = std::process::Command::new("true").spawn().unwrap();
        let gone = child.id();
        child.wait().unwrap();
        let text = format!(r#"{{"version":1,"pid":{gone},"at":"x","extensions":[]}}"#);
        fs::write(dir.path().join("run").join(STATUS_FILE), text).unwrap();
        assert_eq!(read_status(dir.path()), None);
    }
}
