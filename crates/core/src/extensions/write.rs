//! Writes to the extensions' tables of the settings file: the repositories an extension is on in,
//! and its settings. Each write goes through the settings' own, which keeps the file's comments,
//! unknown keys, and order, and refuses to overwrite a file that cannot be read.

use std::path::Path;

use toml_edit::Value;

use super::manifest::kebab;
use super::{Extension, find, values};
use crate::api::ApiError;
use crate::settings::{change_path, refused, set};

/// The repositories an extension is on in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum On {
    /// Every repository, `on = "all"`.
    All,
    /// These repositories, by name, `on = [..]`: none turns it off.
    Some(Vec<String>),
}

/// Writes the repositories the extension `name` is on in, refusing a repository not in the list
/// in the data folder `data_dir`, unless it already is in `on`: a repository that has left the
/// list stays where it is until it is taken out.
pub fn set_on(config_dir: &Path, data_dir: &Path, name: &str, on: On) -> Result<(), ApiError> {
    let mut extension = known(config_dir, name)?;
    let value = match on {
        On::All => Value::from("all"),
        On::Some(names) => {
            values::Config::load(config_dir).apply(&mut extension);
            let new: Vec<String> = names
                .iter()
                .filter(|name| !extension.on.contains(name))
                .cloned()
                .collect();
            listed(data_dir, &new)?;
            Value::Array(names.iter().map(String::as_str).collect())
        }
    };
    change_path(config_dir, &["extensions", name], |table| {
        set(table, "on", value);
        Ok(())
    })
    .map(drop)
}

/// Writes the setting `key` of the extension `name` to `value_json`, a JSON value, for
/// `repository` or for every one: refusing a key its manifest does not declare, a value of another
/// type, and a repository not in the list in the data folder `data_dir`.
pub fn set_setting(
    config_dir: &Path,
    data_dir: &Path,
    name: &str,
    repository: Option<&str>,
    key: &str,
    value_json: &str,
) -> Result<(), ApiError> {
    let extension = known(config_dir, name)?;
    let spec = extension
        .settings
        .iter()
        .find(|spec| spec.key == key)
        .ok_or_else(|| refused(format!("{name} has no setting named {key}")))?;
    let json: serde_json::Value = serde_json::from_str(value_json)
        .map_err(|error| refused(format!("{key}: the value is not JSON: {error}")))?;
    let value = values::toml(&spec.kind, &json)
        .ok_or_else(|| refused(format!("{key} is {}", values::kind_text(&spec.kind))))?;
    let mut path = vec!["extensions", name];
    if let Some(repository) = repository {
        listed(data_dir, &[repository.to_owned()])?;
        path.extend(["repositories", repository]);
    }
    change_path(config_dir, &path, |table| {
        set(table, key, value);
        Ok(())
    })
    .map(drop)
}

/// The extension `name`, its manifest read, or the refusal that there is none.
fn known(config_dir: &Path, name: &str) -> Result<Extension, ApiError> {
    if !kebab(name) {
        return Err(refused(format!(
            "{name:?} is not an extension's name, which is kebab-case"
        )));
    }
    find(config_dir, name).ok_or_else(|| refused(format!("no extension named {name}")))
}

/// Refuses the first of `names` not in Uraeda's list of repositories, in `data_dir`, so that a
/// typo never writes a table no repository reads.
fn listed(data_dir: &Path, names: &[String]) -> Result<(), ApiError> {
    let repositories =
        crate::repositories::read(data_dir).map_err(|error| refused(error.to_string()))?;
    let missing = names.iter().find(|name| {
        !repositories
            .iter()
            .any(|repository| &repository.name == *name)
    });
    match missing {
        Some(name) => Err(refused(format!(
            "no repository named {name} in Uraeda's list"
        ))),
        None => Ok(()),
    }
}
