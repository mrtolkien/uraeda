//! `ura serve`: the pages to answer rounds and review specs and plans, until it is stopped.

use std::path::PathBuf;
use std::process::ExitCode;

use uraeda_core::{repositories, settings};

/// Serves the pages on `port`, or the settings' port, with the token kept in `data_dir`.
pub fn run(port: Option<u16>, data_dir: Option<PathBuf>) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let options = uraeda_serve::Options {
        port,
        config_dir: cwd.join(settings::default_config_dir()),
        data_dir: cwd.join(data_dir.unwrap_or_else(repositories::default_data_dir)),
        cwd,
    };
    uraeda_serve::run(options).map_err(|error| error.to_string())?;
    Ok(ExitCode::SUCCESS)
}
