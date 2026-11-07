//! A theme file's text, parsed: its keys, its palette, and its roles, each problem with its line.

use toml_edit::{Document, Item, TableLike};

use super::{ROLES, ThemeProblem};

/// A role's value: a palette entry's name, or a colour, `#rrggbb` or `#rrggbbaa` in lower case.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Expr {
    Name(String),
    Colour(String),
}

/// A theme file, parsed: what it says, and its problems so far.
#[derive(Debug, Default)]
pub struct Parsed {
    pub name: Option<String>,
    /// `"dark"` or `"light"`, when written and valid.
    pub mode: Option<&'static str>,
    pub extends: Option<String>,
    pub extends_line: Option<u32>,
    /// Its own palette, colours in lower case, in the file's order.
    pub palette: Vec<(String, String)>,
    /// Its own roles, known ones only, each with its line.
    pub roles: Vec<(String, Expr, Option<u32>)>,
    pub problems: Vec<ThemeProblem>,
    /// Whether a problem leaves it out of the lists.
    pub unlisted: bool,
}

impl Parsed {
    /// A file that could not be read, for `reason`.
    pub fn unreadable(reason: String, line: Option<u32>) -> Self {
        let mut parsed = Self::default();
        parsed.error(line, format!("Could not read: {reason}"), true);
        parsed
    }

    /// An error, which leaves the lists when `unlists`.
    pub fn error(&mut self, line: Option<u32>, message: String, unlists: bool) {
        self.unlisted |= unlists;
        self.problems.push(ThemeProblem {
            line,
            message,
            is_warning: false,
            is_under_floor: false,
            role: None,
        });
    }

    /// A warning: something ignored, never leaving the lists.
    pub fn warning(&mut self, line: Option<u32>, message: String) {
        self.problems.push(ThemeProblem {
            line,
            message,
            is_warning: true,
            is_under_floor: false,
            role: None,
        });
    }

    /// A warning naming `role`'s colour under the contrast floor, which applies as written.
    pub fn under_floor(&mut self, line: Option<u32>, message: String, role: &str) {
        self.problems.push(ThemeProblem {
            line,
            message,
            is_warning: true,
            is_under_floor: true,
            role: Some(role.to_owned()),
        });
    }

    /// An error of `role`, which keeps the colour of the theme the file extends.
    pub fn role_error(&mut self, line: Option<u32>, message: String, role: &str) {
        self.problems.push(ThemeProblem {
            line,
            message,
            is_warning: false,
            is_under_floor: false,
            role: Some(role.to_owned()),
        });
    }
}

/// `text`, a theme file's, parsed.
pub fn parse(text: &str) -> Parsed {
    let document = match Document::parse(text) {
        Ok(document) => document,
        Err(error) => {
            let line = error.span().map_or(1, |span| line(text, span.start));
            let message = error
                .message()
                .lines()
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(", ");
            return Parsed::unreadable(format!("line {line}: {message}."), Some(line));
        }
    };
    let mut parsed = Parsed::default();
    let root = document.as_table();
    for (key, _) in root.iter() {
        let Some((key_span, item)) = root.get_key_value(key) else {
            continue;
        };
        let at = key_span
            .span()
            .or_else(|| item.span())
            .map(|span| line(text, span.start));
        top_level(&mut parsed, text, key, item, at);
    }
    parsed
}

