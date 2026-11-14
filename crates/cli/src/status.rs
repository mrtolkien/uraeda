//! `ura status`: where every feature and change stands, and who it waits on.

use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::api::{SetupItem, read_setup};
use uraeda_core::steps::{PullRequest, StepName, WaitsOn};
use uraeda_core::workspace::{Feature, Workspace, first_file, folder_branch};

use crate::output::{self, Style};

/// The JSON of `ura status`: the workspace, with the setup's items beside its fields.
#[derive(Serialize)]
struct Status<'a> {
    #[serde(flatten)]
    workspace: &'a Workspace,
    setup: Vec<SetupItem>,
}

pub fn run(json: bool) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace_with_pull_requests()?;
    let setup = read_setup(git.root()).map_err(|error| error.to_string())?;
    if json {
        output::print_json(&Status {
            workspace: &workspace,
            setup,
        });
    } else {
        print!("{}{}", render(&workspace), render_setup(&setup));
    }
    Ok(ExitCode::SUCCESS)
}

/// The required setup files not written yet, after a blank line, or nothing once the project is
/// set up: the optional ones never show.
fn render_setup(setup: &[SetupItem]) -> String {
    let missing: Vec<&SetupItem> = setup
        .iter()
        .filter(|item| item.required && item.state != "written")
        .collect();
    if missing.is_empty() {
        return String::new();
    }
    let count = match missing.len() {
        1 => "1 file missing".to_string(),
        n => format!("{n} files missing"),
    };
    let mut text = format!(
        "\n{}\n",
        output::style(Style::Bold, &format!("Setup: {count}"))
    );
    for item in missing {
        let state = if item.state == "template" {
            "still the template"
        } else {
            "missing"
        };
        text.push_str(&format!("  {}: {state}\n", item.name));
    }
    text
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

/// What a merged feature left behind, in words: its worktree and its branch.
pub fn leftovers(feature: &Feature) -> Option<String> {
    let left: Vec<&str> = [
        (feature.left_worktree.is_some(), "worktree"),
        (feature.left_branch.is_some(), "branch"),
    ]
    .into_iter()
    .filter_map(|(left, what)| left.then_some(what))
    .collect();
    match left.as_slice() {
        [] => None,
        [one] => Some((*one).to_string()),
        [first, second] => Some(format!("{first} and {second}")),
        _ => None,
    }
}

/// What a feature waits for, in words.
pub fn describe(feature: &Feature) -> String {
    described(feature, leftovers(feature).as_deref())
}

/// What a feature waits for, in words, `left` what it left once merged (see [`leftovers`]).
fn described(feature: &Feature, left: Option<&str>) -> String {
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
        (StepName::Done, _) => match left {
            Some(left) => format!("merged: its {left} left"),
            None => "merged".to_string(),
        },
        (name, _) => match &step.task {
            Some(task) => format!("{}, {task}", name.as_str()),
            None => name.as_str().to_string(),
        },
    };
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

fn render(workspace: &Workspace) -> String {
    let done = |feature: &&Feature| feature.step.name == StepName::Done;
    let mut groups: Vec<(&str, Vec<Row>)> = Vec::new();
    let working: Vec<Row> = workspace
        .features
        .iter()
        .filter(|feature| !done(feature))
        .map(feature_row)
        .collect();
    if !working.is_empty() {
        groups.push(("In progress", working));
    }
    let merged: Vec<Row> = workspace
        .features
        .iter()
        .filter(|feature| done(feature) && leftovers(feature).is_some())
        .map(feature_row)
        .collect();
    if !merged.is_empty() {
        groups.push(("Merged, with a worktree or a branch left", merged));
    }

    let width = groups
        .iter()
        .flat_map(|(_, rows)| rows.iter().map(|row| row.name.chars().count()))
        .max()
        .unwrap_or(0)
        + 2;
    let mut text = String::new();
    if let Some(ago) = workspace.fetched_ago() {
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
        text.push_str("No feature or change in progress.\n");
    }
    text
}

#[cfg(test)]
mod tests {
    use uraeda_core::steps::PullRequest;
    use uraeda_core::workspace::{Feature, Kind};

    use super::described;

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

            assert_eq!(described(&feature, None), expected);
        }
    }
}
