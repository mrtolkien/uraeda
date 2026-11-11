//! Colour themes: the TOML files the UI draws its colours from, one per theme (see
//! `specs/decisions/colour-themes.md`). The shipped themes are embedded in the binary; the user's
//! are in `themes/` in the config folder. Reading them never fails: each problem is reported on its
//! file's row, with its line, and a broken theme leaves the lists without stopping any other.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use include_dir::{Dir, include_dir};
#[cfg(feature = "napi")]
use napi_derive::napi;

pub mod contrast;
mod parse;
mod resolve;

use parse::Parsed;

/// The roles a theme maps its palette onto, in the data model's order, each named for where it
/// draws or what it means.
pub const ROLES: &[&str] = &[
    "page",
    "raised",
    "sunken",
    "chip",
    "cursor-row",
    "marked",
    "rule",
    "pane-title",
    "ink",
    "ink-quiet",
    "ink-faint",
    "action",
    "on-action",
    "needs-you",
    "changed",
    "added",
    "removed",
    "caution",
    "context",
    "yours",
    "link",
    "working",
    "live",
    "example",
    "sub-agent",
    "heading-1",
    "heading-2",
    "heading-3",
    "code-inline",
    "quote",
    "mode-normal",
    "mode-insert",
    "mode-visual",
    "mode-replace",
    "mode-command",
    "code-ground",
    "syntax-keyword",
    "syntax-string",
    "syntax-comment",
    "syntax-number",
    "syntax-constant",
    "syntax-function",
    "syntax-type",
    "syntax-operator",
    "syntax-property",
    "syntax-punctuation",
    "syntax-tag",
    "syntax-attribute",
    "syntax-variable",
    // The design language's: what is under the panes, the heights, glass, and light.
    "backdrop",
    "backdrop-wash-1",
    "backdrop-wash-2",
    "well",
    "rule-quiet",
    "lip",
    "shade",
    "glass-tint",
    "glass-rim",
    "light-focus",
    "light-focus-2",
    "light-running",
];

/// The dark mode's default theme, which a dark theme without `extends` extends.
pub const DEFAULT_DARK: &str = "catppuccin-mocha";
/// The light mode's default theme, which a light theme without `extends` extends.
pub const DEFAULT_LIGHT: &str = "catppuccin-latte";

/// The shipped themes, `crates/core/themes/`, as they were when the binary was built.
static SHIPPED: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/themes");

/// A file larger than this is not read: no theme comes near it.
const LARGEST: u64 = 1024 * 1024;

/// A theme in the lists, every role resolved to a colour.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Theme {
    /// The file's name without `.toml`.
    pub id: String,
    pub name: String,
    /// `"dark"` or `"light"`.
    pub mode: String,
    pub is_shipped: bool,
    /// Every role, `#rrggbb` or `#rrggbbaa`, in lower case.
    pub roles: BTreeMap<String, String>,
    /// The palette, merged over the palettes of the themes it extends.
    pub palette: BTreeMap<String, String>,
    /// For each role that names a palette entry, the entry's name.
    pub sources: BTreeMap<String, String>,
}

/// A problem of a theme file: an error, or a warning, which never leaves the lists.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ThemeProblem {
    /// The line it is on, from 1, to sort and to point at; absent for the whole file.
    pub line: Option<u32>,
    /// The full text as shown, some already beginning `Line 4: `: a UI must never prefix the line
    /// itself.
    pub message: String,
    pub is_warning: bool,
    /// A warning naming a colour under the contrast floor, which the settings count apart from the
    /// file's other problems.
    pub is_under_floor: bool,
    /// The role it is about: an error's keeps the colour of the theme the file extends, and a
    /// colour under the floor applies as written; absent for a problem of no one role.
    pub role: Option<String>,
}

/// A theme file of the user's, listed or not, and its problems.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ThemeFile {
    /// The file's name, `ember.toml`.
    pub file: String,
    pub id: String,
    /// Its `name`, else its id.
    pub name: String,
    /// Its mode, `"dark"` or `"light"`, written or taken from the theme it extends, when known.
    pub mode: Option<String>,
    pub extends: Option<String>,
    /// Whether it is in the lists: false after a problem that leaves them.
    pub is_listed: bool,
    pub problems: Vec<ThemeProblem>,
}

