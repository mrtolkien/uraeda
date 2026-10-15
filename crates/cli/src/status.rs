//! `ura status`: where every feature and change stands, by `PRIORITIES.md` section.

use std::process::ExitCode;

use uraeda_core::files::priorities::Section;
use uraeda_core::steps::{PullRequest, StepName, WaitsOn};
use uraeda_core::workspace::{Feature, PriorityEntry, Workspace, first_file, folder_branch};

use crate::output::{self, Style};

pub fn run(json: bool) -> Result<ExitCode, String> {
    let (_, workspace) = output::workspace()?;
    if json {
        output::print_json(&workspace);
    } else {
        print!("{}", render(&workspace));
    }
    Ok(ExitCode::SUCCESS)
}

struct Row {
    name: String,
    waits: &'static str,
    step: String,
}

/// A feature's name in the table: its folder, or its branch for a change.
pub fn name(feature: &Feature) -> String {
    folder_branch(feature.kind, &feature.folder)
}

/// What a merged feature left behind, in words: `worktree and branch`, `worktree`, or `branch`.
pub fn leftovers(feature: &Feature) -> Option<&'static str> {
    match (&feature.left_worktree, &feature.left_branch) {
        (Some(_), Some(_)) => Some("worktree and branch"),
        (Some(_), None) => Some("worktree"),
        (None, Some(_)) => Some("branch"),
        (None, None) => None,
    }
}

/// What a feature waits for, in words.
pub fn describe(feature: &Feature) -> String {
    if !feature.problems.is_empty() {
        return "invalid files: run ura check".to_string();
    }
    let step = &feature.step;
    let mut text = match (step.name, &step.file) {
        (StepName::HumanGate, Some(file)) => {
            let waiting = feature
                .files
                .iter()
                .find(|f| &f.name == file)
                .and_then(|f| f.waiting_line.clone());
            let what = waiting.unwrap_or_else(|| {
                if file == first_file(feature.kind) {
                    "write it, then commit it".to_string()
                } else {
                    "waiting for you".to_string()
                }
            });
            format!("{file}: {what}")
        }
        (StepName::None, _) => "nothing to do".to_string(),
        (StepName::Finish, _) => match (feature.is_finished(), step.pull_request) {
            (true, Some(PullRequest::Draft)) => "finish: mark the pull request ready",
            (true, _) => "finish: open the pull request",
            (false, _) => "finish: write the record",
        }
        .to_string(),
        (StepName::Done, _) => match leftovers(feature) {
            Some(left) => format!("merged: {left} left, run ura clean"),
            None => "merged".to_string(),
        },
        (name, _) => match &step.task {
            Some(task) => format!("{}, {task}", name.as_str()),
            None => name.as_str().to_string(),
        },
    };
    // A change's agent step stands whatever its pull request, so only the pull request row says
    // its state is unknown.
    if step.name == StepName::PullRequest && step.pull_request == Some(PullRequest::Unknown) {
        text.push_str(" (pull request state unknown)");
    }
    if let Some(behind) = feature.behind.filter(|behind| *behind > 0) {
        text.push_str(&format!(" (behind origin by {behind})"));
    }
    if feature.uncommitted {
        text.push_str(" (uncommitted changes)");
    }
    text
}

fn feature_row(feature: &Feature) -> Row {
    let waits = match (
        feature.problems.is_empty(),
        feature.step.name,
        feature.step.waits_on,
    ) {
        (false, _, _) | (_, StepName::None, _) => "-",
        (_, _, WaitsOn::Human) => "you",
        (_, _, WaitsOn::Agent) => "agent",
        (_, _, WaitsOn::Nobody) => "-",
    };
    Row {
        name: name(feature),
        waits,
        step: describe(feature),
    }
}

fn entry_row(entry: &PriorityEntry) -> Row {
    let name = entry
        .link
        .as_deref()
        .and_then(|link| {
            let path = link.split('#').next()?;
            let mut parts = path.rsplit('/');
            let file = parts.next()?;
            let stem = file.strip_suffix(".md").unwrap_or(file);
            Some(if stem == "proposal" {
                parts.next()?.to_string()
            } else {
                stem.to_string()
            })
        })
        .unwrap_or_else(|| shorten(&entry.text));
    let step = match &entry.link {
        Some(link) => format!("not started ({link})"),
        None => "not started".to_string(),
    };
    Row {
        name,
        waits: "-",
        step,
    }
}

