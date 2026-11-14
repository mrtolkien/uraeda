//! Uraeda's data folder, where `ura serve` and the vault keep their files.

use std::path::{Path, PathBuf};

/// The name of Uraeda's folder in the operating system's folder for application data.
const FOLDER: &str = "uraeda";

/// Uraeda's data folder for the user: `URAEDA_DATA_DIR`, or else the operating system's default for
/// application data. `var` reads the environment, an empty value counting as unset; `os` is
/// `std::env::consts::OS`.
pub fn data_dir(var: impl Fn(&str) -> Option<String>, os: &str, home: &Path) -> PathBuf {
    let var = |name: &str| var(name).filter(|value| !value.is_empty());
    if let Some(folder) = var("URAEDA_DATA_DIR") {
        return PathBuf::from(folder);
    }
    system_data_dir(var, os, home, FOLDER)
}

/// A folder of a name in the operating system's folder for application data.
fn system_data_dir(
    var: impl Fn(&str) -> Option<String>,
    os: &str,
    home: &Path,
    name: &str,
) -> PathBuf {
    match os {
        // Joined with `\` whatever the platform this runs on.
        "windows" => {
            let roaming =
                var("APPDATA").unwrap_or_else(|| format!("{}\\AppData\\Roaming", home.display()));
            PathBuf::from(format!("{roaming}\\{name}"))
        }
        "macos" => home.join("Library/Application Support").join(name),
        _ => var("XDG_DATA_HOME")
            .map_or_else(|| home.join(".local/share"), PathBuf::from)
            .join(name),
    }
}

/// The data folder from this process's environment.
pub fn default_data_dir() -> PathBuf {
    let home = std::env::home_dir().unwrap_or_default();
    data_dir(|name| std::env::var(name).ok(), std::env::consts::OS, &home)
}
