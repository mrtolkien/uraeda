//! The list of repositories, the folders the add form suggests, and the list's actions.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};

/// The listed repositories, the most recently opened first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Repositories {
    /// The list, as last read.
    pub rows: Vec<RepositoryRow>,
    /// Why `repositories.json` could not be read at its last change: the rows are the last read.
    pub problem: Option<String>,
}

/// A listed repository, as the menu shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryRow {
    /// Its name, which names the row in a change.
    pub id: String,
    /// Its name in the list: the `repo` of its records, and the `<name>` of its `/r/<name>/`
    /// addresses.
    pub name: String,
    /// Its main checkout, absolute.
    pub path: String,
    /// `path` with the home folder written `~`.
    pub home: String,
    /// Its folder no longer holds a git repository.
    pub missing: bool,
}

impl Record for Repositories {
    const NAME: &'static str = "Repositories";
    type Args = ();
    type Value = Self;
}

/// The text typed in the add form.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FolderSuggestionsArgs {
    /// A path that starts with `/` or `~`.
    pub text: String,
}

/// The folders the add form suggests for a typed text: at most 20, by name. It is read once, and
/// never changes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FolderSuggestions {
    /// The folders whose path starts with the text.
    pub rows: Vec<FolderSuggestion>,
}

/// A folder the add form suggests.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FolderSuggestion {
    /// The folder, as typed, ending with `/`.
    pub path: String,
    /// Whether it holds `.git`.
    pub git: bool,
}

impl Record for FolderSuggestions {
    const NAME: &'static str = "FolderSuggestions";
    type Args = FolderSuggestionsArgs;
    type Value = Self;
}

/// Adds the git repository holding a folder to the list. One listed already is opened.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoriesAdd {
    /// The folder, as typed: it starts with `/` or `~`.
    pub folder: String,
}

/// What `repositories.add` answers.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoriesAdded {
    /// The name of the repository added, or found listed.
    pub name: String,
}

impl Action for RepositoriesAdd {
    const NAME: &'static str = "repositories.add";
    type Input = Self;
    type Output = RepositoriesAdded;
}

/// Records that a repository was opened now: it moves first in the list.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoriesOpen {
    /// The repository's name.
    pub name: String,
}

impl Action for RepositoriesOpen {
    const NAME: &'static str = "repositories.open";
    type Input = Self;
    type Output = ();
}

/// Takes a repository off the list. Its folder and its sessions stay as they are.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositoriesRemove {
    /// The repository's name.
    pub name: String,
}

impl Action for RepositoriesRemove {
    const NAME: &'static str = "repositories.remove";
    type Input = Self;
    type Output = ();
}