/// An entry's text, cut to 40 characters on a word, for the name column.
fn shorten(text: &str) -> String {
    const LIMIT: usize = 40;
    if text.chars().count() <= LIMIT {
        return text.to_string();
    }
    let cut: String = text.chars().take(LIMIT).collect();
    let cut = cut.rsplit_once(' ').map_or(cut.as_str(), |(head, _)| head);
    format!("{}…", cut.trim_end_matches([',', ':', ';', ' ']))
}

fn render(workspace: &Workspace) -> String {
    let mut groups: Vec<(String, Vec<Row>)> = Vec::new();
    for section in [
        Section::Now,
        Section::Next,
        Section::Later,
        Section::Blocked,
    ] {
        let rows: Vec<Row> = workspace
            .priorities
            .iter()
            .filter(|entry| entry.section == section)
            .map(
                |entry| match entry.feature.as_deref().and_then(|f| workspace.feature(f)) {
                    Some(feature) => feature_row(feature),
                    None => entry_row(entry),
                },
            )
            .collect();
        if !rows.is_empty() {
            groups.push((section.title().to_string(), rows));
        }
    }
    let listed: Vec<&str> = workspace
        .priorities
        .iter()
        .filter_map(|entry| entry.feature.as_deref())
        .collect();
    let done = |feature: &&Feature| feature.step.name == StepName::Done;
    let others: Vec<Row> = workspace
        .features
        .iter()
        .filter(|feature| !listed.contains(&feature.folder.as_str()) && !done(feature))
        .map(feature_row)
        .collect();
    if !others.is_empty() {
        groups.push(("Not in priorities".to_string(), others));
    }
    let merged: Vec<Row> = workspace
        .features
        .iter()
        .filter(|feature| !listed.contains(&feature.folder.as_str()) && done(feature))
        .map(feature_row)
        .collect();
    if !merged.is_empty() {
        groups.push(("Done".to_string(), merged));
    }

    let width = groups
        .iter()
        .flat_map(|(_, rows)| rows.iter().map(|row| row.name.chars().count()))
        .max()
        .unwrap_or(0)
        + 2;
    let mut text = String::new();
    if let Some(ago) = &workspace.fetched_ago {
        text.push_str(&format!("Remote branches fetched {ago}.\n\n"));
    }
    for (index, (title, rows)) in groups.iter().enumerate() {
        if index > 0 {
            text.push('\n');
        }
        text.push_str(&output::style(Style::Bold, title));
        text.push('\n');
        for row in rows {
            let padding = " ".repeat(width - row.name.chars().count());
            let waits = match row.waits {
                "you" => output::style(Style::Bold, "you"),
                "agent" => output::style(Style::Dim, "agent"),
                other => other.to_string(),
            };
            let waits_padding = " ".repeat(7 - row.waits.len());
            text.push_str(&format!(
                "  {}{padding}{waits}{waits_padding}{}\n",
                row.name, row.step
            ));
        }
    }
    if groups.is_empty() {
        text.push_str("Nothing in PRIORITIES.md, and no feature started.\n");
    }
    text
}

#[cfg(test)]
mod tests {
    use uraeda_core::steps::PullRequest;
    use uraeda_core::workspace::{Feature, Kind};

    use super::describe;

    const RECORD: &str = "---\nkind: feature\nfinished: 2026-10-11\n---\n\n# Record: X\n";

    #[test]
    fn what_finishing_has_left() {
        let rows = [
            (PullRequest::NoPullRequest, "finish: open the pull request"),
            (PullRequest::Draft, "finish: mark the pull request ready"),
        ];
        for (pull_request, expected) in rows {
            let mut feature = Feature::from_record(Kind::Feature, "2026-10-10-x", RECORD.into());

            feature.with_pull_request(pull_request);

            assert_eq!(describe(&feature), expected);
        }
    }
}
