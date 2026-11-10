//! The settings: each value in force, the settings file's, and where the one in force comes
//! from. And the actions that write the file.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};
use crate::shared::RunOptions;

/// The settings, as the server applies them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// The settings file, with `~` for the home folder.
    pub file: String,
    /// Why the file cannot be read: the defaults apply meanwhile, and no action writes it.
    pub problem: Option<String>,
    /// The `[server]` table.
    pub server: ServerSettings,
    /// The `[runs]` table.
    pub runs: RunSettings,
    /// The `[keyboard]` table.
    pub keyboard: KeyboardSettings,
}

impl Record for Settings {
    const NAME: &'static str = "Settings";
    type Args = ();
    type Value = Self;
}

/// A setting: its value in force, the file's, and where the one in force comes from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Setting<T> {
    /// The value the server applies.
    pub in_force: T,
    /// The file's value: none when the file has none.
    pub saved: Option<T>,
    /// Where the value in force comes from.
    pub source: Source,
}

/// Where a setting's value in force comes from: a flag, then a variable of the server's
/// environment, then the settings file, then the default.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Source {
    /// Nothing gives it.
    Default,
    /// The settings file.
    File,
    /// A flag of `ura serve`, by its name, like `--port`.
    Flag {
        /// The flag.
        name: String,
    },
    /// A variable of the server's environment, by its name.
    Environment {
        /// The variable.
        name: String,
    },
}

/// The server's settings.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ServerSettings {
    /// The host names accepted besides 127.0.0.1 and localhost.
    pub allowed_hosts: Setting<Vec<String>>,
    /// Whether a start opens a browser.
    pub open_browser: Setting<bool>,
    /// The port the server listens on.
    pub port: Setting<u16>,
}

/// How the workflow's runs start and go on.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunSettings {
    /// The automatic continues in a row before a run asks, 1 to 10.
    pub automatic_continues: Setting<u32>,
    /// Whether an open pull request behind the default branch is caught up by itself.
    pub catch_up_pull_requests: Setting<bool>,
    /// Whether a run a usage limit stopped continues at its reset.
    pub continue_after_limit: Setting<bool>,
    /// Whether a run the server's restart cut continues.
    pub continue_after_restart: Setting<bool>,
    /// `CLAUDE_CODE_EFFORT_LEVEL` of the server's environment when set, which every Claude Code
    /// session inherits, over any effort picked.
    pub claude_effort_from_env: Option<String>,
    /// The run options the file holds, only what it sets: no flag or variable gives them.
    pub options: RunOptions,
}

/// How the keys behave.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardSettings {
    /// Whether the keys of one printable character act.
    pub single_key_shortcuts: Setting<bool>,
    /// Whether the text fields edit with Vim's keys.
    pub vim_mode: Setting<bool>,
    /// The lines of Vim's commands run when Vim starts, like `imap jj <Esc>`.
    pub vim_commands: Setting<Vec<String>>,
}

/// An action that writes the settings file: it takes this input, and answers nothing. The
/// record `Settings` shows the change.
macro_rules! writes {
    ($input:ident, $name:literal) => {
        impl Action for $input {
            const NAME: &'static str = $name;
            type Input = Self;
            type Output = ();
        }
    };
}

/// Adds a host name, in lower case, to the allowed host names.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsAddHost {
    /// The host name, like `mac.tail1234.ts.net`.
    pub name: String,
}

writes!(SettingsAddHost, "settings.addHost");

/// Replaces an allowed host name with another, in its place.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsEditHost {
    /// The name to replace.
    pub from: String,
    /// The name that takes its place.
    pub to: String,
}

writes!(SettingsEditHost, "settings.editHost");

/// Removes an allowed host name.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsRemoveHost {
    /// The host name.
    pub name: String,
}

writes!(SettingsRemoveHost, "settings.removeHost");

/// Sets the automatic continues in a row before a run asks.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetAutomaticContinues {
    /// The number as typed, from 1 to 10.
    pub continues: String,
}

writes!(
    SettingsSetAutomaticContinues,
    "settings.setAutomaticContinues"
);

/// Turns a kind of automatic run on or off.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetContinue {
    /// The kind of automatic run.
    pub key: ContinueKind,
    /// Whether it runs.
    pub on: bool,
}

writes!(SettingsSetContinue, "settings.setContinue");

/// A kind of automatic run, each with its switch in the settings.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ContinueKind {
    /// The catch-up of an open pull request behind the default branch.
    CatchUp,
    /// The continue at a usage limit's reset.
    Limit,
    /// The continue after a restart of the server.
    Restart,
}

/// Sets whether a start opens a browser.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetOpenBrowser {
    /// Whether it does.
    pub open: bool,
}

writes!(SettingsSetOpenBrowser, "settings.setOpenBrowser");

/// Sets the port the server listens on, from its next start.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetPort {
    /// The port as typed, from 1 to 65535.
    pub port: String,
}

writes!(SettingsSetPort, "settings.setPort");

/// Writes the run options whole.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetRunOptions {
    /// The run options, only what is set.
    pub options: RunOptions,
}

writes!(SettingsSetRunOptions, "settings.setRunOptions");

/// Sets whether the keys of one printable character act.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetSingleKeyShortcuts {
    /// Whether they act.
    pub on: bool,
}

writes!(
    SettingsSetSingleKeyShortcuts,
    "settings.setSingleKeyShortcuts"
);

/// Sets the lines of Vim's commands run when Vim starts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetVimCommands {
    /// The lines, like `imap jj <Esc>`.
    pub lines: Vec<String>,
}

writes!(SettingsSetVimCommands, "settings.setVimCommands");

/// Sets whether the text fields edit with Vim's keys.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSetVimMode {
    /// Whether they do.
    pub on: bool,
}

writes!(SettingsSetVimMode, "settings.setVimMode");
