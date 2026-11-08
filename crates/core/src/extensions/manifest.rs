//! An extension's manifest, `extension.toml`, and its `.ura-source`: read, each problem with its
//! line.

use std::path::{Component, Path};

use toml_edit::{Document, Item, Key, TableLike};

use super::{Extension, MANIFEST, SOURCE, SettingSpec, Source, blank, load, problem, values};

/// The kinds of setting a manifest declares.
const KINDS: [&str; 4] = ["bool", "integer", "string", "list"];

/// The manifest `text` of the extension `name`, whose folder is `folder`, `None` for a built-in
/// one, whose code is Uraeda's and has no entry paths.
pub(super) fn parse(name: &str, text: &str, folder: Option<&Path>) -> Extension {
    let mut extension = blank(name);
    let document = match Document::parse(text) {
        Ok(document) => document,
        Err(error) => {
            let line = error.span().map(|span| line(text, span.start));
            let message = error
                .message()
                .lines()
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(", ");
            extension
                .problems
                .push(problem(MANIFEST, line, message, true));
            return extension;
        }
    };
    let mut reader = Reader {
        text,
        extension: &mut extension,
    };
    let root = document.as_table();
    reader.name(root, name);
    reader.fields(root);
    if let Some(folder) = folder {
        reader.extension.server = reader.entry(root, "server", folder);
        reader.extension.page = reader.entry(root, "page", folder);
    }
    if let Some((key, item)) = root.get_key_value("settings") {
        reader.settings(key, item);
    }
    extension
}

/// Reads the folder's `.ura-source` into `extension`, when there is one: an extension without it
/// reloads on save.
pub(super) fn source(folder: &Path, extension: &mut Extension) {
    let path = folder.join(SOURCE);
    if !path.exists() {
        extension.is_linked = true;
        return;
    }
    let text = match load(&path) {
        Ok(text) => text,
        Err(message) => {
            let problem = problem(SOURCE, None, message, false);
            extension.problems.push(problem);
            return;
        }
    };
    let Ok(document) = Document::parse(text.as_str()) else {
        let message = format!("{SOURCE} is not TOML");
        extension
            .problems
            .push(problem(SOURCE, None, message, false));
        return;
    };
    let field = |key: &str| document.get(key).and_then(Item::as_str).map(str::to_owned);
    match (field("url"), field("commit"), field("ref")) {
        (Some(url), Some(commit), Some(git_ref)) => {
            extension.source = Some(Source {
                url,
                commit,
                git_ref,
            });
        }
        _ => {
            let message = format!("{SOURCE} needs a url, a commit, and a ref");
            extension
                .problems
                .push(problem(SOURCE, None, message, false));
        }
    }
}

/// Reads a manifest's values into its extension, each problem with its line.
struct Reader<'a> {
    text: &'a str,
    extension: &'a mut Extension,
}

