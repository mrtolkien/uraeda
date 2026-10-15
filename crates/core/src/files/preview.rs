//! The preview decision's two fields, `preview-folder` and `preview-command`: where a checkout's
//! Storybook runs, and the command that starts it. `ura check` and the server read them through
//! the one rule here.

use std::path::{Component, Path};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::frontmatter::{self, Frontmatter, Value};

const FOLDER: &str = "preview-folder";
const COMMAND: &str = "preview-command";
const FOLDER_RULE: &str = "frontmatter.preview-folder";
const COMMAND_RULE: &str = "frontmatter.preview-command";

/// A checkout's preview, from its active preview decision.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    /// The folder the command runs in, from the repository's top level: `.` for the top level.
    pub folder: String,
    /// The command, holding `{port}` where the port goes.
    pub command: String,
}

/// The preview fields' problems, each with its rule and message: both fields or neither, a command
/// holding `{port}`, and a folder that is `.` or a relative path without `..` parts.
pub fn field_problems(front: &Frontmatter) -> Vec<(&'static str, String)> {
    let folder = written(front, FOLDER);
    let command = written(front, COMMAND);
    if folder.is_none() && command.is_none() {
        return Vec::new();
    }
    let mut problems = Vec::new();
    match folder {
        None => problems.push((FOLDER_RULE, missing(FOLDER))),
        Some(folder) if !is_repository_folder(&folder) => problems.push((
            FOLDER_RULE,
            format!("\"{FOLDER}\" \"{folder}\" is not a folder of the repository"),
        )),
        Some(_) => {}
    }
    match command {
        None => problems.push((COMMAND_RULE, missing(COMMAND))),
        Some(command) if !command.contains("{port}") => {
            problems.push((COMMAND_RULE, format!("\"{COMMAND}\" has no {{port}}")))
        }
        Some(_) => {}
    }
    problems
}

/// The preview of a preview decision's text: `None` unless it is `active` and both fields are
/// valid.
pub fn preview_of(text: &str) -> Option<Preview> {
    let front = frontmatter::parse(text).ok()?;
    if front.text("status") != Some("active") || !field_problems(&front).is_empty() {
        return None;
    }
    Some(Preview {
        folder: written(&front, FOLDER)?,
        command: written(&front, COMMAND)?,
    })
}

/// A field's value as text, as written when YAML reads it as a number or a boolean.
fn written(front: &Frontmatter, key: &str) -> Option<String> {
    match front.get(key)? {
        Value::Text(text) => Some(text.clone()),
        _ => front.raw(key).map(str::to_string),
    }
}

fn missing(key: &str) -> String {
    format!("no \"{key}\" field")
}

/// Whether a path is `.` or a folder under the repository's top level: relative, without `..`.
fn is_repository_folder(folder: &str) -> bool {
    let path = Path::new(folder);
    !folder.trim().is_empty()
        && path
            .components()
            .all(|part| matches!(part, Component::Normal(_) | Component::CurDir))
}
