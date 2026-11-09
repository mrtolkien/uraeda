//! The run options of `[runs]`: each step's agent, model, effort, and session, the build's
//! implementers, the reviewers, and the review's depth. Read, checked, and merged here, the only
//! home of their rules, and written by `runs_write` (see `specs/decisions/run-options.md`).

#[cfg(feature = "napi")]
use napi_derive::napi;
use toml_edit::{Item, Key, TableLike};

use super::file::{Problem, offset};
use super::refused;
use crate::api::ApiError;

/// The workflow's steps, in their order, each with its table under `[runs.steps]`.
pub const STEPS: [&str; 6] = ["discovery", "spec", "plan", "build", "review", "comments"];

/// The depths of the review: each wave and the branch, or the branch only.
const DEPTHS: [&str; 2] = ["waves", "branch"];

/// The run options a settings file or a feature holds, every value optional: what was picked,
/// nothing resolved.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RunOptions {
    /// The steps with an option set, in the workflow's order.
    pub steps: Vec<StepOptions>,
    /// The agent, model, and effort of the build's implementers.
    pub implementers: Option<RunPick>,
    /// The reviewers, in the order they run: one agent reviewer on the review step's pick when
    /// unset or empty.
    pub reviewers: Option<Vec<ReviewerOptions>>,
    /// `waves`, each wave and the branch, or `branch`: `waves` when unset.
    pub review_depth: Option<String>,
}

/// One step's options, a table `[runs.steps.<step>]`.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct StepOptions {
    /// The step: `discovery`, `spec`, `plan`, `build`, `review`, or `comments`.
    pub step: String,
    /// The agent's runtime, like `claude` or `codex`.
    pub agent: Option<String>,
    /// A model the agent lists.
    pub model: Option<String>,
    /// An effort the model takes.
    pub effort: Option<String>,
    /// Whether the step starts a clean session: `true` for `plan` when unset, ignored on
    /// `discovery`.
    pub new_session: Option<bool>,
}

/// An agent, a model, and an effort picked for a role, like the implementers'.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RunPick {
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// A reviewer, a table of `[[runs.reviewers]]`: an agent, or a command the human wrote.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ReviewerOptions {
    /// An agent reviewer's runtime; absent on a command reviewer.
    pub agent: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    /// Text added to the review's prompt.
    pub instructions: Option<String>,
    /// A command reviewer's shell command, run in the feature's worktree.
    pub command: Option<String>,
}

/// Refuses a step not of the workflow's, a step listed twice, a depth not `waves` or `branch`, and
/// a reviewer without exactly one of an agent and a command, or with an empty command.
pub fn check_run_options(options: &RunOptions) -> Result<(), ApiError> {
    for (index, step) in options.steps.iter().enumerate() {
        step_rule(&step.step).map_err(refused)?;
        if options.steps[..index]
            .iter()
            .any(|before| before.step == step.step)
        {
            return Err(refused(format!(
                "The {}'s options are set twice.",
                step.step
            )));
        }
    }
    if let Some(depth) = &options.review_depth {
        depth_rule(depth).map_err(refused)?;
    }
    for reviewer in options.reviewers.iter().flatten() {
        reviewer_rule(reviewer).map_err(refused)?;
    }
    Ok(())
}

/// `feature`'s options over `defaults`: each value the feature sets wins, step by step and value by
/// value, and the feature's reviewers, when it lists any, replace the defaults' list whole.
pub fn merge_run_options(defaults: &RunOptions, feature: &RunOptions) -> RunOptions {
    let mut steps = defaults.steps.clone();
    for step in &feature.steps {
        match steps.iter_mut().find(|default| default.step == step.step) {
            Some(default) => {
                default.agent = over(&step.agent, &default.agent);
                default.model = over(&step.model, &default.model);
                default.effort = over(&step.effort, &default.effort);
                default.new_session = step.new_session.or(default.new_session);
            }
            None => steps.push(step.clone()),
        }
    }
    in_order(&mut steps);
    let implementers = match (&defaults.implementers, &feature.implementers) {
        (Some(default), Some(picked)) => Some(RunPick {
            agent: over(&picked.agent, &default.agent),
            model: over(&picked.model, &default.model),
            effort: over(&picked.effort, &default.effort),
        }),
        (default, picked) => over(picked, default),
    };
    RunOptions {
        steps,
        implementers,
        reviewers: over(
            &feature.reviewers.clone().filter(|list| !list.is_empty()),
            &defaults.reviewers,
        ),
        review_depth: over(&feature.review_depth, &defaults.review_depth),
    }
}

