//! A review's findings, `findings-NN.md`: written in the feature's folder once every reviewer has
//! answered, and committed alone, before any of them is fixed.

use std::fs;

use crate::workspace::{Feature, FileKind};

use super::commit::commit_only;
use super::place::Place;
use super::{ActionError, Change};

/// The findings of one review: what was reviewed, `wave 2` or `branch`, the range of commits
/// reviewed, `<base>..<head>` by their IDs, and each reviewer's section, in the order they ran.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Findings {
    pub reviewed: String,
    pub commits: String,
    pub sections: Vec<FindingsSection>,
}

/// A reviewer's section: its name, as the run map shows it, "Codex · GPT-6.1-Sol", and its findings
/// as it wrote them, a markdown list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FindingsSection {
    pub reviewer: String,
    pub text: String,
}

/// The subject of the commit of findings round `round`: `review(recurring-tasks): findings 02`.
pub fn subject(slug: &str, round: u32) -> String {
    format!("review({slug}): findings {round:02}")
}

/// The next round of findings in the folder as the working tree has it: one after the highest
/// round there, so a round removed by hand never makes two files of one number.
fn next_round(place: &Place, feature: &Feature) -> Result<u32, ActionError> {
    let dir = place.root.join(&feature.path);
    let mut highest = 0;
    for entry in fs::read_dir(&dir)? {
        let name = entry?.file_name().to_string_lossy().into_owned();
        if let Some((FileKind::Findings, Some(round))) = FileKind::of(&name) {
            highest = highest.max(round);
        }
    }
    Ok(highest + 1)
}

/// The text of a findings file: its frontmatter, its title, then a section per reviewer.
pub fn text(title: &str, findings: &Findings) -> String {
    let reviewed = match findings.reviewed.trim() {
        "branch" => "the branch",
        wave => wave,
    };
    let line = |text: &str| text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut text = format!(
        "---\nreviewed: {}\ncommits: {}\n---\n\n# Findings: {title}, {reviewed}\n",
        line(&findings.reviewed),
        line(&findings.commits),
    );
    for section in &findings.sections {
        text.push_str(&format!("\n## {}\n", line(&section.reviewer)));
        let body = demoted(section.text.trim());
        if !body.is_empty() {
            text.push_str(&format!("\n{body}\n"));
        }
    }
    text
}

/// `body` with each heading of level 1 or 2 outside a code fence made a level 3 one, so that a
/// reviewer's own headings stay inside its section.
fn demoted(body: &str) -> String {
    let mut fence: Option<char> = None;
    let lines: Vec<String> = body
        .lines()
        .map(|line| {
            let start = line.trim_start_matches(' ');
            let indent = line.len() - start.len();
            if indent < 4 {
                for mark in ['`', '~'] {
                    if start.starts_with(&mark.to_string().repeat(3)) {
                        fence = match fence {
                            None => Some(mark),
                            Some(open) if open == mark => None,
                            open => open,
                        };
                    }
                }
            }
            if fence.is_some() || indent >= 4 {
                return line.to_owned();
            }
            let hashes = start.len() - start.trim_start_matches('#').len();
            let rest = &start[hashes..];
            if (1..=2).contains(&hashes) && (rest.is_empty() || rest.starts_with([' ', '\t'])) {
                return format!("{}###{rest}", &line[..indent]);
            }
            line.to_owned()
        })
        .collect();
    lines.join("\n")
}

/// Whether `commits` is a range of two commit IDs, `<base>..<head>`, in lowercase hex: plain text
/// in YAML, written unquoted.
fn is_range(commits: &str) -> bool {
    let id = |part: &str| {
        !part.is_empty() && part.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
    };
    commits
        .split_once("..")
        .is_some_and(|(base, head)| id(base) && id(head))
}

/// Writes the next `findings-NN.md` in the feature's folder of `place`, and commits it alone: other
/// changes of the working tree stay out of the commit. Returns its path from the top level. Refused
/// without a section, for a `reviewed` not `branch` or `wave <N>`, and for `commits` not two commit
/// IDs, `<base>..<head>`.
pub fn write_and_commit(
    place: &Place,
    feature: &Feature,
    title: &str,
    findings: &Findings,
) -> Result<String, ActionError> {
    if findings.sections.is_empty() {
        return Err(ActionError::Refused(
            "a review's findings need one reviewer's section at least".into(),
        ));
    }
    let wave = |reviewed: &str| {
        reviewed.strip_prefix("wave ").is_some_and(|number| {
            !number.is_empty() && number.bytes().all(|digit| digit.is_ascii_digit())
        })
    };
    let reviewed = findings.reviewed.trim();
    if reviewed != "branch" && !wave(reviewed) {
        return Err(ActionError::Refused(
            "a review's findings review the branch or a wave, like wave 2".into(),
        ));
    }
    if !is_range(findings.commits.trim()) {
        return Err(ActionError::Refused(
            "a review's findings name their commits by two commit IDs, like abc..def".into(),
        ));
    }
    let round = next_round(place, feature)?;
    let path = format!("{}/findings-{round:02}.md", feature.path);
    fs::write(place.root.join(&path), text(title, findings))?;
    let change = Change {
        paths: vec![path.clone()],
        subject: subject(&feature.slug, round),
        body: None,
    };
    commit_only(place, &change)?;
    Ok(path)
}
