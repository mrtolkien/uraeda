//! The `[serve]` section of `config.toml`, in Uraeda's config folder. Every value is optional:
//!
//! ```toml
//! [serve]
//! port = 4320
//! repositories = ["~/code/todo", "~/code/uraeda"]
//! wake = "t3"
//! ```
//!
//! `repositories` lists the main checkouts whose worktrees are served; without it, the repository
//! of the folder `ura serve` starts in. `wake` names who is told when the human submits a round or
//! a verdict: `t3` for T3 Code; nobody without it.

use std::path::{Path, PathBuf};

use toml_edit::{DocumentMut, Item};
use uraeda_core::git::Git;

/// The settings' file, in the config folder.
pub const FILE: &str = "config.toml";

/// Who is told when the human hands work back.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Wake {
    /// T3 Code, through its `t3` command: `program` is the command, `t3` found on the `PATH`
    /// unless a test names another.
    T3 { program: PathBuf },
}

impl Wake {
    /// T3 Code through the `t3` found on the `PATH`.
    pub fn t3() -> Wake {
        Wake::T3 {
            program: PathBuf::from("t3"),
        }
    }
}

/// `ura serve`'s settings.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Settings {
    pub port: Option<u16>,
    /// The main checkouts, absolute.
    pub repositories: Vec<PathBuf>,
    pub wake: Option<Wake>,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} could not be read: {1}")]
    Read(PathBuf, std::io::Error),
    #[error("{0} is not valid TOML: {1}")]
    Parse(PathBuf, String),
    #[error("{0}: [serve] {1}")]
    Value(PathBuf, String),
    #[error(
        "no repository to serve: name some in [serve] repositories of {0}, or start in a repository"
    )]
    NoRepository(PathBuf),
}

/// The settings in `config_dir`'s file, the repository of `cwd` when they name none.
pub fn read(config_dir: &Path, cwd: &Path) -> Result<Settings, ConfigError> {
    let path = config_dir.join(FILE);
    let text = match std::fs::read_to_string(&path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(ConfigError::Read(path, error)),
    };
    let home = std::env::home_dir().unwrap_or_default();
    let mut settings = parse(&text, &home).map_err(|e| match e {
        Problem::Toml(message) => ConfigError::Parse(path.clone(), message),
        Problem::Value(message) => ConfigError::Value(path.clone(), message),
    })?;
    if settings.repositories.is_empty() {
        let git = Git::discover(cwd).map_err(|_| ConfigError::NoRepository(path.clone()))?;
        settings.repositories.push(git.main_root());
    }
    Ok(settings)
}

/// What is wrong with a file's text.
#[derive(Debug, PartialEq, Eq)]
pub enum Problem {
    Toml(String),
    Value(String),
}

/// The `[serve]` section of a file's text, `~/` read as `home`.
pub fn parse(text: &str, home: &Path) -> Result<Settings, Problem> {
    let document: DocumentMut = text
        .parse()
        .map_err(|e: toml_edit::TomlError| Problem::Toml(e.message().to_string()))?;
    let Some(section) = document.get("serve").and_then(Item::as_table_like) else {
        return Ok(Settings::default());
    };
    let mut settings = Settings::default();
    if let Some(port) = section.get("port") {
        let port = port
            .as_integer()
            .and_then(|n| u16::try_from(n).ok())
            .filter(|n| *n > 0)
            .ok_or_else(|| Problem::Value("port is a whole number from 1 to 65535".into()))?;
        settings.port = Some(port);
    }
    if let Some(list) = section.get("repositories") {
        let list = list
            .as_array()
            .ok_or_else(|| Problem::Value("repositories is a list of folders".into()))?;
        for value in list {
            let folder = value
                .as_str()
                .ok_or_else(|| Problem::Value("repositories is a list of folders".into()))?;
            settings.repositories.push(expand(folder, home));
        }
    }
    if let Some(wake) = section.get("wake") {
        settings.wake = match wake.as_str() {
            Some("t3") => Some(Wake::t3()),
            Some("") | Some("none") => None,
            _ => return Err(Problem::Value("wake is \"t3\" or \"none\"".into())),
        };
    }
    Ok(settings)
}

/// A folder as written, `~/` read as `home`.
fn expand(folder: &str, home: &Path) -> PathBuf {
    match folder.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None if folder == "~" => home.to_path_buf(),
        None => PathBuf::from(folder),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_section_is_the_defaults() {
        assert_eq!(
            parse("[server]\nx = 1\n", Path::new("/h")),
            Ok(Settings::default())
        );
    }

    #[test]
    fn reads_every_value() {
        let text = "[serve]\nport = 4400\nrepositories = [\"~/a\", \"/b\"]\nwake = \"t3\"\n";
        assert_eq!(
            parse(text, Path::new("/h")),
            Ok(Settings {
                port: Some(4400),
                repositories: vec![PathBuf::from("/h/a"), PathBuf::from("/b")],
                wake: Some(Wake::t3()),
            })
        );
    }

    #[test]
    fn refuses_a_wrong_value() {
        assert!(matches!(
            parse("[serve]\nport = 0\n", Path::new("/h")),
            Err(Problem::Value(_))
        ));
        assert!(matches!(
            parse("[serve]\nwake = \"slack\"\n", Path::new("/h")),
            Err(Problem::Value(_))
        ));
        assert!(matches!(
            parse("[serve\n", Path::new("/h")),
            Err(Problem::Toml(_))
        ));
    }
}