/// The value picked, else the default.
fn over<T: Clone>(picked: &Option<T>, default: &Option<T>) -> Option<T> {
    picked.clone().or_else(|| default.clone())
}

/// Sorts steps in the workflow's order, a step not of it last.
fn in_order(steps: &mut [StepOptions]) {
    steps.sort_by_key(|step| {
        STEPS
            .iter()
            .position(|name| *name == step.step)
            .unwrap_or(STEPS.len())
    });
}

fn step_rule(step: &str) -> Result<(), String> {
    if STEPS.contains(&step) {
        return Ok(());
    }
    Err(format!(
        "{step} is not a step: discovery, spec, plan, build, review, or comments."
    ))
}

fn depth_rule(depth: &str) -> Result<(), String> {
    if DEPTHS.contains(&depth) {
        return Ok(());
    }
    Err(format!("{depth} is not a review depth: waves or branch."))
}

fn reviewer_rule(reviewer: &ReviewerOptions) -> Result<(), String> {
    match (&reviewer.agent, &reviewer.command) {
        (Some(_), Some(_)) => Err("A reviewer runs an agent or a command, not both.".into()),
        (None, None) => Err("A reviewer runs an agent or a command.".into()),
        (None, Some(command)) if command.trim().is_empty() => {
            Err("A reviewer's command is empty.".into())
        }
        _ => Ok(()),
    }
}

/// The run options of the `[runs]` table, each problem at its key, like
/// `runs.steps.spec.effort`. `fresh` is the old `build_in_fresh_session`: `false` joins the plan
/// to the spec's session, unless the plan's table sets `new_session`.
pub(super) fn parse(runs: &dyn TableLike, fresh: Option<bool>) -> Result<RunOptions, Problem> {
    let mut options = RunOptions::default();
    if let Some((key, item)) = runs.get_key_value("review_depth") {
        let at = |problem: String| (offset(key, item), "runs.review_depth".to_owned(), problem);
        let depth = item
            .as_str()
            .ok_or_else(|| at("The review depth is waves or branch.".into()))?;
        depth_rule(depth).map_err(at)?;
        options.review_depth = Some(depth.to_owned());
    }
    if let Some((key, item)) = runs.get_key_value("steps") {
        options.steps = parse_steps(key, item)?;
    }
    if fresh == Some(false) {
        match options.steps.iter_mut().find(|step| step.step == "plan") {
            Some(plan) => plan.new_session = plan.new_session.or(Some(false)),
            None => options.steps.push(StepOptions {
                step: "plan".into(),
                new_session: Some(false),
                ..StepOptions::default()
            }),
        }
        in_order(&mut options.steps);
    }
    if let Some((key, item)) = runs.get_key_value("implementers") {
        const AT: &str = "runs.implementers";
        let table = options_table(key, item, AT)?;
        let pick = RunPick {
            agent: name(table, AT, "agent", "The agent is a name.")?,
            model: name(table, AT, "model", "The model is a name.")?,
            effort: name(table, AT, "effort", "The effort is a name.")?,
        };
        options.implementers = (pick != RunPick::default()).then_some(pick);
    }
    if let Some((key, item)) = runs.get_key_value("reviewers") {
        options.reviewers = Some(parse_reviewers(key, item)?);
    }
    Ok(options)
}

