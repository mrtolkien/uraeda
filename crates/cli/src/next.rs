//! `ura next`: the feature an agent works on next, and its step, from the skill's tables.

use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::steps::{self, Step, WaitsOn};
use uraeda_core::workspace::{Feature, Workspace};

use crate::output;
use crate::status;

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct Next<'a> {
    feature: Option<&'a str>,
    branch: Option<&'a str>,
    step: Step,
}

pub fn run(target: Option<String>, json: bool) -> Result<ExitCode, String> {
    let (_, mut workspace) = output::workspace()?;
    let index = match target {
        Some(target) => {
            let index = find(&workspace, &target)?;
            steps::refresh_pull_request(&mut workspace.features[index], steps::pull_request);
            Some(index)
        }
        None => steps::next_target(&mut workspace, steps::pull_request),
    };
    let feature = index.map(|index| &workspace.features[index]);
    if json {
        output::print_json(&Next {
            feature: feature.map(|f| f.folder.as_str()),
            branch: feature.and_then(|f| f.branch.as_deref()),
            step: feature.map_or_else(Step::none, |f| f.step.clone()),
        });
    } else {
        print!("{}", render(feature));
    }
    Ok(ExitCode::SUCCESS)
}

/// The feature a name or folder names. Task 6 replaces this with the shared target rules.
fn find(workspace: &Workspace, target: &str) -> Result<usize, String> {
    workspace
        .features
        .iter()
        .position(|f| f.folder == target || f.slug == target)
        .ok_or_else(|| format!("no feature or bug named {target}"))
}

fn render(feature: Option<&Feature>) -> String {
    let Some(feature) = feature else {
        return "Nothing for an agent: every feature in Now waits on you. Run ura status.\n"
            .to_string();
    };
    let mut text = format!("{}: {}\n", status::name(feature), status::describe(feature));
    if let Some(branch) = &feature.branch {
        text.push_str(&format!("  branch     {branch}\n"));
    }
    match (&feature.step.reference, feature.step.waits_on) {
        (Some(reference), WaitsOn::Agent) => {
            text.push_str(&format!("  follow     {reference}\n"));
        }
        (_, WaitsOn::Human) => text.push_str("  waits on   you\n"),
        _ => {}
    }
    text
}
