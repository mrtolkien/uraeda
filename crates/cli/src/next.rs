//! `ura next`: the feature an agent works on next, its step from the skill's tables, the step's
//! pick and session from the human's settings, and whether the human's work is committed first.

use std::process::ExitCode;

use serde::Serialize;
use uraeda_core::settings::{self, ReviewerOptions, RunOptions, RunPick};
use uraeda_core::steps::{self, Step, StepName, WaitsOn};
use uraeda_core::target::{Purpose, Target};
use uraeda_core::workspace::Feature;

use crate::output;
use crate::status;

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct Next<'a> {
    feature: Option<&'a str>,
    branch: Option<&'a str>,
    step: Step,
    /// What the step runs on, and whether it starts a new session: none at a gate.
    run: Option<Run>,
}

/// A pick: an agent, a model, and an effort, each unset when the session's own is taken.
#[derive(Serialize, Default, Clone)]
struct Pick {
    agent: Option<String>,
    model: Option<String>,
    effort: Option<String>,
}

impl From<&RunPick> for Pick {
    fn from(pick: &RunPick) -> Pick {
        Pick {
            agent: pick.agent.clone(),
            model: pick.model.clone(),
            effort: pick.effort.clone(),
        }
    }
}

impl From<&ReviewerOptions> for Pick {
    fn from(reviewer: &ReviewerOptions) -> Pick {
        Pick {
            agent: reviewer.agent.clone().or_else(|| reviewer.command.clone()),
            model: reviewer.model.clone(),
            effort: reviewer.effort.clone(),
        }
    }
}

/// How the step runs, from the settings.
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
struct Run {
    /// The settings' step: `discovery`, `spec`, `plan`, `build`, `review`, or `comments`.
    setting: &'static str,
    pick: Pick,
    /// `join` to run on in the session that ran the previous step, `new` to start one.
    session: &'static str,
    /// For the build: the implementers', and the reviewers' in their order.
    implementers: Option<Pick>,
    reviewers: Option<Vec<Pick>>,
    /// For the build: `waves`, each wave and the branch, or `branch` only.
    review_depth: Option<String>,
}

pub fn run(target: Option<String>, json: bool) -> Result<ExitCode, String> {
    let (_, workspace) = output::workspace_with_pull_requests()?;
    let index = match target {
        Some(target) => match output::target(&workspace, Some(&target), Purpose::Inspect)? {
            Target::Feature(index) | Target::File(index, _) => Some(index),
        },
        None => steps::next_target(&workspace),
    };
    let feature = index.map(|index| &workspace.features[index]);
    let options = settings::read(&settings::default_config_dir())
        .map(|read| read.runs)
        .map_err(|error| error.to_string())?;
    let run = feature.and_then(|feature| run_of(&feature.step, &options));
    if json {
        output::print_json(&Next {
            feature: feature.map(|f| f.folder.as_str()),
            branch: feature.and_then(|f| f.branch.as_deref()),
            step: feature.map_or_else(Step::none, |f| f.step.clone()),
            run,
        });
    } else {
        print!("{}", render(feature, run.as_ref()));
    }
    Ok(ExitCode::SUCCESS)
}

/// The settings' step a step runs on: a change runs on the build's.
fn setting_of(step: StepName) -> Option<&'static str> {
    Some(match step {
        StepName::Proposal | StepName::Discovery | StepName::LostRound => "discovery",
        StepName::Spec | StepName::SpecRevision => "spec",
        StepName::Plan | StepName::PlanRevision => "plan",
        StepName::Implementation | StepName::Change => "build",
        StepName::FinalReview | StepName::Finish | StepName::PullRequestUnknown => "review",
        StepName::PullRequestChanges | StepName::Push | StepName::CatchUp => "comments",
        StepName::HumanGate | StepName::PullRequest | StepName::Done | StepName::None => {
            return None;
        }
    })
}

/// How a step runs: its pick, and its session, new where the human cut it from the previous step,
/// the plan's by default.
fn run_of(step: &Step, options: &RunOptions) -> Option<Run> {
    if step.waits_on != WaitsOn::Agent {
        return None;
    }
    let setting = setting_of(step.name)?;
    let set = options.steps.iter().find(|s| s.step == setting);
    let pick = set.map_or_else(Pick::default, |s| Pick {
        agent: s.agent.clone(),
        model: s.model.clone(),
        effort: s.effort.clone(),
    });
    let new = set.and_then(|s| s.new_session).unwrap_or(setting == "plan");
    let build = setting == "build";
    Some(Run {
        setting,
        pick,
        session: if new { "new" } else { "join" },
        implementers: build.then(|| {
            options
                .implementers
                .as_ref()
                .map(Pick::from)
                .unwrap_or_default()
        }),
        reviewers: build.then(|| options.reviewers.iter().flatten().map(Pick::from).collect()),
        review_depth: build.then(|| {
            options
                .review_depth
                .clone()
                .unwrap_or_else(|| "waves".to_string())
        }),
    })
}

/// A pick in words: `claude, opus, high`, or `the session's own`.
fn shown(pick: &Pick) -> String {
    let parts: Vec<&str> = [&pick.agent, &pick.model, &pick.effort]
        .into_iter()
        .filter_map(|part| part.as_deref())
        .collect();
    if parts.is_empty() {
        "the session's own".to_string()
    } else {
        parts.join(", ")
    }
}

fn render(feature: Option<&Feature>, run: Option<&Run>) -> String {
    let Some(feature) = feature else {
        return "Nothing for an agent: every feature waits on you. Run ura status.\n".to_string();
    };
    let mut text = format!("{}: {}\n", status::name(feature), status::describe(feature));
    if let Some(branch) = &feature.branch {
        text.push_str(&format!("  branch     {branch}\n"));
    }
    if feature.step.commit_first {
        text.push_str(
            "  first      commit the human's work alone: skills/uraeda/SKILL.md#the-humans-work-is-committed-first\n",
        );
    }
    match (&feature.step.reference, feature.step.waits_on) {
        (Some(reference), WaitsOn::Agent) => {
            text.push_str(&format!("  follow     {reference}\n"));
        }
        (_, WaitsOn::Human) => text.push_str("  waits on   you\n"),
        _ => {}
    }
    if let Some(run) = run {
        text.push_str(&format!("  pick       {}\n", shown(&run.pick)));
        let session = match run.session {
            "new" => "new: end this session, naming the step and its pick",
            _ => "join: run it in this session",
        };
        text.push_str(&format!("  session    {session}\n"));
        if let Some(implementers) = &run.implementers {
            text.push_str(&format!("  builders   {}\n", shown(implementers)));
        }
        if let Some(reviewers) = &run.reviewers {
            let listed = if reviewers.is_empty() {
                "one, on the review step's pick".to_string()
            } else {
                reviewers.iter().map(shown).collect::<Vec<_>>().join("; ")
            };
            let depth = run.review_depth.as_deref().unwrap_or("waves");
            text.push_str(&format!("  reviewers  {listed} (depth: {depth})\n"));
        }
    }
    text
}
