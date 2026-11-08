//! Extensions: the folders in `extensions/` in the config folder, each with its manifest,
//! `extension.toml`, and Uraeda's own parts shipped as built-in extensions (see
//! `specs/decisions/extensions.md`). This module reads the manifests, each extension's
//! repositories, and its settings in `config.toml`, and writes those two. It never runs an
//! extension's code. Reading never fails: each problem is reported on its extension's row, and a
//! broken extension leaves the others.

use std::fs;
use std::path::{Path, PathBuf};

use include_dir::{Dir, include_dir};
#[cfg(feature = "napi")]
use napi_derive::napi;

pub mod install;
mod manifest;
pub mod status;
mod values;
mod write;

pub use write::{On, add_on, set_on, set_setting};

/// The extension API this Uraeda runs: an extension built for another is turned off.
pub const EXTENSION_API: u32 = 1;

/// The built-in extensions, in the order the lists show them.
const BUILT_INS: [&str; 8] = [
    "claude",
    "fake",
    "inbox",
    "priorities",
    "decisions",
    "git",
    "previews",
    "notifications",
];

/// Names Uraeda keeps for itself, which no extension takes: its own, and Sessions', which the web
/// registers like a built-in, and whose agent plugins would be named alike.
const RESERVED: [&str; 2] = ["uraeda", "sessions"];

/// Why no extension of yours can be named `name`: a built-in's name, or one Uraeda keeps.
fn taken(name: &str) -> Option<String> {
    if BUILT_INS.contains(&name) {
        Some(format!("{name} is taken by a built-in extension"))
    } else if RESERVED.contains(&name) {
        Some(format!("{name} is reserved by Uraeda"))
    } else {
        None
    }
}

/// The built-in extensions' manifests, `crates/core/extensions/`, as they were when the binary
/// was built.
static BUILT_IN: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/extensions");

/// The manifest's file, in an extension's folder.
const MANIFEST: &str = "extension.toml";
/// Where `ura` installed an extension from, in its folder.
const SOURCE: &str = ".ura-source";
/// A file larger than this is not read: no manifest comes near it.
const LARGEST: u64 = 1024 * 1024;

/// The extensions: the built-in ones, then yours.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Extensions {
    /// Your extensions folder, as messages show it, the home folder written `~`, and a `/` last.
    pub folder: String,
    /// The built-in extensions first, in their order, then yours by folder name.
    pub extensions: Vec<Extension>,
}

/// An extension, as its manifest and the settings file describe it.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Extension {
    /// Its folder's name, which its manifest's `name` must equal.
    pub name: String,
    pub title: String,
    pub description: String,
    pub version: String,
    /// The extension API it is built for: the loader turns off one built for another.
    pub api: u32,
    pub icon: String,
    /// `"global"` or `"repository"`: where `ura extension add` suggests turning it on first.
    pub scope: String,
    /// Its server entry, absolute.
    pub server: Option<String>,
    /// Its page entry, absolute.
    pub page: Option<String>,
    /// Its folder, absolute, a symbolic link resolved; empty for a built-in extension.
    pub folder: String,
    pub is_built_in: bool,
    /// Whether it reloads on save: a folder without `.ura-source`, linked or written in place.
    pub is_linked: bool,
    /// Where `ura` installed it from.
    pub source: Option<Source>,
    /// Whether it is on in every repository.
    pub on_all: bool,
    /// The repositories it is on in, by name, when not `on_all`: empty when it is off.
    pub on: Vec<String>,
    /// Its settings, as its manifest declares them, the valid ones only.
    pub settings: Vec<SettingSpec>,
    pub problems: Vec<ExtensionProblem>,
}

/// Where `ura` installed an extension from, its `.ura-source`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Source {
    /// The git URL it was cloned from.
    pub url: String,
    /// The commit it is pinned to.
    pub commit: String,
    /// The branch or tag `ura extension update` follows, the file's `ref`.
    pub git_ref: String,
}

/// A setting an extension's manifest declares.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SettingSpec {
    pub key: String,
    /// `"bool"`, `"integer"`, `"string"`, or `"list"`, a list of strings.
    pub kind: String,
    /// Its default, as JSON.
    pub default_json: String,
    pub label: String,
    pub help: String,
}

/// A problem of an extension. A fatal one keeps it from loading; any other leaves it running, a
/// setting at fault on its default.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExtensionProblem {
    /// The file it is in, in the extension's folder, like `extension.toml`, or `config.toml` for
    /// the settings file; empty for the folder itself.
    pub file: String,
    /// The line it is on, from 1; absent for the whole file.
    pub line: Option<u32>,
    pub message: String,
    /// The setting it is about.
    pub setting: Option<String>,
    pub is_fatal: bool,
}

impl ExtensionProblem {
    /// The problem as messages show it: its file and line first, as `extension.toml:3: …`.
    pub fn text(&self) -> String {
        match (self.file.as_str(), self.line) {
            ("", _) => self.message.clone(),
            (file, Some(line)) => format!("{file}:{line}: {}", self.message),
            (file, None) => format!("{file}: {}", self.message),
        }
    }
}

/// Your extensions folder, in the config folder `config_dir`.
pub fn extensions_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("extensions")
}

