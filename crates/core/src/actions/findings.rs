//! A review's findings, `findings-NN.md`: written in the feature's folder once every reviewer has
//! answered, and committed alone, before any of them is fixed.

use std::fs;

use crate::workspace::{Feature, FileKind};

use super::commit::commit_only;
use super::place::Place;
use super::{ActionError, Change};

/// The findings of one review: what was reviewed, `wave 2` or `branch`, the range of commits
/// reviewed, `<base>..<head>`, and each reviewer's section, in the order they ran.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Findings {
    pub reviewed: String,
    pub commits: String,
    pub sections: Vec<FindingsSection>,
}

/// A reviewer's section: its name, as the run map shows it, "Codex · GPT-6.1-Sol", and its findings
/// as it wrote them, a markdown list.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
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
        let body = section.text.trim();
        if !body.is_empty() {
            text.push_str(&format!("\n{body}\n"));
        }
    }
    text
}

/// Writes the next `findings-NN.md` in the feature's folder of `place`, and commits it alone: other
/// changes of the working tree stay out of the commit. Returns its path from the top level.
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
