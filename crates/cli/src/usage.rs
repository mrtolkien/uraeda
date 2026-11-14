//! `ura usage`: the usage windows of the Claude Code accounts the settings list, and of Codex, as
//! JSON. See `uraeda_serve::usage`.

use std::process::ExitCode;

use uraeda_core::settings::default_config_dir;

use crate::output;

pub fn run() -> Result<ExitCode, String> {
    let folders = uraeda_serve::usage::accounts(&default_config_dir())?;
    output::print_json(&uraeda_serve::usage::read(&folders));
    Ok(ExitCode::SUCCESS)
}
