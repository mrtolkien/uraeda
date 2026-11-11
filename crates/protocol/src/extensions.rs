//! Extensions: the record of every extension and its settings, the records and the actions an
//! extension's server part registers, and the actions of the settings page.
//!
//! An extension names its records and its actions as it loads, so they are not entries of the
//! catalog: every one of them is the record `ExtensionRecord`, or a call of `extensions.act`,
//! named by its extension and its own name.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::registry::{Action, Record};

/// Which reading of the extensions: a repository's, or the settings page's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsArgs {
    /// The repository's name in the list, whose settings each row's `valuesHere` holds: null for
    /// the settings page, which reads every repository's.
    pub repo: Option<String>,
}

/// Every extension: the built-in ones first, then the owner's, by name.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Extensions {
    /// The extension API this server runs.
    pub api: u32,
    /// The owner's extensions folder, the home folder written `~`, with a `/` last.
    pub folder: String,
    pub extensions: Vec<ExtensionRow>,
}

impl Record for Extensions {
    const NAME: &'static str = "Extensions";
    type Args = ExtensionsArgs;
    type Value = Self;
}

/// Where an extension is: running, off, turned off by a problem, or waiting to reload.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ExtensionState {
    On,
    /// Off in every repository, or built for another extension API.
    Off,
    /// Its `problems` say why: it runs again once its files or its settings change.
    Broken,
    /// Its reload waits for the turn of the session `waitingFor` names.
    Waiting,
}

/// An extension, as the settings page and its own page read it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRow {
    /// Its name, which names the row in a change.
    pub id: String,
    /// Its folder's name.
    pub name: String,
    pub title: String,
    pub description: String,
    /// Its own version, as its manifest says.
    pub version: String,
    /// The extension API it is built for.
    pub api: u32,
    /// A name of the app's icon set, or empty.
    pub icon: String,
    pub is_built_in: bool,
    /// Whether it reloads on save: a folder linked or written in place.
    pub is_linked: bool,
    /// Where `ura` installed it from.
    pub source: Option<ExtensionSource>,
    /// Whether it is on in every repository.
    pub on_all: bool,
    /// The repositories it is on in, by name, when not `onAll`: none when it is off.
    pub on: Vec<String>,
    pub state: ExtensionState,
    /// The session whose turn a reload waits for, by its title.
    pub waiting_for: Option<String>,
    /// The version of its running page, which a client loads again as it changes: null without
    /// a page.
    pub page_version: Option<u64>,
    /// Its problems: its manifest's and its settings', then its code's, then its page's.
    pub problems: Vec<ExtensionProblem>,
    /// The settings its manifest declares.
    pub settings: Vec<ExtensionSetting>,
    /// Its settings for every repository, as an object, defaults filled in.
    pub values: Value,
    /// Its settings in the repository asked for, `{}` where it is off; `values` for the settings
    /// page. What its own page reads.
    pub values_here: Value,
    /// The values set for one repository only, by repository, for the settings page; `{}` when a
    /// repository was asked for.
    pub repository_values: Value,
}

/// Where `ura` installed an extension from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSource {
    pub url: String,
    pub commit: String,
    /// The branch or tag `ura extension update` follows.
    pub git_ref: String,
}

/// A problem of an extension: the file it is in, from its folder, and its line when known.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionProblem {
    /// `extension.toml`, `config.toml`, a file of its code, or empty for the folder itself.
    pub file: String,
    /// From 1: null for the whole file.
    pub line: Option<u32>,
    pub message: String,
}

/// A setting an extension's manifest declares.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSetting {
    pub key: String,
    /// `bool`, `integer`, `string`, or `list`, a list of strings.
    pub kind: String,
    pub default: Value,
    pub label: String,
    pub help: String,
}

/// Which record of an extension: in a repository, by the extension's name and the record's.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRecordArgs {
    /// The repository's name in the list.
    pub repo: String,
    pub extension: String,
    /// The record's name, as the extension registered it.
    pub name: String,
}

/// A record an extension registered: its value, or why it could not be read. It is read again
/// when the extension says it changed, and when the extension loads again.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRecord {
    /// What the extension's read gave: null with an `error`.
    pub value: Value,
    /// Why there is no value: the extension is off here, has no such record, threw, or did not
    /// answer in 10 seconds.
    pub error: Option<String>,
}

impl Record for ExtensionRecord {
    const NAME: &'static str = "ExtensionRecord";
    type Args = ExtensionRecordArgs;
    type Value = Self;
}

/// Runs an action an extension registered, in a repository it is on in.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsAct {
    /// The repository's name in the list.
    pub repo: String,
    pub extension: String,
    /// The action's name, as the extension registered it.
    pub name: String,
    pub input: Value,
}

/// What an extension's action answered.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionAction {
    pub output: Value,
}

impl Action for ExtensionsAct {
    const NAME: &'static str = "extensions.act";
    type Input = Self;
    type Output = ExtensionAction;
}

/// Writes where an extension is on, a built-in one's too: every repository, or the ones named.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsSetOn {
    pub name: String,
    /// On in every repository: `on` is then left unread.
    pub on_all: bool,
    /// The repositories it is on in, by name: none turns it off.
    pub on: Vec<String>,
}

impl Action for ExtensionsSetOn {
    const NAME: &'static str = "extensions.setOn";
    type Input = Self;
    type Output = ();
}

/// Writes a setting of an extension, for one repository or for every one.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsSetSetting {
    pub name: String,
    /// The repository's name, or null for every repository.
    pub repository: Option<String>,
    pub key: String,
    /// Null removes the value: the one for every repository, or the default, applies again.
    pub value: Value,
}

impl Action for ExtensionsSetSetting {
    const NAME: &'static str = "extensions.setSetting";
    type Input = Self;
    type Output = ();
}

/// A problem an extension's page met in a client, kept with the extension's own until its
/// page's next version.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionsReportPageProblem {
    pub name: String,
    /// The page's version the client runs: a report for another than the current one is dropped.
    pub version: u64,
    pub message: String,
}

impl Action for ExtensionsReportPageProblem {
    const NAME: &'static str = "extensions.reportPageProblem";
    type Input = Self;
    type Output = ();
}
