//! A release's notes, and its version: what is read in text, with no git and no file.

/// The repository on GitHub, which a release's links point into.
pub const REPOSITORY: &str = "https://github.com/mrtolkien/uraeda";

const HEADER: &str = "# Changelog\n";

/// A record of `specs/done/`, as the notes show it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Record {
    pub kind: String,
    pub path: String,
    pub pull_request: Option<String>,
    pub summary: String,
    pub title: String,
}

/// The record's kind, title, pull request, and the first paragraph of its "What and why".
pub fn record(path: &str, text: &str) -> Record {
    let front = text
        .strip_prefix("---\n")
        .and_then(|rest| rest.split_once("\n---\n"));
    let front = front.map_or("", |(front, _)| front);
    let field = |name: &str| {
        let lines = front.lines().filter_map(|line| line.strip_prefix(name));
        let mut values = lines.filter_map(|rest| rest.strip_prefix(':'));
        values.next().map(|value| value.trim().to_owned())
    };
    let heading = text.lines().find_map(|line| line.strip_prefix("# "));
    let title = heading.map(|title| title.strip_prefix("Record: ").unwrap_or(title).trim());
    let section = text
        .split_once("\n## What and why\n")
        .map_or("", |(_, rest)| rest);
    let section = section.split("\n## ").next().unwrap_or_default().trim();
    let why = section.split("\n\n").next().unwrap_or_default();
    Record {
        kind: field("kind").unwrap_or_else(|| "feature".to_owned()),
        path: path.to_owned(),
        pull_request: field("pull-request"),
        summary: why.split_whitespace().collect::<Vec<_>>().join(" "),
        title: title.unwrap_or(path).to_owned(),
    }
}

/// A path without its `.` and `..` parts: `specs/done/../decisions/a.md` is
/// `specs/decisions/a.md`.
fn normal(path: &str) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => drop(parts.pop()),
            part => parts.push(part),
        }
    }
    parts.join("/")
}

/// The text with its links relative to the record made absolute, at the tag, for GitHub's
/// release. A link to another site, and one inside the page, stay.
pub fn absolute_links(text: &str, path: &str, version: &str) -> String {
    let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
    let mut out = String::new();
    let mut rest = text;
    while let Some(at) = rest.find("](") {
        let (before, link) = rest.split_at(at + 2);
        out.push_str(before);
        let Some(end) = link.find(')') else {
            rest = link;
            break;
        };
        let target = &link[..end];
        let scheme = target.split_once(':').is_some_and(|(scheme, _)| {
            !scheme.is_empty() && scheme.chars().all(|letter| letter.is_ascii_lowercase())
        });
        if scheme || target.starts_with('#') || target.is_empty() {
            out.push_str(target);
        } else {
            let file = match target.strip_prefix('/') {
                Some(file) => file.to_owned(),
                None => normal(&format!("{folder}/{target}")),
            };
            out.push_str(&format!("{REPOSITORY}/blob/v{version}/{file}"));
        }
        rest = &link[end..];
    }
    out.push_str(rest);
    out
}

/// The version's section, titled with its name: features, then changes, each linked at the
/// tag.
pub fn notes(version: &str, name: &str, date: &str, records: &[Record]) -> String {
    let mut lines = vec![
        format!("## {version} - {name}"),
        String::new(),
        format!("Released on {date}."),
        String::new(),
    ];
    if records.is_empty() {
        lines.push("No feature or change recorded in `specs/done/`.".to_owned());
        lines.push(String::new());
    }
    let changes = |record: &&Record| record.kind == "change";
    let groups: [(&str, Vec<&Record>); 2] = [
        (
            "Features",
            records.iter().filter(|record| !changes(record)).collect(),
        ),
        ("Changes", records.iter().filter(changes).collect()),
    ];
    for (heading, group) in groups {
        if group.is_empty() {
            continue;
        }
        lines.push(format!("### {heading}"));
        lines.push(String::new());
        for record in group {
            let number = record.pull_request.as_deref().and_then(|address| {
                let (_, number) = address.rsplit_once("/pull/")?;
                let digits =
                    !number.is_empty() && number.chars().all(|digit| digit.is_ascii_digit());
                digits.then_some((number, address))
            });
            let link = number.map_or(String::new(), |(number, address)| {
                format!(" ([#{number}]({address}))")
            });
            let page = format!(
                "[{}]({REPOSITORY}/blob/v{version}/{})",
                record.title, record.path
            );
            let text = absolute_links(&record.summary, &record.path, version);
            let text = if text.is_empty() {
                text
            } else {
                format!(": {text}")
            };
            lines.push(format!("- **{page}**{link}{text}"));
        }
        lines.push(String::new());
    }
    lines.join("\n")
}