/// The built-in extensions and the ones in `config_dir`'s extensions folder, with the
/// repositories each is on in. Never fails: a problem is reported on its extension's row.
pub fn read(config_dir: &Path) -> Extensions {
    let folder = extensions_dir(config_dir);
    let home = std::env::home_dir().unwrap_or_default();
    let shown = format!("{}/", crate::settings::shown(&folder, &home));
    let config = values::Config::load(config_dir);
    let mut extensions: Vec<Extension> = BUILT_INS.iter().map(|name| built_in(name)).collect();
    extensions.extend(yours(&folder));
    for extension in &mut extensions {
        config.apply(extension);
    }
    Extensions {
        folder: shown,
        extensions,
    }
}

/// The settings of the extension `name` as a JSON object: each default, the values for every
/// repository over them, and the values for `repository` over those. A value that fails its
/// setting's type is left out, and `read` reports it. `{}` for an extension that does not exist.
pub fn settings_json(config_dir: &Path, name: &str, repository: Option<&str>) -> String {
    let Some(extension) = find(config_dir, name) else {
        return "{}".to_owned();
    };
    let values = values::Config::load(config_dir).settings(&extension, repository);
    serde_json::Value::Object(values).to_string()
}

/// The values of the extension `name` set for one repository, over those for every repository, as
/// a JSON object by repository: `{"uraeda": {"folder": "wiki"}}`. A wrong value, and a repository
/// with none, are left out; `{}` for an extension that does not exist.
pub fn repository_settings_json(config_dir: &Path, name: &str) -> String {
    let Some(extension) = find(config_dir, name) else {
        return "{}".to_owned();
    };
    let values = values::Config::load(config_dir).by_repository(&extension);
    serde_json::Value::Object(values).to_string()
}

/// Whether `extension` is on in `repository`; with no repository, whether it is on in every one.
pub fn is_on(extension: &Extension, repository: Option<&str>) -> bool {
    extension.on_all || repository.is_some_and(|name| extension.on.iter().any(|on| on == name))
}

/// The extension `name`, its manifest read, without its repositories and settings: a built-in
/// one first, as `read` lists the built-in one first.
fn find(config_dir: &Path, name: &str) -> Option<Extension> {
    if BUILT_INS.contains(&name) {
        return Some(built_in(name));
    }
    if !manifest::kebab(name) {
        return None;
    }
    one(&extensions_dir(config_dir), name)
}

/// The built-in extension `name`, from its embedded manifest.
fn built_in(name: &str) -> Extension {
    let text = BUILT_IN
        .get_file(format!("{name}.toml"))
        .and_then(|file| file.contents_utf8())
        .unwrap_or_default();
    let mut extension = manifest::parse(name, text, None);
    extension.is_built_in = true;
    extension
}

/// Your extensions in `folder`, by folder name, hidden ones skipped; none when it cannot be read.
fn yours(folder: &Path) -> Vec<Extension> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect();
    names.sort();
    names.iter().filter_map(|name| one(folder, name)).collect()
}

/// The extension in the folder `name` of `parent`: none when it is not a folder, a symbolic link
/// to nothing a fatal problem.
fn one(parent: &Path, name: &str) -> Option<Extension> {
    let path = parent.join(name);
    match fs::metadata(&path) {
        Ok(metadata) if metadata.is_dir() => {}
        Ok(_) => return None,
        Err(_) if path.is_symlink() => return Some(fatal(name, "folder not found".to_owned())),
        Err(_) => return None,
    }
    if let Some(why) = taken(name) {
        return Some(fatal(name, why));
    }
    let folder = fs::canonicalize(&path).unwrap_or(path);
    let mut extension = match load(&folder.join(MANIFEST)) {
        Ok(text) => manifest::parse(name, &text, Some(&folder)),
        Err(message) => {
            let mut extension = blank(name);
            extension
                .problems
                .push(problem(MANIFEST, None, message, true));
            extension
        }
    };
    extension.folder = folder.to_string_lossy().into_owned();
    manifest::source(&folder, &mut extension);
    Some(extension)
}

/// The text of the file at `path`, without a byte order mark, or why it cannot be read.
fn load(path: &Path) -> Result<String, String> {
    let file = path
        .file_name()
        .map_or_else(String::new, |name| name.to_string_lossy().into_owned());
    let metadata = fs::metadata(path).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => format!("{file} not found"),
        kind => format!("{file} cannot be read: {kind}"),
    })?;
    if metadata.len() > LARGEST {
        return Err(format!("{file} is over 1 MB"));
    }
    let bytes =
        fs::read(path).map_err(|error| format!("{file} cannot be read: {}", error.kind()))?;
    let text = String::from_utf8(bytes).map_err(|_| format!("{file} is not UTF-8 text"))?;
    Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_owned())
}

/// An extension named `name` with nothing read yet: on in every repository, as when the settings
/// file says nothing of it.
fn blank(name: &str) -> Extension {
    Extension {
        name: name.to_owned(),
        title: name.to_owned(),
        description: String::new(),
        version: String::new(),
        api: EXTENSION_API,
        icon: String::new(),
        scope: "global".to_owned(),
        server: None,
        page: None,
        folder: String::new(),
        is_built_in: false,
        is_linked: false,
        source: None,
        on_all: true,
        on: Vec::new(),
        settings: Vec::new(),
        problems: Vec::new(),
    }
}

/// An extension that cannot load, for a problem of its folder itself.
fn fatal(name: &str, message: String) -> Extension {
    let mut extension = blank(name);
    extension.problems.push(problem("", None, message, true));
    extension
}

fn problem(file: &str, line: Option<u32>, message: String, is_fatal: bool) -> ExtensionProblem {
    ExtensionProblem {
        file: file.to_owned(),
        line,
        message,
        setting: None,
        is_fatal,
    }
}
