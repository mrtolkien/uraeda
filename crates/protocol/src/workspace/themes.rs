//! The colour themes: the shipped ones and the user's, with every file's problems.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::Record;

/// The themes the lists show, and the user's theme files.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Themes {
    /// The user's themes folder, as messages show it, the home folder written `~`, and a `/`
    /// last.
    pub folder: String,
    /// The shipped themes and the user's listed ones: dark first, then light, each mode's default
    /// first, then the shipped ones by name, then the user's by name.
    pub themes: Vec<Theme>,
    /// Every theme file of the user's, by file name.
    pub files: Vec<ThemeFile>,
}

/// A theme in the lists, every role resolved to a colour.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    /// The file's name without `.toml`.
    pub id: String,
    /// Its name, as the lists show it.
    pub name: String,
    /// `dark` or `light`.
    pub mode: String,
    /// Whether it ships with Uraeda.
    pub is_shipped: bool,
    /// Every role, `#rrggbb` or `#rrggbbaa`, in lower case.
    pub roles: BTreeMap<String, String>,
    /// The palette, merged over the palettes of the themes it extends.
    pub palette: BTreeMap<String, String>,
    /// For each role that names a palette entry, the entry's name.
    pub sources: BTreeMap<String, String>,
}

/// A theme file of the user's, listed or not, and its problems.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ThemeFile {
    /// The file's name, `ember.toml`.
    pub file: String,
    /// The theme's id: the file's name without `.toml`.
    pub id: String,
    /// Its `name`, else its id.
    pub name: String,
    /// Its mode, `dark` or `light`, written or taken from the theme it extends, when known.
    pub mode: Option<String>,
    /// The theme it extends.
    pub extends: Option<String>,
    /// Whether it is in the lists: false after a problem that leaves them.
    pub is_listed: bool,
    /// Its problems, errors and warnings.
    pub problems: Vec<ThemeProblem>,
}

/// A problem of a theme file: an error, or a warning, which never leaves the lists.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ThemeProblem {
    /// The line it is on, from 1, to sort and to point at: none for the whole file.
    pub line: Option<u32>,
    /// The full text as shown, some already beginning `Line 4: `: a client never adds the line
    /// itself.
    pub message: String,
    /// Whether it is a warning.
    pub is_warning: bool,
    /// A warning naming a colour under the contrast floor, which the settings count apart from
    /// the file's other problems.
    pub is_under_floor: bool,
    /// The role it is about: none for a problem of no one role.
    pub role: Option<String>,
}

impl Record for Themes {
    const NAME: &'static str = "Themes";
    type Args = ();
    type Value = Self;
}