/// The changelog with the section added above every older one.
pub fn add_section(changelog: &str, section: &str) -> String {
    let body = changelog
        .strip_prefix(HEADER)
        .map_or(changelog, str::trim_start);
    let older = if body.is_empty() {
        String::new()
    } else {
        format!("\n{body}")
    };
    format!("{HEADER}\n{section}{older}")
        .trim_end_matches('\n')
        .to_owned()
        + "\n"
}

/// Where the `[workspace.package]` version's value is in `Cargo.toml`: its start and its end.
fn version_span(cargo: &str) -> Result<(usize, usize), String> {
    let missing = "no [workspace.package] version in Cargo.toml";
    let table = cargo.find("[workspace.package]").ok_or(missing)?;
    let mut at = table;
    for line in cargo[table..].split_inclusive('\n') {
        // The next table's lines are not the workspace's.
        if at > table && line.starts_with('[') {
            break;
        }
        if let Some(value) = line.strip_prefix("version = \"") {
            let start = at + "version = \"".len();
            let end = start + value.find('"').ok_or(missing)?;
            return Ok((start, end));
        }
        at += line.len();
    }
    Err(missing.to_owned())
}

/// The Cargo workspace's version, which `ura --version` prints.
pub fn cargo_version(cargo: &str) -> Result<String, String> {
    let (start, end) = version_span(cargo)?;
    Ok(cargo[start..end].to_owned())
}

/// `Cargo.toml` with its `[workspace.package]` version set.
pub fn set_cargo_version(cargo: &str, version: &str) -> Result<String, String> {
    let (start, end) = version_span(cargo)?;
    Ok(format!("{}{version}{}", &cargo[..start], &cargo[end..]))
}

/// The version a tag or a version names: `v0.5.0` and `0.5.0` are `0.5.0`, and `v0.6.0-rc.1`
/// is `0.6.0-rc.1`.
pub fn version_of(given: &str) -> Result<String, String> {
    let version = given.strip_prefix('v').unwrap_or(given);
    let (numbers, pre) = version
        .split_once('-')
        .map_or((version, None), |(numbers, pre)| (numbers, Some(pre)));
    let number = |part: &str| !part.is_empty() && part.chars().all(|digit| digit.is_ascii_digit());
    let three = numbers.split('.').count() == 3 && numbers.split('.').all(number);
    let named = pre.is_none_or(|pre| {
        let letter =
            |letter: char| letter.is_ascii_alphanumeric() || letter == '.' || letter == '-';
        !pre.is_empty() && pre.chars().all(letter)
    });
    if three && named {
        Ok(version.to_owned())
    } else {
        Err(format!("{given} is not a version"))
    }
}

/// A version's major, minor, and patch.
fn numbers(version: &str) -> Vec<u64> {
    let plain = version.split(['-', '+']).next().unwrap_or_default();
    plain
        .split('.')
        .map(|part| part.parse().unwrap_or(0))
        .collect()
}

/// Whether `next` comes after `current`, comparing major, minor, and patch.
pub fn is_after(next: &str, current: &str) -> bool {
    let (a, b) = (numbers(next), numbers(current));
    if a != b {
        return a > b;
    }
    // The same numbers: only a prerelease of the current version's release may follow.
    current.contains('-') && next != current
}

#[cfg(test)]
mod tests {
    use super::*;

    const RECORD: &str = "---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/16
---

# Record: Text inputs and comments

> [!NOTE]
>
> The record of a merged feature.

## What and why

Writing is most of what the human does
in the web UI.

The second paragraph is left out.

## Behaviour
";

    #[test]
    fn a_record_gives_its_kind_title_pull_request_and_first_paragraph_of_what_and_why() {
        let read = record("specs/done/2026-10-14-text-inputs.md", RECORD);
        let expected = Record {
            kind: "feature".to_owned(),
            path: "specs/done/2026-10-14-text-inputs.md".to_owned(),
            pull_request: Some("https://github.com/mrtolkien/uraeda/pull/16".to_owned()),
            summary: "Writing is most of what the human does in the web UI.".to_owned(),
            title: "Text inputs and comments".to_owned(),
        };
        assert_eq!(read, expected);
    }

