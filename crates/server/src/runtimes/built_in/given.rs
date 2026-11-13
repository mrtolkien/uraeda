//! The folders both built-in agents are given: the Uraeda skill, and the documentation of the
//! extension API, which the instructions name.
//!
//! The server is one binary, which holds both: it writes them in its data folder, where the
//! agents read them, as the first process of each start opens.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use uraeda_core::embedded::SKILL;
use uraeda_core::extensions::extensions_dir;

/// The documentation of the extension API, as it was when the server was built.
const DOCS: &str = include_str!("../../../../../docs/extensions.md");

/// The skill's name, and the name of the plugin Claude Code loads it as.
pub(in crate::runtimes) const SKILL_NAME: &str = "uraeda";

/// Where a session's agent finds what every built-in agent is given: one per server, which
/// `runtimes::mount` provides.
pub(in crate::runtimes) struct Given {
    /// The folder of the skill's plugin, `<data folder>/plugin`, which holds `skills/`.
    pub plugin: PathBuf,
    /// The folder of skills, `<data folder>/plugin/skills`, which holds `uraeda/`.
    pub skills: PathBuf,
    /// The owner's extensions folder, `<config folder>/extensions`, where sessions write them.
    pub extensions: PathBuf,
    /// The documentation of the extension API, which sessions are told to read.
    pub docs: PathBuf,
    /// Whether the skill and the documentation were written since the server started.
    written: OnceLock<()>,
}

impl Given {
    /// The folders of a server, by its config and data folders. Nothing is made yet.
    pub(in crate::runtimes) fn new(config_dir: &Path, data_dir: &Path) -> Given {
        let plugin = data_dir.join("plugin");
        Given {
            skills: plugin.join("skills"),
            plugin,
            extensions: extensions_dir(config_dir),
            docs: data_dir.join("docs/extensions.md"),
            written: OnceLock::new(),
        }
    }

    /// Makes what a process is started with: the extensions folder, and, once per server, the
    /// skill and the documentation. A folder that cannot be made is left to the agent, which
    /// says so.
    pub(in crate::runtimes) fn prepare(&self) {
        let _ = fs::create_dir_all(&self.extensions);
        self.written.get_or_init(|| {
            write_skill(&self.skills.join(SKILL_NAME));
            let _ = write_new(&self.docs, DOCS.as_bytes());
        });
    }
}

/// Writes the skill the server holds in a folder: each of its files, and no other left there,
/// as a file an older server wrote and this one's skill no longer has. No file of the skill is
/// ever missing meanwhile, for a session that reads it.
fn write_skill(folder: &Path) {
    let mut held = Vec::new();
    let mut dirs = vec![&SKILL];
    while let Some(dir) = dirs.pop() {
        for file in dir.files() {
            let path = folder.join(file.path());
            let _ = write_new(&path, file.contents());
            held.push(path);
        }
        dirs.extend(dir.dirs());
    }
    remove_others(folder, &held);
}

/// Removes the files under a folder that are not among `held`.
fn remove_others(folder: &Path, held: &[PathBuf]) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            remove_others(&path, held);
            // Only an empty folder goes.
            let _ = fs::remove_dir(&path);
        } else if !held.contains(&path) {
            let _ = fs::remove_file(&path);
        }
    }
}

/// Writes a file unless it holds these bytes already: sessions opening together write the same.
pub(in crate::runtimes) fn write_new(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if fs::read(path).is_ok_and(|old| old == bytes) {
        return Ok(());
    }
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder)?;
    }
    fs::write(path, bytes)
}
