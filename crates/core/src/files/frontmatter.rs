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
        serde_saphyr::from_str(yaml)
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
    let lines = yaml
        .lines()
        .enumerate()
        .filter_map(|(index, line)| {
            let (key, _) = line.split_once(':')?;
            let valid = !key.is_empty()
                && key
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
            valid.then(|| (key.to_string(), index + 2))
        })
        .collect();
    Ok(Frontmatter {
        fields,
        end_line,
        lines,
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