    #[test]
    fn the_notes_titled_with_the_name_list_features_then_changes_linked_at_the_tag() {
        let feature = record("specs/done/a.md", RECORD);
        let change = Record {
            kind: "change".to_owned(),
            path: "specs/done/b.md".to_owned(),
            pull_request: None,
            title: "B".to_owned(),
            ..feature.clone()
        };
        let expected = [
            "## 0.5.0 - Comments",
            "",
            "Released on 2026-10-15.",
            "",
            "### Features",
            "",
            "- **[Text inputs and comments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/a.md)** ([#16](https://github.com/mrtolkien/uraeda/pull/16)): Writing is most of what the human does in the web UI.",
            "",
            "### Changes",
            "",
            "- **[B](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/b.md)**: Writing is most of what the human does in the web UI.",
            "",
        ];
        let written = notes("0.5.0", "Comments", "2026-10-15", &[change, feature]);
        assert_eq!(written, expected.join("\n"));
    }

    #[test]
    fn a_release_without_records_says_so() {
        assert_eq!(
            notes("0.5.1", "Fixes", "2026-10-16", &[]),
            "## 0.5.1 - Fixes\n\nReleased on 2026-10-16.\n\nNo feature or change recorded in `specs/done/`.\n"
        );
    }

    #[test]
    fn a_section_goes_under_the_header_above_older_ones() {
        let first = add_section("", "## 0.5.0 - 2026-10-15\n\nA.\n");
        assert_eq!(first, "# Changelog\n\n## 0.5.0 - 2026-10-15\n\nA.\n");
        assert_eq!(
            add_section(&first, "## 0.6.0 - 2026-10-20\n\nB.\n"),
            "# Changelog\n\n## 0.6.0 - 2026-10-20\n\nB.\n\n## 0.5.0 - 2026-10-15\n\nA.\n"
        );
    }

    #[test]
    fn only_the_workspaces_version_changes_in_cargo_toml() {
        let cargo = "[workspace]\nmembers = []\n\n[workspace.package]\nversion = \"0.4.0\"\nedition = \"2024\"\n\n[dependencies]\nfoo = { version = \"1.0.0\" }\n";
        assert_eq!(cargo_version(cargo).unwrap(), "0.4.0");
        assert_eq!(
            set_cargo_version(cargo, "0.5.0").unwrap(),
            cargo.replace("\"0.4.0\"", "\"0.5.0\"")
        );
        let refused = set_cargo_version("[package]\nversion = \"1.0.0\"\n", "0.5.0");
        assert!(
            refused
                .unwrap_err()
                .contains("no [workspace.package] version")
        );
        // A table after it holds another version, which is not the workspace's.
        let later = "[workspace.package]\nedition = \"2024\"\n\n[package]\nversion = \"1.0.0\"\n";
        assert!(cargo_version(later).is_err());
    }

    #[test]
    fn a_version_comes_after_another() {
        let cases = [
            ("0.5.0", "0.4.0", true),
            ("0.4.1", "0.4.0", true),
            ("1.0.0", "0.9.9", true),
            ("0.6.0-rc.1", "0.5.0", true),
            ("0.6.0", "0.6.0-rc.1", true),
            ("0.6.0-rc.2", "0.6.0-rc.1", true),
            ("0.4.0", "0.4.0", false),
            ("0.3.9", "0.4.0", false),
            ("0.4.0-rc.1", "0.4.0", false),
        ];
        for (next, current, after) in cases {
            assert_eq!(is_after(next, current), after, "{next} after {current}");
        }
    }

    #[test]
    fn a_tag_or_a_version_names_a_version_and_nothing_else_does() {
        assert_eq!(version_of("v0.5.0").unwrap(), "0.5.0");
        assert_eq!(version_of("0.5.0").unwrap(), "0.5.0");
        assert_eq!(version_of("v0.6.0-rc.1").unwrap(), "0.6.0-rc.1");
        for given in ["main", "1.2", "1.2.x", "1.2.3-", "v"] {
            assert_eq!(
                version_of(given).unwrap_err(),
                format!("{given} is not a version")
            );
        }
    }

    #[test]
    fn links_relative_to_a_record_point_at_the_tag_others_stay() {
        let text = "[a](2026-10-14-run-ui.md), [b](../decisions/stack.md), [c](/README.md), [d](https://x.dev), [e](#q1)";
        assert_eq!(
            absolute_links(text, "specs/done/r.md", "0.5.0"),
            "[a](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md), [b](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/decisions/stack.md), [c](https://github.com/mrtolkien/uraeda/blob/v0.5.0/README.md), [d](https://x.dev), [e](#q1)"
        );
    }
}