/// A top-level key of the file, at line `at`.
fn top_level(parsed: &mut Parsed, text: &str, key: &str, item: &Item, at: Option<u32>) {
    match key {
        "name" => match item.as_str() {
            Some(name) => parsed.name = Some(name.to_owned()),
            None => parsed.warning(
                at,
                format!("{}name is not text in quotes, and is ignored.", at_line(at)),
            ),
        },
        "mode" => match item.as_str() {
            Some("dark") => parsed.mode = Some("dark"),
            Some("light") => parsed.mode = Some("light"),
            _ => parsed.error(
                at,
                format!(
                    "{}mode is {}: write \"dark\" or \"light\".",
                    at_line(at),
                    shown(item)
                ),
                true,
            ),
        },
        "extends" => match item.as_str() {
            Some(id) => {
                parsed.extends = Some(id.to_owned());
                parsed.extends_line = at;
            }
            None => parsed.error(
                at,
                format!("{}extends is a theme's id in quotes.", at_line(at)),
                true,
            ),
        },
        "palette" | "roles" => match item.as_table_like() {
            Some(table) if key == "palette" => palette(parsed, text, table),
            Some(table) => roles(parsed, text, table),
            None => parsed.error(at, format!("{}{key} is a table.", at_line(at)), true),
        },
        _ => parsed.warning(
            at,
            format!(
                "{}{key} is not a key of a theme, and is ignored.",
                at_line(at)
            ),
        ),
    }
}

/// The `[palette]` table's entries, each a colour.
fn palette(parsed: &mut Parsed, text: &str, table: &dyn TableLike) {
    for (name, item, at) in entries(text, table) {
        match item.as_str().and_then(colour) {
            Some(colour) => parsed.palette.push((name, colour)),
            None => parsed.error(at, not_a_colour(at, &name, item), false),
        }
    }
}

/// The `[roles]` table's entries, each a known role naming a palette entry or giving a colour.
fn roles(parsed: &mut Parsed, text: &str, table: &dyn TableLike) {
    for (role, item, at) in entries(text, table) {
        let prefix = at_line(at);
        if !ROLES.contains(&role.as_str()) {
            parsed.warning(at, format!("{prefix}{role} is not a role, and is ignored."));
            continue;
        }
        let expr = match item.as_str() {
            Some(value) if value.starts_with('#') => colour(value).map(Expr::Colour),
            Some(value) => Some(Expr::Name(value.to_owned())),
            None => {
                let message = format!(
                    "{prefix}{role} is {}, which is not a palette name or a colour.",
                    shown(item)
                );
                parsed.role_error(at, message, &role);
                continue;
            }
        };
        match expr {
            Some(expr) => parsed.roles.push((role, expr, at)),
            None => parsed.role_error(at, not_a_colour(at, &role, item), &role),
        }
    }
}

/// A table's entries, each with the line of its key.
fn entries<'a>(text: &str, table: &'a dyn TableLike) -> Vec<(String, &'a Item, Option<u32>)> {
    table
        .iter()
        .filter_map(|(name, _)| {
            let (key, item) = table.get_key_value(name)?;
            let at = key
                .span()
                .or_else(|| item.span())
                .map(|span| line(text, span.start));
            Some((name.to_owned(), item, at))
        })
        .collect()
}

fn not_a_colour(at: Option<u32>, name: &str, item: &Item) -> String {
    let prefix = at_line(at);
    format!(
        "{prefix}{name} is {}, which is not a colour: write #rrggbb or #rrggbbaa.",
        shown(item)
    )
}

/// `value` in lower case when it is a colour, `#rrggbb` or `#rrggbbaa`.
pub fn colour(value: &str) -> Option<String> {
    let hex = value.strip_prefix('#')?;
    let valid = matches!(hex.len(), 6 | 8) && hex.bytes().all(|byte| byte.is_ascii_hexdigit());
    valid.then(|| value.to_ascii_lowercase())
}

/// A value as the file writes it, `"dim"` or `3`.
fn shown(item: &Item) -> String {
    item.as_value()
        .map_or_else(|| "a table".to_owned(), |value| value.to_string())
        .trim()
        .to_owned()
}

/// The line of the byte `offset` in `text`, from 1.
fn line(text: &str, offset: usize) -> u32 {
    u32::try_from(crate::settings::line(text, offset)).unwrap_or(u32::MAX)
}

/// The start of a problem's message at line `at`, `Line 3: `; empty for a whole-file problem.
pub fn at_line(at: Option<u32>) -> String {
    at.map_or_else(String::new, |at| format!("Line {at}: "))
}
