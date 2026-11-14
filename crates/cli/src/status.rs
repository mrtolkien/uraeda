//! `ura status`: where every feature and change stands, and who it waits on.

use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::api::{SetupItem, read_setup};
use uraeda_core::files::frontmatter;
use uraeda_core::git::{Git, ObjectId};
use uraeda_core::repositories::default_data_dir;
use uraeda_core::settings::default_config_dir;
use uraeda_core::steps::{PullRequest, StepName, WaitsOn};
use uraeda_core::workspace::{Feature, Workspace, first_file, folder_branch};
use uraeda_vault::{Vault, notes};

use crate::output::{self, Style};

/// The JSON of `ura status`: the workspace, with the setup's items, and the proposal notes to
/// mark done, beside its fields.
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct Status<'a> {
    #[serde(flatten)]
    workspace: &'a Workspace,
    setup: Vec<SetupItem>,
    notes_done: Vec<String>,
}

pub fn run(json: bool) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace_with_pull_requests()?;
    let setup = read_setup(git.root()).map_err(|error| error.to_string())?;
    let notes_done = notes_done(&git);
    if json {
        output::print_json(&Status {
            workspace: &workspace,
            setup,
            notes_done,
        });
    } else {
        print!(
            "{}{}{}",
            render(&workspace),
            render_setup(&setup),
            render_notes_done(&notes_done)
        );
    }
    Ok(ExitCode::SUCCESS)
}

/// The proposal notes of this repository, in the human's notes, that say `started` while their
/// branch's record is on the default branch: an agent sets them `done`. None without a vault.
fn notes_done(git: &Git) -> Vec<String> {
    let Ok(vault) = Vault::locate(&default_config_dir(), &default_data_dir()) else {
        return Vec::new();
    };
    let main = git.main_root();
    let Some(repository) = main
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
    else {
        return Vec::new();
    };
    let folder = format!("projects/{repository}/proposals");
    let Some(default_tip) = git.default_branch().and_then(|branch| git.tip(&branch)) else {
        return Vec::new();
    };
    // A branch still in progress in a worktree, even with no commit of its own yet, is not merged.
    let working: Vec<String> = uraeda_core::workspace::in_progress(git)
        .into_iter()
        .map(|item| item.branch)
        .collect();
    let mut notes = Vec::new();
    let mut stack = vec![folder];
    while let Some(folder) = stack.pop() {
        for entry in notes::ls(&vault, &folder).unwrap_or_default() {
            let path = entry.path;
            if let Some(folder) = path.strip_suffix('/') {
                stack.push(folder.to_string());
                continue;
            }
            if !path.ends_with(".md") {
                continue;
            }
            let Ok(text) = notes::read(&vault, &path) else {
                continue;
            };
            let Ok(front) = frontmatter::parse(&text) else {
                continue;
            };
            if front.text("status") != Some("started") {
                continue;
            }
            let merged = front
                .text("branch")
                .filter(|branch| !working.iter().any(|working| working == branch))
                .and_then(|branch| git.tip(branch))
                .is_some_and(|tip| own_record_merged(git, tip, default_tip));
            if merged {
                notes.push(path);
            }
        }
    }
    notes.sort();
    notes
}

/// Whether a branch is merged: the default branch holds its tip, or, after a squash or a rebase,
/// the record the branch wrote, one its merge base with the default branch lacks.
fn own_record_merged(git: &Git, tip: ObjectId, default_tip: ObjectId) -> bool {
    let base = git.merge_base(tip, default_tip).ok().flatten();
    if base == Some(tip) {
        return true;
    }
    git.list_files(tip, "specs/done")
        .unwrap_or_default()
        .iter()
        .filter(|record| base.is_none_or(|base| git.entry_id(base, record).is_none()))
        .any(|record| git.entry_id(default_tip, record).is_some())
}

/// The proposal notes to mark done, after a blank line, or nothing.
fn render_notes_done(notes: &[String]) -> String {
    if notes.is_empty() {
        return String::new();
    }
    let mut text = format!(
        "\n{}\n",
        output::style(
            Style::Bold,
            "Proposal notes merged, still started: set them done"
        )
    );
    for note in notes {
        text.push_str(&format!("  ura vault write {note} --set status=done\n"));
    }
    text
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
        (StepName::Proposal, _) => "proposal: commit it".to_string(),
        (StepName::LostRound, _) => {
            "a round asked in a session and lost: ask it again, or write it as a file".to_string()
        }
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
    if step.commit_first {
        text.push_str(", after committing the human's work");
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