/// The themes the lists show, and the user's files.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Themes {
    /// The user's themes folder, as messages show it, the home folder written `~`, and a `/` last.
    pub folder: String,
    /// The shipped themes and the user's listed ones: dark first, then light, each mode's default
    /// first, then the shipped ones by name, then the user's by name.
    pub themes: Vec<Theme>,
    /// Every theme file of the user's, by file name.
    pub files: Vec<ThemeFile>,
}

/// The user's themes folder, in the config folder `config_dir`.
pub fn themes_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("themes")
}

/// The shipped themes and the themes in `config_dir`'s themes folder. Never fails: a file that
/// cannot be read, or has a problem, is reported in `files`.
pub fn read(config_dir: &Path) -> Themes {
    let folder = themes_dir(config_dir);
    let home = std::env::home_dir().unwrap_or_default();
    let shown = format!("{}/", crate::settings::shown(&folder, &home));
    let mut sources = shipped();
    sources.extend(user_files(&folder));
    let (mut themes, rows) = resolve::resolve(sources);
    let files = rows
        .into_iter()
        .filter(|row| !row.0)
        .map(|row| row.1)
        .collect();
    themes.sort_by_cached_key(|theme| {
        let default = theme.id == DEFAULT_DARK || theme.id == DEFAULT_LIGHT;
        (
            theme.mode != "dark",
            !default,
            !theme.is_shipped,
            theme.name.to_lowercase(),
            theme.id.clone(),
        )
    });
    Themes {
        folder: shown,
        themes,
        files,
    }
}

/// The shipped files' rows, as a user's file would have them: a shipped file must have no problem,
/// which a test checks.
pub fn shipped_files() -> Vec<ThemeFile> {
    let (_, rows) = resolve::resolve(shipped());
    rows.into_iter().map(|row| row.1).collect()
}

/// A theme file, read: its file name, its id, and its text parsed, or why it could not be read.
pub(crate) struct Source {
    is_shipped: bool,
    file: String,
    id: String,
    parsed: Parsed,
}

/// The shipped files, parsed.
fn shipped() -> Vec<Source> {
    let mut sources: Vec<Source> = SHIPPED
        .files()
        .filter_map(|file| {
            let name = file.path().file_name()?.to_str()?;
            let id = name.strip_suffix(".toml")?;
            let text = file.contents_utf8()?;
            Some(Source {
                is_shipped: true,
                file: name.to_owned(),
                id: id.to_owned(),
                parsed: parse::parse(text),
            })
        })
        .collect();
    sources.sort_by(|a, b| a.file.cmp(&b.file));
    sources
}

/// The theme files in `folder`, by file name: regular files, symlinks followed, whose name ends in
/// `.toml`, hidden ones skipped, and a symlink to nothing as a file that cannot be read. None when
/// the folder cannot be read.
fn user_files(folder: &Path) -> Vec<Source> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut sources: Vec<Source> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let id = name.strip_suffix(".toml")?;
            if name.starts_with('.') || id.is_empty() {
                return None;
            }
            // A symlink to nothing is a theme file that cannot be read, not a file that vanished.
            let parsed = match fs::metadata(entry.path()) {
                Ok(metadata) if metadata.is_file() => load(&entry.path(), metadata.len()),
                Ok(_) => return None,
                Err(error) => Parsed::unreadable(format!("{}.", error.kind()), None),
            };
            Some(Source {
                is_shipped: false,
                id: id.to_owned(),
                parsed,
                file: name.clone(),
            })
        })
        .collect();
    sources.sort_by(|a, b| a.file.cmp(&b.file));
    sources
}

/// The file at `path`, of `size` bytes, parsed; or the one problem that it could not be read.
fn load(path: &Path, size: u64) -> Parsed {
    if size > LARGEST {
        return Parsed::unreadable("the file is over 1 MB.".to_owned(), None);
    }
    match fs::read(path) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(text) => parse::parse(text.strip_prefix('\u{feff}').unwrap_or(&text)),
            Err(_) => Parsed::unreadable("it is not UTF-8 text.".to_owned(), None),
        },
        Err(error) => Parsed::unreadable(format!("{}.", error.kind()), None),
    }
}
