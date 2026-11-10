//! The actions `settings.*`: each written to the settings file by the core, which keeps the
//! human's comments and never overwrites a file it cannot read, then read again, so the record
//! and the guard hold the change before the action answers.

use std::path::Path;

use uraeda_core::api::ApiError;
use uraeda_core::settings::{self as core, ContinueKey};
use uraeda_protocol::{
    ContinueKind, SettingsAddHost, SettingsEditHost, SettingsRemoveHost,
    SettingsSetAutomaticContinues, SettingsSetContinue, SettingsSetOpenBrowser, SettingsSetPort,
    SettingsSetRunOptions, SettingsSetSingleKeyShortcuts, SettingsSetVimCommands,
    SettingsSetVimMode,
};

use super::{options, reload};
use crate::live::{Call, Fault, Registry};

/// What the core answers a write with.
type Written = Result<core::Settings, ApiError>;

/// Registers each action on the core's function that writes its setting.
pub(super) fn register(registry: &Registry) {
    registry.action::<SettingsAddHost>(|call, input| {
        write(call, |dir| core::add_allowed_host(dir, &input.name))
    });
    registry.action::<SettingsEditHost>(|call, input| {
        write(call, |dir| {
            core::edit_allowed_host(dir, &input.from, &input.to)
        })
    });
    registry.action::<SettingsRemoveHost>(|call, input| {
        write(call, |dir| core::remove_allowed_host(dir, &input.name))
    });
    registry.action::<SettingsSetAutomaticContinues>(|call, input| {
        write(call, |dir| {
            core::set_automatic_continues(dir, &input.continues)
        })
    });
    registry.action::<SettingsSetContinue>(|call, input| {
        write(call, |dir| {
            core::set_continue(dir, key(input.key), input.on)
        })
    });
    registry.action::<SettingsSetOpenBrowser>(|call, input| {
        write(call, |dir| core::set_open_browser(dir, input.open))
    });
    registry.action::<SettingsSetPort>(|call, input| {
        write(call, |dir| core::set_port(dir, &input.port))
    });
    registry.action::<SettingsSetRunOptions>(|call, input| {
        let options = options::given(input.options);
        write(call, |dir| core::set_run_options(dir, &options))
    });
    registry.action::<SettingsSetSingleKeyShortcuts>(|call, input| {
        write(call, |dir| core::set_single_key_shortcuts(dir, input.on))
    });
    registry.action::<SettingsSetVimCommands>(|call, input| {
        write(call, |dir| core::set_vim_commands(dir, &input.lines))
    });
    registry.action::<SettingsSetVimMode>(|call, input| {
        write(call, |dir| core::set_vim_mode(dir, input.on))
    });
}

/// Writes a setting in the config folder's file, then reads the settings again. What the core
/// refuses, as a port that is not one or a file it cannot read, is the action's refusal.
fn write(call: &Call, write: impl FnOnce(&Path) -> Written) -> Result<(), Fault> {
    write(call.shared().config_dir())?;
    reload(call.shared());
    Ok(())
}

/// The core's switch of a kind of automatic run.
fn key(kind: ContinueKind) -> ContinueKey {
    match kind {
        ContinueKind::CatchUp => ContinueKey::CatchUp,
        ContinueKind::Limit => ContinueKey::Limit,
        ContinueKind::Restart => ContinueKey::Restart,
    }
}
