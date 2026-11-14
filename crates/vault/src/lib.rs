//! The human's notes: one vault for every repository, kept by `ura` in a folder of its own, which
//! Obsidian opens as it is, and `ura serve` syncs with the phone.
//!
//! ```text
//! Uraeda/
//!   inbox/                      the human's: one note per capture
//!   wiki/<five folders>/        the agents': what was learned
//!   projects/<repository>/
//!     proposals/   research/
//!     specs/                    links to the repository's workflow files, to read
//!   .obsidian/plugins/uraeda/   the phone's plugin, which the sync carries
//!   .trash/                     what a deletion moved, on either side
//! ```
//!
//! The skill's `references/notes.md` is the contract: who owns each folder, and what an agent may
//! write there.

pub mod check;
pub mod config;
pub mod layout;
pub mod links;
pub mod manifest;
pub mod notes;
pub mod paths;
pub mod plan;
pub mod plugin;
pub mod walk;

use std::path::{Path, PathBuf};

/// A vault, by its folder.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Vault {
    root: PathBuf,
}

impl Vault {
    pub fn new(root: impl Into<PathBuf>) -> Vault {
        Vault { root: root.into() }
    }

    /// The vault the settings in `config_dir` name, or `Uraeda` in `data_dir`.
    pub fn locate(config_dir: &Path, data_dir: &Path) -> Result<Vault, config::ConfigError> {
        Ok(Vault::new(config::path(config_dir, data_dir)?))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The vault's name, its folder's: what an `obsidian://` link names it by.
    pub fn name(&self) -> String {
        self.root.file_name().map_or_else(
            || "Uraeda".to_string(),
            |n| n.to_string_lossy().into_owned(),
        )
    }

    /// A path of the vault, relative and clean, on disk: `None` for a path that leaves it.
    pub fn file(&self, relative: &str) -> Option<PathBuf> {
        paths::clean(relative).map(|clean| self.root.join(clean))
    }
}
