//! The YAML frontmatter between a first line `---` and the next line `---`.

use std::collections::BTreeMap;

use serde::Deserialize;

/// A frontmatter value, as far as the workflow's fields need it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Value {
    Text(String),
    Integer(i64),
    Bool(bool),
    Null,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum FrontmatterError {
    #[error("no frontmatter")]
    Missing,
    #[error("frontmatter is not closed")]
    Unclosed,
    #[error("frontmatter is not valid YAML: {0}")]
    Yaml(String),
}

/// A file's frontmatter: its fields sorted by name, and the line of each.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frontmatter {
    pub fields: Vec<(String, Value)>,
    /// The line of the closing `---`.
    pub end_line: usize,
    lines: Vec<(String, usize)>,
    raw: Vec<(String, String)>,
}

impl Frontmatter {
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.fields
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    /// A field's value when it is text.
    pub fn text(&self, key: &str) -> Option<&str> {
        match self.get(key) {
            Some(Value::Text(text)) => Some(text),
            _ => None,
        }
    }

    /// A field's value when it is an integer.
    pub fn integer(&self, key: &str) -> Option<i64> {
        match self.get(key) {
            Some(Value::Integer(value)) => Some(*value),
            _ => None,
        }
    }

    /// A field's value as written, without quotes: `0000000` stays text, where YAML reads a
    /// number.
    pub fn raw(&self, key: &str) -> Option<&str> {
        self.raw
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    /// The line a field is written on.
    pub fn line(&self, key: &str) -> Option<usize> {
        self.lines
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, line)| *line)
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Field {
    Bool(bool),
    Integer(i64),
    Text(String),
    Other(serde::de::IgnoredAny),
}

/// The YAML text of the frontmatter, and the line of its closing `---`.
pub fn block(text: &str) -> Result<(&str, usize), FrontmatterError> {
    let mut lines = text.split_inclusive('\n');
    let first = lines.next().ok_or(FrontmatterError::Missing)?;
    if first.trim_end_matches(['\r', '\n']) != "---" {
        return Err(FrontmatterError::Missing);
    }
    let start = first.len();
    let mut end = start;
    for (index, line) in lines.enumerate() {
        if line.trim_end_matches(['\r', '\n']) == "---" {
            return Ok((&text[start..end], index + 2));
        }
        end += line.len();
    }
    Err(FrontmatterError::Unclosed)
}

/// Parses the frontmatter of a workflow file.
pub fn parse(text: &str) -> Result<Frontmatter, FrontmatterError> {
    let (yaml, end_line) = block(text)?;
    let map: BTreeMap<String, Option<Field>> = if yaml.trim().is_empty() {
        BTreeMap::new()
    } else {
        // A short commit hash like `1e23456` reads as a float too large for YAML: keep it as text.
        let mut options = serde_saphyr::Options::default();
        options.reject_non_finite_typeless_float = false;
        serde_saphyr::from_str_with_options(yaml, options)
            .map_err(|error| FrontmatterError::Yaml(yaml_message(&error)))?
    };
    let fields = map
        .into_iter()
        .map(|(key, field)| {
            let value = match field {
                None => Value::Null,
                Some(Field::Bool(value)) => Value::Bool(value),
                Some(Field::Integer(value)) => Value::Integer(value),
                Some(Field::Text(value)) => Value::Text(value),
                Some(Field::Other(_)) => Value::Other,
            };
            (key, value)
        })
        .collect();
    let mut lines = Vec::new();
    let mut raw = Vec::new();
    for (index, line) in yaml.lines().enumerate() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let valid = !key.is_empty()
            && key
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
        if !valid {
            continue;
        }
        lines.push((key.to_string(), index + 2));
        let value = value.split(" #").next().unwrap_or_default().trim();
        let value = value.trim_matches(|c| c == '"' || c == '\'');
        raw.push((key.to_string(), value.to_string()));
    }
    Ok(Frontmatter {
        fields,
        end_line,
        lines,
        raw,
    })
}

/// Sets a field to a plain value: replaces its line, or adds it before the closing `---`. A text
/// without frontmatter gets one.
pub fn set(text: &str, key: &str, value: &str) -> String {
    let result: Result<String, ()> = super::with_unix_newlines(text, |text| {
        let line = format!("{key}: {value}");
        let Ok((_, end_line)) = block(text) else {
            return Ok(format!("---\n{line}\n---\n{text}"));
        };
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        let prefix = format!("{key}:");
        match lines[1..end_line - 1]
            .iter()
            .position(|existing| existing.starts_with(&prefix))
        {
            Some(index) => lines[index + 1] = line,
            None => lines.insert(end_line - 1, line),
        }
        Ok(lines.join("\n"))
    });
    result.unwrap_or_else(|()| text.to_string())
}

/// The parser's message on one line: its first line, without its own `error: ` prefix, and
/// without the code snippet that follows.
pub(crate) fn yaml_message(error: &impl std::fmt::Display) -> String {
    let message = error.to_string();
    let first = message.lines().next().unwrap_or_default();
    first.strip_prefix("error: ").unwrap_or(first).to_string()
}
