//! The extensions' tables of the settings file: `[extensions.<name>]`, with `on`, the repositories
//! the extension is on in, and its settings for every repository, and
//! `[extensions.<name>.repositories.<repo>]`, its settings for one repository. Each value is
//! checked against the setting its manifest declares.

use std::path::Path;

use serde_json::{Map, Value as Json};
use toml_edit::{Document, Item, TableLike, Value};

use super::{Extension, ExtensionProblem, SettingSpec, manifest};

/// The settings file, as `config.toml` in the config folder.
const FILE: &str = "config.toml";

/// The settings file, parsed, or why it could not be.
pub(super) struct Config {
    document: Result<Option<Document<String>>, String>,
}

impl Config {
    /// The settings file in `config_dir`: none when there is no file.
    pub(super) fn load(config_dir: &Path) -> Self {
        let document = crate::settings::load_text(config_dir).and_then(|read| {
            read.map(|(text, _)| {
                Document::parse(text).map_err(|error| error.message().trim().to_owned())
            })
            .transpose()
        });
        Self { document }
    }

    /// The table `[extensions.<name>]`, when the file has one.
    fn table(&self, name: &str) -> Option<&dyn TableLike> {
        let document = self.document.as_ref().ok()?.as_ref()?;
        document
            .get("extensions")?
            .as_table_like()?
            .get(name)?
            .as_table_like()
    }

    /// Whether the table `[extensions.<name>]` gives an `on`.
    pub(super) fn has_on(&self, name: &str) -> bool {
        self.table(name)
            .is_some_and(|table| table.contains_key("on"))
    }

    /// The problem of `[extensions]`, or of its `name` entry, that is not a table, when it is not.
    fn shape(&self, name: &str) -> Option<ExtensionProblem> {
        let document = self.document.as_ref().ok()?.as_ref()?;
        let text = document.raw();
        let root = document.as_table();
        let at = |table: &dyn TableLike, key: &str| {
            let (key, item) = table.get_key_value(key)?;
            let span = key.span().or_else(|| item.span())?;
            Some(manifest::line(text, span.start))
        };
        let extensions = root.get("extensions")?;
        let Some(tables) = extensions.as_table_like() else {
            let message =
                "extensions is a table, with a table for each extension, so it is ignored";
            return Some(problem(at(root, "extensions"), None, message.to_owned()));
        };
        let entry = tables.get(name)?;
        if entry.is_table_like() {
            return None;
        }
        let message = format!("extensions.{name} is a table, so it is ignored");
        Some(problem(at(tables, name), None, message))
    }

    /// Reads the repositories `extension` is on in, and checks its settings, into it. When the
    /// file cannot be read, your extensions are off, as the file might turn them off, and the
    /// built-in ones run on their defaults, so that Uraeda keeps working.
    pub(super) fn apply(&self, extension: &mut Extension) {
        if let Err(reason) = &self.document {
            let message = if extension.is_built_in {
                format!("{FILE} cannot be read, so this extension runs on its defaults: {reason}")
            } else {
                extension.on_all = false;
                extension.on = Vec::new();
                format!(
                    "{FILE} cannot be read, so {} is off: {reason}",
                    extension.name
                )
            };
            extension.problems.push(problem(None, None, message));
            return;
        }
        if let Some(problem) = self.shape(&extension.name) {
            extension.problems.push(problem);
            return;
        }
        let Some(table) = self.table(&extension.name) else {
            return;
        };
        let checker = Checker {
            text: self.text(),
            extension: &extension.name,
            settings: &extension.settings,
        };
        let mut problems = Vec::new();
        let on = checker.on(table, &mut problems);
        if !extension.problems.iter().any(|problem| problem.is_fatal) {
            checker.values(table, None, &mut problems);
            checker.repositories(table, &mut problems);
        }
        if let Some(on) = on {
            extension.on_all = false;
            extension.on = on;
        }
        extension.problems.extend(problems);
    }

    /// The settings of `extension` for `repository`: each default, the values for every
    /// repository over them, and the values for `repository` over those, a wrong value left out.
    pub(super) fn settings(
        &self,
        extension: &Extension,
        repository: Option<&str>,
    ) -> Map<String, Json> {
        let mut values: Map<String, Json> = extension
            .settings
            .iter()
            .filter_map(|spec| {
                Some((
                    spec.key.clone(),
                    serde_json::from_str(&spec.default_json).ok()?,
                ))
            })
            .collect();
        let Some(table) = self.table(&extension.name) else {
            return values;
        };
        let repository_table = repository.and_then(|name| {
            table
                .get("repositories")?
                .as_table_like()?
                .get(name)?
                .as_table_like()
        });
        for table in std::iter::once(table).chain(repository_table) {
            for spec in &extension.settings {
                let value = table.get(&spec.key).and_then(|item| json(&spec.kind, item));
                if let Some(value) = value {
                    values.insert(spec.key.clone(), value);
                }
            }
        }
        values
    }

    /// The values of `extension` set for each repository on its own, by repository, without the
    /// defaults or the values for every repository: a wrong value left out, a repository with
    /// none left out.
    pub(super) fn by_repository(&self, extension: &Extension) -> Map<String, Json> {
        let Some(tables) = self
            .table(&extension.name)
            .and_then(|table| table.get("repositories"))
            .and_then(Item::as_table_like)
        else {
            return Map::new();
        };
        tables
            .iter()
            .filter_map(|(repository, item)| {
                let table = item.as_table_like()?;
                let values: Map<String, Json> = extension
                    .settings
                    .iter()
                    .filter_map(|spec| {
                        let value = json(&spec.kind, table.get(&spec.key)?)?;
                        Some((spec.key.clone(), value))
                    })
                    .collect();
                (!values.is_empty()).then(|| (repository.to_owned(), Json::Object(values)))
            })
            .collect()
    }

