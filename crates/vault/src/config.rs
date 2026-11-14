//! The `[vault]` section of `config.toml`, in Uraeda's config folder:
//!
//! ```toml
//! [vault]
//! path = "~/Notes/Uraeda"
//! ```
//!
//! Without it, the vault is `Uraeda` in Uraeda's data folder, which exists on every system.

use std::path::{Path, PathBuf};

use toml_edit::{DocumentMut, Item};

/// The settings' file, in the config folder.
pub const FILE: &str = "config.toml";

/// The vault's folder name when the settings name none.
pub const DEFAULT_NAME: &str = "Uraeda";

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} could not be read: {1}")]
    Read(PathBuf, std::io::Error),
    #[error("{0} is not valid TOML: {1}")]
    Parse(PathBuf, String),
    #[error("{0}: [vault] path is a folder")]
    Value(PathBuf),
}

/// The vault's folder: `[vault] path` of `config_dir`'s file, else `Uraeda` in `data_dir`.
pub fn path(config_dir: &Path, data_dir: &Path) -> Result<PathBuf, ConfigError> {
    let file = config_dir.join(FILE);
    let text = read(&file)?;
    let home = std::env::home_dir().unwrap_or_default();
    Ok(parse(&text, &home)
        .map_err(|problem| match problem {
            Problem::Toml(message) => ConfigError::Parse(file.clone(), message),
            Problem::Value => ConfigError::Value(file.clone()),
        })?
        .unwrap_or_else(|| data_dir.join(DEFAULT_NAME)))
}

/// What is wrong with a file's text.
#[derive(Debug, PartialEq, Eq)]
pub enum Problem {
    Toml(String),
    Value,
}

/// `[vault] path` in a file's text, `~/` read as `home`.
pub fn parse(text: &str, home: &Path) -> Result<Option<PathBuf>, Problem> {
    let document: DocumentMut = text
        .parse()
        .map_err(|e: toml_edit::TomlError| Problem::Toml(e.message().to_string()))?;
    let Some(value) = document
        .get("vault")
        .and_then(Item::as_table_like)
        .and_then(|section| section.get("path"))
    else {
        return Ok(None);
    };
    match value.as_str().map(str::trim) {
        Some("") => Ok(None),
        Some(folder) => Ok(Some(expand(folder, home))),
        None => Err(Problem::Value),
    }
}

/// Sets `[vault] path` in `config_dir`'s file, `None` removing it, and keeps the rest of the file
/// as it was: its other values, its comments, and its order.
pub fn set_path(config_dir: &Path, folder: Option<&str>) -> Result<(), ConfigError> {
    let file = config_dir.join(FILE);
    let text = read(&file)?;
    let mut document: DocumentMut = text.parse().map_err(|e: toml_edit::TomlError| {
        ConfigError::Parse(file.clone(), e.message().to_string())
    })?;
    if !document.contains_key("vault") {
        document["vault"] = toml_edit::table();
    }
    let section = document["vault"]
        .as_table_like_mut()
        .ok_or_else(|| ConfigError::Value(file.clone()))?;
    match folder.map(str::trim).filter(|f| !f.is_empty()) {
        Some(folder) => {
            section.insert("path", toml_edit::value(folder));
        }
        None => {
            section.remove("path");
        }
    }
    std::fs::create_dir_all(config_dir).map_err(|e| ConfigError::Read(file.clone(), e))?;
    std::fs::write(&file, document.to_string()).map_err(|e| ConfigError::Read(file, e))
}

fn read(file: &Path) -> Result<String, ConfigError> {
    match std::fs::read_to_string(file) {
        Ok(text) => Ok(text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(ConfigError::Read(file.to_path_buf(), error)),
    }
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
    fn no_section_is_the_default() {
        assert_eq!(parse("[serve]\nport = 1\n", Path::new("/h")), Ok(None));
        let config = tempfile::tempdir().unwrap();
        assert_eq!(
            path(config.path(), Path::new("/data")).unwrap(),
            PathBuf::from("/data/Uraeda")
        );
    }

    #[test]
    fn reads_the_path_with_home() {
        assert_eq!(
            parse("[vault]\npath = \"~/Notes/U\"\n", Path::new("/h")),
            Ok(Some(PathBuf::from("/h/Notes/U")))
        );
        assert_eq!(
            parse("[vault]\npath = 3\n", Path::new("/h")),
            Err(Problem::Value)
        );
    }

    #[test]
    fn setting_keeps_the_rest_of_the_file() {
        let config = tempfile::tempdir().unwrap();
        let file = config.path().join(FILE);
        std::fs::write(&file, "# mine\n[serve]\nport = 4400\n").unwrap();
        set_path(config.path(), Some("/notes/V")).unwrap();
        let text = std::fs::read_to_string(&file).unwrap();
        assert!(text.starts_with("# mine\n[serve]\nport = 4400\n"), "{text}");
        assert_eq!(
            path(config.path(), Path::new("/d")).unwrap(),
            PathBuf::from("/notes/V")
        );
        set_path(config.path(), None).unwrap();
        assert_eq!(
            path(config.path(), Path::new("/d")).unwrap(),
            PathBuf::from("/d/Uraeda")
        );
    }
}