impl Reader<'_> {
    /// Adds a problem of the manifest on the line of `key`.
    fn problem(&mut self, key: Option<&Key>, message: String, is_fatal: bool) {
        let line = key
            .and_then(Key::span)
            .map(|span| line(self.text, span.start));
        let problem = problem(MANIFEST, line, message, is_fatal);
        self.extension.problems.push(problem);
    }

    /// Checks `name`: kebab-case, and the folder's name.
    fn name(&mut self, root: &dyn TableLike, folder: &str) {
        let Some((key, item)) = root.get_key_value("name") else {
            self.problem(None, "name is missing".to_owned(), true);
            return;
        };
        let message = match item.as_str() {
            Some(name) if kebab(name) && name == folder => return,
            Some(name) if kebab(name) => {
                format!("the name \"{name}\" differs from the folder's name, \"{folder}\"")
            }
            _ => "name is kebab-case, like \"my-extension\"".to_owned(),
        };
        self.problem(Some(key), message, true);
    }

    /// Reads the fields shown on the settings page, `api`, and `scope`.
    fn fields(&mut self, root: &dyn TableLike) {
        let title = self.string(root, "title");
        self.extension.title = title.unwrap_or_else(|| self.extension.name.clone());
        self.extension.description = self.string(root, "description").unwrap_or_default();
        self.extension.version = self.string(root, "version").unwrap_or_default();
        self.extension.icon = self.string(root, "icon").unwrap_or_default();
        let api = root.get_key_value("api");
        let number = api.and_then(|(_, item)| item.as_integer());
        match number.and_then(|number| u32::try_from(number).ok()) {
            Some(number) => self.extension.api = number,
            None => {
                let message = "api is a whole number, like 1".to_owned();
                self.problem(api.map(|(key, _)| key), message, true);
            }
        }
        if let Some((key, item)) = root.get_key_value("scope") {
            match item.as_str() {
                Some(scope @ ("global" | "repository")) => self.extension.scope = scope.to_owned(),
                _ => {
                    let message = "scope is \"global\" or \"repository\"".to_owned();
                    self.problem(Some(key), message, true);
                }
            }
        }
    }

    /// The text field `name`, none when absent; a value of another type is a problem that leaves
    /// it unset.
    fn string(&mut self, root: &dyn TableLike, name: &str) -> Option<String> {
        let (key, item) = root.get_key_value(name)?;
        let text = item.as_str().map(str::to_owned);
        if text.is_none() {
            self.problem(Some(key), format!("{name} is a string"), false);
        }
        text
    }

    /// The entry `name`, `server` or `page`, absolute: a path to a file inside `folder`.
    fn entry(&mut self, root: &dyn TableLike, name: &str, folder: &Path) -> Option<String> {
        let (key, item) = root.get_key_value(name)?;
        let written = item.as_str().unwrap_or_default();
        let inside = Path::new(written)
            .components()
            .all(|part| matches!(part, Component::Normal(_) | Component::CurDir));
        let path = folder.join(written);
        if !written.is_empty() && inside && path.is_file() {
            return Some(path.to_string_lossy().into_owned());
        }
        let message = format!("{name} names {written}, which is not a file in the folder");
        self.problem(Some(key), message, true);
        None
    }

    /// Reads the `[settings.*]` tables, each valid one into the extension's settings.
    fn settings(&mut self, key: &Key, item: &Item) {
        let Some(table) = item.as_table_like() else {
            let message = "settings is a table of settings, like [settings.folder]".to_owned();
            self.problem(Some(key), message, true);
            return;
        };
        for (name, _) in table.iter() {
            let Some((key, item)) = table.get_key_value(name) else {
                continue;
            };
            if let Some(spec) = self.setting(key, item) {
                self.extension.settings.push(spec);
            }
        }
    }

    /// The setting `key`, declared by `item`; none after a problem, which names it.
    fn setting(&mut self, key: &Key, item: &Item) -> Option<SettingSpec> {
        let name = key.get();
        let before = self.extension.problems.len();
        let spec = self.declared(key, item);
        for problem in &mut self.extension.problems[before..] {
            problem.setting = Some(name.to_owned());
        }
        spec
    }

    fn declared(&mut self, key: &Key, item: &Item) -> Option<SettingSpec> {
        let name = key.get();
        let at = |field: &str| format!("settings.{name}: {field}");
        if name == "on" || name == "repositories" {
            self.problem(
                Some(key),
                at("on and repositories are not setting names"),
                true,
            );
            return None;
        }
        let Some(table) = item.as_table_like() else {
            self.problem(
                Some(key),
                at("a setting is a table, with a type and a default"),
                true,
            );
            return None;
        };
        let kind = table.get_key_value("type");
        let Some(kind) = kind
            .and_then(|(_, item)| item.as_str())
            .filter(|kind| KINDS.contains(kind))
        else {
            let where_ = kind.map_or(key, |(key, _)| key);
            self.problem(
                Some(where_),
                at("the type is bool, integer, string, or list"),
                true,
            );
            return None;
        };
        let Some((default_key, default)) = table.get_key_value("default") else {
            self.problem(Some(key), at("a default is needed"), true);
            return None;
        };
        let Some(json) = values::json(kind, default) else {
            let message = at(&format!("the default is not {}", values::kind_text(kind)));
            self.problem(Some(default_key), message, true);
            return None;
        };
        let text = |field: &str| {
            let value = table.get(field).and_then(Item::as_str);
            value.unwrap_or_default().to_owned()
        };
        Some(SettingSpec {
            key: name.to_owned(),
            kind: kind.to_owned(),
            default_json: json.to_string(),
            label: text("label"),
            help: text("help"),
        })
    }
}

/// Whether `name` is kebab-case: lower-case words of letters and digits, the first starting with
/// a letter, joined by single hyphens.
pub(super) fn kebab(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_lowercase())
        && name.split('-').all(|word| {
            !word.is_empty()
                && word
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}

/// The line, from 1, holding `offset` in `text`.
pub(super) fn line(text: &str, offset: usize) -> u32 {
    u32::try_from(crate::settings::line(text, offset)).unwrap_or(u32::MAX)
}
