//! The server's environment: the one it starts in, then the config folder's `.env` for what that
//! one leaves unset. No other `.env` is ever read: one in a cloned project could widen the host
//! names the server accepts, so secrets live only in the owner's config folder.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs;
use std::path::Path;
use std::process::Command;

/// The file of secrets, in the config folder.
pub const FILE: &str = ".env";

/// The variables the server reads, and gives every process it runs.
#[derive(Clone, Debug, Default)]
pub struct Environment {
    variables: BTreeMap<String, String>,
    /// The ones the config folder's `.env` gave, which the environment given left unset.
    added: BTreeMap<String, String>,
}

impl Environment {
    /// The environment `given`, then the `.env` of `config_dir` for each variable it leaves unset
    /// or empty. A missing file adds nothing.
    pub fn load(config_dir: &Path, given: Vec<(String, String)>) -> Environment {
        let file = fs::read_to_string(config_dir.join(FILE)).unwrap_or_default();
        let mut variables: BTreeMap<String, String> = parse(&file).into_iter().collect();
        let mut added = variables.clone();
        for (name, value) in given.into_iter().filter(|(_, value)| !value.is_empty()) {
            added.remove(&name);
            variables.insert(name, value);
        }
        Environment { variables, added }
    }

    /// The variables the config folder's `.env` adds to the environment the server started in:
    /// what a process the server does not start itself, as the core's `git`, is given besides
    /// the process's own environment, so that it runs in this one.
    pub fn added(&self) -> Vec<(String, String)> {
        let added = self.added.iter();
        added
            .map(|(name, value)| (name.clone(), value.clone()))
            .collect()
    }

    /// A variable's value, or none when it is unset or empty.
    pub fn var(&self, name: &str) -> Option<&str> {
        self.variables
            .get(name)
            .map(String::as_str)
            .filter(|value| !value.is_empty())
    }

    /// A command to run `program` in this environment, and in no other: every process the server
    /// runs, as an agent or a preview, starts from here, so the config folder's secrets reach it.
    /// The core starts `git` itself: [`Environment::added`] is what it is given.
    pub fn command(&self, program: impl AsRef<OsStr>) -> Command {
        let mut command = Command::new(program);
        command.env_clear().envs(&self.variables);
        command
    }
}

/// The variables of a `.env` file's text, one per line, as `NAME=value`: `export` before a name,
/// quotes around a value, and a comment from `#` are left out. A line that names no variable is
/// skipped.
fn parse(text: &str) -> Vec<(String, String)> {
    text.lines().filter_map(variable).collect()
}

/// The variable a line sets, if any.
fn variable(line: &str) -> Option<(String, String)> {
    let line = line.trim();
    let line = line.strip_prefix("export ").unwrap_or(line);
    let (name, value) = line.split_once('=')?;
    let name = name.trim();
    let named = !name.is_empty()
        && !name.starts_with(|first: char| first.is_ascii_digit())
        && name
            .chars()
            .all(|letter| letter.is_ascii_alphanumeric() || letter == '_');
    named.then(|| (name.to_owned(), unquoted(value.trim())))
}

/// A value without its quotes, or without the comment after it when it has none. Between double
/// quotes, `\n` is a new line.
fn unquoted(value: &str) -> String {
    for quote in ['"', '\'', '`'] {
        let inner = value
            .strip_prefix(quote)
            .and_then(|rest| rest.split_once(quote));
        match inner {
            Some((inner, _)) if quote == '"' => return inner.replace("\\n", "\n"),
            Some((inner, _)) => return inner.to_owned(),
            None => {}
        }
    }
    let end = value.find(" #").unwrap_or(value.len());
    value[..end].trim_end().to_owned()
}
