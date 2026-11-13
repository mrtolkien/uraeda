//! The port a start listens on, and what gave it.

use uraeda_core::settings;
use uraeda_protocol::Source;

use crate::{DEFAULT_PORT, Environment, Options};

/// The variable giving the port.
const PORT: &str = "URAEDA_PORT";

/// What gave the port the server listens on, which the settings show beside it.
pub(crate) struct PortFrom(pub Source);

/// The port a start asks for, and what gives it: `--port`, else `URAEDA_PORT`, in the
/// environment or the config folder's `.env`, else the settings file's `port`, else
/// [`DEFAULT_PORT`]. A settings file that does not read gives none: its problem shows in the
/// settings, and never keeps the server from starting.
///
/// # Errors
///
/// The variable's name and its problem, when it holds no port.
pub fn asked_port(options: &Options) -> Result<(u16, Source), String> {
    if let Some(port) = options.port {
        let name = "--port".to_owned();
        return Ok((port, Source::Flag { name }));
    }
    let environment = Environment::load(&options.config_dir, options.environment.clone());
    if let Some(typed) = environment.var(PORT) {
        let port = settings::port(typed).map_err(|problem| format!("{PORT}: {problem}"))?;
        let name = PORT.to_owned();
        return Ok((port, Source::Environment { name }));
    }
    let saved = settings::read(&options.config_dir).ok();
    let saved = saved.and_then(|settings| settings.server.port);
    Ok(saved.map_or((DEFAULT_PORT, Source::Default), |port| (port, Source::File)))
}