    fn text(&self) -> &str {
        match &self.document {
            Ok(Some(document)) => document.raw(),
            _ => "",
        }
    }
}

/// Checks an extension's tables of the settings file.
struct Checker<'a> {
    text: &'a str,
    extension: &'a str,
    settings: &'a [SettingSpec],
}

impl Checker<'_> {
    /// The line of `key` in `table`.
    fn line(&self, table: &dyn TableLike, key: &str) -> Option<u32> {
        let (key, item) = table.get_key_value(key)?;
        let span = key.span().or_else(|| item.span())?;
        Some(manifest::line(self.text, span.start))
    }

    /// The repositories `on` names, none for every repository, when absent or `"all"`; an empty
    /// list, off, when it is neither `"all"` nor a list of names.
    fn on(
        &self,
        table: &dyn TableLike,
        problems: &mut Vec<ExtensionProblem>,
    ) -> Option<Vec<String>> {
        let item = table.get("on")?;
        if item.as_str() == Some("all") {
            return None;
        }
        let names: Option<Vec<String>> = item.as_array().and_then(|array| {
            array
                .iter()
                .map(|name| name.as_str().map(str::to_owned))
                .collect()
        });
        if names.is_some() {
            return names;
        }
        let message = format!(
            "on is \"all\" or a list of repository names, so {} is off",
            self.extension
        );
        problems.push(problem(self.line(table, "on"), Some("on"), message));
        Some(Vec::new())
    }

    /// Checks the settings' values in `table`, for `repository` or for every one.
    fn values(
        &self,
        table: &dyn TableLike,
        repository: Option<&str>,
        problems: &mut Vec<ExtensionProblem>,
    ) {
        let named = |key: &str| match repository {
            Some(repository) => format!("{key}, for {repository},"),
            None => key.to_owned(),
        };
        for (key, item) in table.iter() {
            if repository.is_none() && (key == "on" || key == "repositories") {
                continue;
            }
            let message = match self.settings.iter().find(|spec| spec.key == key) {
                None => format!(
                    "{} is not a setting of {}, so it is ignored",
                    named(key),
                    self.extension
                ),
                Some(spec) if json(&spec.kind, item).is_none() => {
                    format!(
                        "{} is {}, so this value is ignored",
                        named(key),
                        kind_text(&spec.kind)
                    )
                }
                Some(_) => continue,
            };
            problems.push(problem(self.line(table, key), Some(key), message));
        }
    }

    /// Checks the settings' values for each repository.
    fn repositories(&self, table: &dyn TableLike, problems: &mut Vec<ExtensionProblem>) {
        let Some(item) = table.get("repositories") else {
            return;
        };
        let Some(repositories) = item.as_table_like() else {
            let message =
                "repositories is a table of settings for each repository, so it is ignored"
                    .to_owned();
            problems.push(problem(self.line(table, "repositories"), None, message));
            return;
        };
        for (name, item) in repositories.iter() {
            match item.as_table_like() {
                Some(values) => self.values(values, Some(name), problems),
                None => {
                    let message =
                        format!("repositories.{name} is a table of settings, so it is ignored");
                    problems.push(problem(self.line(repositories, name), None, message));
                }
            }
        }
    }
}

/// `item` as JSON, when it is of the setting kind `kind`.
pub(super) fn json(kind: &str, item: &Item) -> Option<Json> {
    let value = item.as_value()?;
    match (kind, value) {
        ("bool", Value::Boolean(on)) => Some(Json::Bool(*on.value())),
        ("integer", Value::Integer(number)) => Some(Json::from(*number.value())),
        ("string", Value::String(text)) => Some(Json::String(text.value().clone())),
        ("list", Value::Array(array)) => array
            .iter()
            .map(|value| value.as_str().map(|text| Json::String(text.to_owned())))
            .collect::<Option<Vec<_>>>()
            .map(Json::Array),
        _ => None,
    }
}

/// `value` as a TOML value, when it is of the setting kind `kind`.
pub(super) fn toml(kind: &str, value: &Json) -> Option<Value> {
    match (kind, value) {
        ("bool", Json::Bool(on)) => Some(Value::from(*on)),
        ("integer", Json::Number(number)) => number.as_i64().map(Value::from),
        ("string", Json::String(text)) => Some(Value::from(text.as_str())),
        ("list", Json::Array(items)) => items
            .iter()
            .map(Json::as_str)
            .collect::<Option<toml_edit::Array>>()
            .map(Value::Array),
        _ => None,
    }
}

/// What a value of the setting kind `kind` is, as messages say it.
pub(super) fn kind_text(kind: &str) -> &'static str {
    match kind {
        "bool" => "true or false",
        "integer" => "a whole number",
        "list" => "a list of strings",
        _ => "a string",
    }
}

fn problem(line: Option<u32>, setting: Option<&str>, message: String) -> ExtensionProblem {
    ExtensionProblem {
        file: FILE.to_owned(),
        line,
        message,
        setting: setting.map(str::to_owned),
        is_fatal: false,
    }
}
