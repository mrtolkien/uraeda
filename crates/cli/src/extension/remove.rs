//! `ura extension remove`: deletes an extension's folder, or only the link to it; its settings
//! stay in the settings file.

use std::process::ExitCode;

use uraeda_core::extensions::install;
use uraeda_core::settings;

use super::{Folders, title};

pub fn run(folders: &Folders, name: &str) -> Result<ExitCode, String> {
    let title = title(folders, name);
    install::remove(&folders.config, name).map_err(|error| error.message)?;
    println!(
        "Removed {title}: its settings stay in {}",
        settings::shown_file(&folders.config)
    );
    Ok(ExitCode::SUCCESS)
}