/// The steps of `[runs.steps]`, in the workflow's order, a step's table without a value left out.
fn parse_steps(key: &Key, item: &Item) -> Result<Vec<StepOptions>, Problem> {
    let steps = item.as_table_like().ok_or_else(|| {
        (
            offset(key, item),
            "runs.steps".to_owned(),
            "[runs.steps] is a table of steps.".to_owned(),
        )
    })?;
    let mut read = Vec::new();
    for (name_of_step, _) in steps.iter() {
        let Some((key, item)) = steps.get_key_value(name_of_step) else {
            continue;
        };
        let at = format!("runs.steps.{name_of_step}");
        step_rule(name_of_step).map_err(|problem| (offset(key, item), at.clone(), problem))?;
        let table = options_table(key, item, &at)?;
        let step = StepOptions {
            step: name_of_step.to_owned(),
            agent: name(table, &at, "agent", "The agent is a name.")?,
            model: name(table, &at, "model", "The model is a name.")?,
            effort: name(table, &at, "effort", "The effort is a name.")?,
            new_session: table
                .get_key_value("new_session")
                .map(|(key, item)| {
                    item.as_bool().ok_or_else(|| {
                        (
                            offset(key, item),
                            format!("{at}.new_session"),
                            "Starting a new session is true or false.".to_owned(),
                        )
                    })
                })
                .transpose()?,
        };
        let empty = StepOptions {
            step: step.step.clone(),
            ..StepOptions::default()
        };
        if step != empty {
            read.push(step);
        }
    }
    in_order(&mut read);
    Ok(read)
}

/// The reviewers of `[[runs.reviewers]]`, or of a list of inline tables.
fn parse_reviewers(key: &Key, item: &Item) -> Result<Vec<ReviewerOptions>, Problem> {
    const AT: &str = "runs.reviewers";
    let not_tables = |start: Option<usize>| {
        (
            start,
            AT.to_owned(),
            "The reviewers are tables, each under [[runs.reviewers]].".to_owned(),
        )
    };
    let tables: Vec<(&dyn TableLike, Option<usize>)> =
        if let Some(tables) = item.as_array_of_tables() {
            tables
                .iter()
                .map(|table| {
                    let start = table.span().map(|span| span.start);
                    (table as &dyn TableLike, start.or_else(|| offset(key, item)))
                })
                .collect()
        } else if let Some(values) = item.as_array() {
            values
                .iter()
                .map(|value| {
                    let start = value.span().map(|span| span.start);
                    value
                        .as_inline_table()
                        .map(|table| (table as &dyn TableLike, start))
                        .ok_or_else(|| not_tables(start.or_else(|| offset(key, item))))
                })
                .collect::<Result<_, _>>()?
        } else {
            return Err(not_tables(offset(key, item)));
        };
    tables
        .into_iter()
        .map(|(table, start)| {
            let reviewer = ReviewerOptions {
                agent: name(table, AT, "agent", "The agent is a name.")?,
                model: name(table, AT, "model", "The model is a name.")?,
                effort: name(table, AT, "effort", "The effort is a name.")?,
                instructions: name(table, AT, "instructions", "The instructions are text.")?,
                command: name(table, AT, "command", "The command is text.")?,
            };
            reviewer_rule(&reviewer).map_err(|problem| (start, AT.to_owned(), problem))?;
            Ok(reviewer)
        })
        .collect()
}

/// The table of options at `key`, or the problem that it is not one.
fn options_table<'a>(key: &Key, item: &'a Item, at: &str) -> Result<&'a dyn TableLike, Problem> {
    item.as_table_like().ok_or_else(|| {
        (
            offset(key, item),
            at.to_owned(),
            format!("[{at}] is a table of options."),
        )
    })
}

/// The text of `field` in `table`, `None` when absent, or `problem` at `at.field` when it is not
/// text.
fn name(
    table: &dyn TableLike,
    at: &str,
    field: &str,
    problem: &str,
) -> Result<Option<String>, Problem> {
    table
        .get_key_value(field)
        .map(|(key, item)| {
            item.as_str().map(str::to_owned).ok_or_else(|| {
                (
                    offset(key, item),
                    format!("{at}.{field}"),
                    problem.to_owned(),
                )
            })
        })
        .transpose()
}
