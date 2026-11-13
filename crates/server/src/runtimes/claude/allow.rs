//! The rule that allows one blocked action, as Claude Code's `--allowedTools` reads it.

use url::Url;

use crate::runner::Denial;

/// The narrowest allow rule for a blocked action, for `--allowedTools`. Claude Code checks files
/// against `Edit` and `Read` rules only, so a blocked `Write` gets an `Edit` rule. In a file
/// rule, `/path` is relative to the settings' folder, so an absolute path takes two slashes:
/// `Edit(//home/me/a)`. A tool with no target gets its bare name, which allows its every call
/// for the process.
///
/// A Bash rule with a `*` is a wildcard, which Claude Code cannot be told to read literally: a
/// command with one has no rule. A file rule is a gitignore pattern, so its special characters
/// are escaped, as Claude Code escapes the paths it saves.
///
/// A rule with a line break has none either: the turn stores its rules a line each.
pub(super) fn rule(denial: &Denial) -> Option<String> {
    narrow(denial).filter(|rule| !rule.contains('\n'))
}

fn narrow(denial: &Denial) -> Option<String> {
    let tool = denial.tool.as_str();
    let value = |key: &str| {
        let value = denial.input.get(key)?.as_str();
        value.filter(|value| !value.is_empty())
    };
    if let ("Bash", Some(command)) = (tool, value("command")) {
        return (!command.contains('*')).then(|| format!("Bash({command})"));
    }
    let file =
        value("file_path").filter(|_| matches!(tool, "Edit" | "Write" | "MultiEdit" | "Read"));
    if let Some(file) = file {
        let rule = if tool == "Read" { "Read" } else { "Edit" };
        return Some(format!("{rule}({})", pattern(file)));
    }
    let host = value("url").filter(|_| tool == "WebFetch").and_then(host);
    Some(host.map_or_else(
        || tool.to_owned(),
        |host| format!("WebFetch(domain:{host})"),
    ))
}

/// A path as the pattern that matches it alone, absolute with two slashes.
fn pattern(file: &str) -> String {
    let mut escaped = String::with_capacity(file.len() + 2);
    for (at, letter) in file.chars().enumerate() {
        let special = matches!(letter, '\\' | '*' | '?' | '[' | ']');
        if special || (at == 0 && matches!(letter, '!' | '#')) {
            escaped.push('\\');
        }
        escaped.push(letter);
    }
    if escaped.starts_with('/') && !escaped.starts_with("//") {
        escaped.insert(0, '/');
    }
    escaped
}

/// The host of an address, as a browser reads it: none for a text that is no address.
fn host(address: &str) -> Option<String> {
    let address = Url::parse(address).ok()?;
    Some(address.host_str().unwrap_or_default().to_owned())
}
