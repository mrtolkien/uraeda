//! What a session runs on, the one rule every start path shares: the agent, the model, and the
//! effort picked where it starts, each by the agent's id, or none for the default. And the run
//! options as a run reads them: the workflow's six steps, each on its pick, and the joints
//! between two steps, where a clean session starts.

use std::path::Path;
use std::sync::Arc;

use uraeda_core::settings::{RunOptions, RunPick, STEPS};
use uraeda_protocol::SessionPick;

use super::manager::{Runner, refusals};
use super::message::effort_name;
use super::session::Session;
use crate::live::Fault;
use crate::records::features::run_options;
use crate::runtimes::Runtime;

/// What a new session stores: its runtime's name, and its model and effort, none for the
/// agent's.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Picked {
    pub agent: String,
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// What a step or a role runs on: a model or an effort left out is the agent's own default.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct StepPick {
    pub runtime: String,
    pub model: Option<String>,
    pub effort: Option<String>,
}

/// A reviewer: an agent on its pick, through the agent's own review, or a command.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Reviewer {
    Agent {
        pick: StepPick,
        instructions: Option<String>,
    },
    Command(String),
}

/// A feature's or the settings' run options, as a run reads them.
pub(crate) struct Map {
    /// Each step's pick, in the workflow's order.
    pub steps: Vec<(&'static str, StepPick)>,
    /// The joints, by the index of the step after them, where the human starts a clean
    /// session.
    pub cuts: Vec<usize>,
    pub implementers: StepPick,
    pub reviewers: Vec<Reviewer>,
    /// Whether reviews run on the branch only, not after each wave.
    pub branch_only: bool,
}

impl Map {
    /// A step's pick.
    pub(crate) fn step(&self, step: &str) -> Option<&StepPick> {
        let found = self.steps.iter().find(|(name, _)| *name == step);
        found.map(|(_, pick)| pick)
    }
}

/// A stored pick, on `fallback` when it names no agent.
fn pick_of(
    agent: Option<&String>,
    model: Option<&String>,
    effort: Option<&String>,
    fallback: &str,
) -> StepPick {
    StepPick {
        runtime: agent.cloned().unwrap_or_else(|| fallback.to_owned()),
        model: model.cloned(),
        effort: effort.cloned(),
    }
}

fn role_pick(stored: Option<&RunPick>, fallback: &str) -> StepPick {
    let field = |of: fn(&RunPick) -> &Option<String>| stored.and_then(|pick| of(pick).as_ref());
    pick_of(
        field(|pick| &pick.agent),
        field(|pick| &pick.model),
        field(|pick| &pick.effort),
        fallback,
    )
}

/// Stored options as a run reads them, a step naming no agent on `fallback`: the plan starts a
/// clean session when unset, the implementers are by default on the build's agent, on that
/// agent's defaults, and no reviewers is one agent reviewer on the review step's agent.
pub(crate) fn to_map(options: &RunOptions, fallback: &str) -> Map {
    let stored = |step: &str| options.steps.iter().find(|each| each.step == step);
    let steps: Vec<(&'static str, StepPick)> = STEPS
        .iter()
        .map(|step| {
            let of = stored(step);
            let pick = pick_of(
                of.and_then(|of| of.agent.as_ref()),
                of.and_then(|of| of.model.as_ref()),
                of.and_then(|of| of.effort.as_ref()),
                fallback,
            );
            (*step, pick)
        })
        .collect();
    let cuts = STEPS.iter().enumerate().skip(1).filter(|(_, step)| {
        let set = stored(step).and_then(|of| of.new_session);
        set.unwrap_or(**step == "plan")
    });
    let cuts = cuts.map(|(index, _)| index).collect();
    let runtime_of = |step: &str| {
        let pick = steps.iter().find(|(name, _)| *name == step);
        pick.map_or_else(|| fallback.to_owned(), |(_, pick)| pick.runtime.clone())
    };
    let (build, review) = (runtime_of("build"), runtime_of("review"));
    let reviewers = match options.reviewers.as_deref() {
        None | Some([]) => vec![Reviewer::Agent {
            pick: pick_of(None, None, None, &review),
            instructions: None,
        }],
        Some(reviewers) => reviewers
            .iter()
            .map(|each| match &each.command {
                Some(command) => Reviewer::Command(command.clone()),
                None => Reviewer::Agent {
                    pick: pick_of(
                        each.agent.as_ref(),
                        each.model.as_ref(),
                        each.effort.as_ref(),
                        &review,
                    ),
                    instructions: each.instructions.clone(),
                },
            })
            .collect(),
    };
    Map {
        cuts,
        implementers: role_pick(options.implementers.as_ref(), &build),
        reviewers,
        branch_only: options.review_depth.as_deref() == Some("branch"),
        steps,
    }
}

/// Whether `step` is one of the run steps, as the core names them.
pub(crate) fn is_step(step: &str) -> bool {
    STEPS.contains(&step)
}

impl Runner {
    /// The runtime a pick runs on: the one chosen while it is registered and on in the
    /// repository, else the first one on there.
    pub(super) fn runtime_for(&self, root: &str, chosen: Option<&str>) -> Option<String> {
        let runtimes = self.runtimes();
        let repository = self.name_of(root);
        let on = |name: &str| {
            runtimes.get(name).is_some() && runtimes.is_on(name, repository.as_deref())
        };
        match chosen.filter(|chosen| on(chosen)) {
            Some(chosen) => Some(chosen.to_owned()),
            None => runtimes.on_in(repository.as_deref()).into_iter().next(),
        }
    }

    /// The model a pick runs on, defaults resolved: its own, else the one its runtime's last
    /// list says it runs when none is picked.
    fn model_of(&self, root: &str, pick: &StepPick) -> (Option<String>, Option<String>) {
        let runtime = self.runtime_for(root, Some(&pick.runtime));
        let listed = runtime
            .as_deref()
            .and_then(|runtime| self.runtimes().models(runtime));
        let model = pick.model.clone().or_else(|| listed?.defaults.model);
        (runtime, model)
    }

    /// Whether two picks run on the same agent and model, defaults resolved.
    pub(super) fn same_pick(&self, root: &str, one: &StepPick, other: &StepPick) -> bool {
        self.model_of(root, one) == self.model_of(root, other)
    }

    /// Whether the joint before the step at `index` cuts: by the human's choice, or forced, as
    /// its two steps run on different agents or models.
    fn joint_cuts(&self, root: &str, map: &Map, index: usize) -> bool {
        let (before, after) = (&map.steps[index - 1].1, &map.steps[index].1);
        map.cuts.contains(&index) || !self.same_pick(root, before, after)
    }

    /// Whether a run of `to` goes to the session that ran `from`: both steps in one span,
    /// `from` not after `to`, so a step's own runs share its session.
    pub(super) fn step_session(&self, root: &str, map: &Map, from: &str, to: &str) -> bool {
        let at = |step: &str| STEPS.iter().position(|each| *each == step);
        let (Some(first), Some(last)) = (at(from), at(to)) else {
            return false;
        };
        first <= last && (first + 1..=last).all(|index| !self.joint_cuts(root, map, index))
    }

    /// The run options a feature's next run starts on: its own over the settings', as they are
    /// now.
    pub(super) fn run_options(&self, root: &str, folder: &str) -> RunOptions {
        run_options(&self.shared, Path::new(root), folder)
    }

    /// The pick a step runs on: its own while its agent is on in the repository, else the
    /// first runtime on there, on that runtime's defaults. Refused when none is on.
    fn running_pick(&self, root: &str, pick: &StepPick) -> Result<StepPick, Fault> {
        let runtimes = self.runtimes();
        let repository = self.name_of(root);
        if runtimes.get(&pick.runtime).is_some()
            && runtimes.is_on(&pick.runtime, repository.as_deref())
        {
            return Ok(pick.clone());
        }
        let first = runtimes.on_in(repository.as_deref()).into_iter().next();
        let runtime = first.ok_or_else(|| Fault::refused(refusals::NO_RUNTIME))?;
        Ok(StepPick {
            runtime,
            model: None,
            effort: None,
        })
    }

    /// A runtime's name for people, which its refusals name it by: its extension's title once
    /// it is unregistered.
    pub(crate) fn runtime_name(&self, agent: &str) -> String {
        let runtimes = self.runtimes();
        match runtimes.get(agent) {
            Some(runtime) => runtime.name(),
            None => runtimes.title(agent),
        }
    }

    /// Refuses an effort the session's model, picked or the agent's default, does not take, by
    /// the runtime's last list. The default effort, and a model the list does not hold, are
    /// not checked: the agent answers for those.
    pub(crate) fn check_effort(
        &self,
        agent: &str,
        model: Option<&str>,
        effort: Option<&str>,
    ) -> Result<(), Fault> {
        let Some(list) = self.runtimes().models(agent) else {
            return Ok(());
        };
        let id = model.or(list.defaults.model.as_deref());
        let known = list.models.iter().find(|one| Some(one.id.as_str()) == id);
        let (Some(effort), Some(known)) = (effort, known) else {
            return Ok(());
        };
        if known.efforts.iter().any(|one| one.id == effort) {
            return Ok(());
        }
        let refusal = refusals::no_effort(&known.name, effort_name(effort));
        Err(Fault::refused(refusal))
    }

    /// Refuses a message to the runtime of a name while it is not available: at its last
    /// check, its version was missing.
    pub(crate) fn check_available(&self, agent: &str) -> Result<(), Fault> {
        match self.runtimes().status(agent).available {
            true => Ok(()),
            false => {
                let name = self.runtimes().get(agent).map(|runtime| runtime.name());
                let name = name.unwrap_or_else(|| agent.to_owned());
                Err(Fault::refused(refusals::unavailable(&name)))
            }
        }
    }

    /// What a new session of a step, a run step or a role, stores: its pick, refused for a
    /// model its agent's last list no longer holds, or an effort the model does not take.
    /// Without a list, the agent answers for the model. A session made for a run is refused
    /// too while its agent is not available.
    fn new_picked(&self, step: &str, pick: &StepPick, available: bool) -> Result<Picked, Fault> {
        let runtimes = self.runtimes();
        if let (Some(model), Some(list)) = (&pick.model, runtimes.models(&pick.runtime))
            && !list.models.iter().any(|one| one.id == *model)
        {
            let agent = self.runtime_name(&pick.runtime);
            let mut name = step.to_owned();
            if let Some(first) = name.get_mut(..1) {
                first.make_ascii_uppercase();
            }
            return Err(Fault::refused(refusals::step_model_gone(
                &name, model, &agent,
            )));
        }
        self.check_effort(&pick.runtime, pick.model.as_deref(), pick.effort.as_deref())?;
        if available {
            self.check_available(&pick.runtime)?;
        }
        Ok(Picked {
            agent: pick.runtime.clone(),
            model: pick.model.clone(),
            effort: pick.effort.clone(),
        })
    }

    /// What a session of a feature made for a run of `run_step` runs on: the step's pick from
    /// the feature's resolved options, its agent the first runtime on when its own is off.
    /// None at a step no agent runs, or with no runtime on.
    pub(crate) fn step_pick(
        &self,
        root: &str,
        folder: &str,
        run_step: Option<&str>,
    ) -> Option<StepPick> {
        let fallback = self.runtime_for(root, None)?;
        let run_step = run_step.filter(|step| is_step(step))?;
        let map = to_map(&self.run_options(root, folder), &fallback);
        self.running_pick(root, map.step(run_step)?).ok()
    }

    /// What a new session of the main checkout `root` runs on: the agent picked, else the
    /// first one on there; the model and effort picked, else the agent's defaults. Refused for
    /// an agent off there, a model its last list does not hold, none without a list, and an
    /// effort the model does not take.
    pub(crate) fn new_session_pick(&self, root: &str, pick: &SessionPick) -> Result<Picked, Fault> {
        let agent = self.new_session_runtime(root, pick.runtime.as_deref())?;
        if let Some(model) = &pick.model {
            let list = self.runtimes().models(&agent);
            let listed = list.is_some_and(|list| list.models.iter().any(|one| one.id == *model));
            if !listed {
                let refusal = refusals::no_model(&self.runtime_name(&agent), model);
                return Err(Fault::refused(refusal));
            }
        }
        self.check_effort(&agent, pick.model.as_deref(), pick.effort.as_deref())?;
        Ok(Picked {
            agent,
            model: pick.model.clone(),
            effort: pick.effort.clone(),
        })
    }

    /// The name of the runtime a new session of the repository runs on: `chosen`, else the
    /// first one on there. Refused when none is on, or `chosen` is off there.
    pub(crate) fn new_session_runtime(
        &self,
        root: &str,
        chosen: Option<&str>,
    ) -> Result<String, Fault> {
        let runtimes = self.runtimes();
        let repository = self.name_of(root);
        if let Some(chosen) = chosen {
            let on =
                runtimes.get(chosen).is_some() && runtimes.is_on(chosen, repository.as_deref());
            return match on {
                true => Ok(chosen.to_owned()),
                false => Err(Fault::refused(refusals::runtime_off(
                    &runtimes.title(chosen),
                ))),
            };
        }
        let first = runtimes.on_in(repository.as_deref()).into_iter().next();
        first.ok_or_else(|| Fault::refused(refusals::NO_RUNTIME))
    }

    /// What a new session of a feature runs on: `pick`, the human's, when it picks anything;
    /// else the pick of the run step its next step belongs to, as a run of that step starts
    /// on; else, at a step no agent runs, as a gate, the agent's defaults. A folder that
    /// cannot be read yet, as one whose start is still in the write queue, takes the run step
    /// its start begins with, `starting`.
    pub(crate) fn new_pick(
        &self,
        root: &str,
        folder: &str,
        pick: &SessionPick,
        starting: Option<&str>,
    ) -> Result<Picked, Fault> {
        if pick.runtime.is_some() || pick.model.is_some() || pick.effort.is_some() {
            return self.new_session_pick(root, pick);
        }
        let next = uraeda_core::api::next_step(Path::new(root), folder).ok();
        let run_step = next.and_then(|next| next.step.run_step);
        let run_step = run_step.as_deref().or(starting);
        match (run_step, self.step_pick(root, folder, run_step)) {
            // Made before it runs, as any session: the send checks its agent is available.
            (Some(step), Some(step_pick)) => self.new_picked(step, &step_pick, false),
            _ => self.new_session_pick(root, pick),
        }
    }

    /// What a new implementer of a feature runs on: the feature's implementers' pick, the
    /// build's agent on its defaults when unset, refused as a run's new session is. Its agent
    /// off runs it on the first runtime on, on that runtime's defaults.
    pub(super) fn implementer_pick(&self, root: &str, folder: &str) -> Result<Picked, Fault> {
        let none = || Fault::refused(refusals::NO_RUNTIME);
        let fallback = self.runtime_for(root, None).ok_or_else(none)?;
        let map = to_map(&self.run_options(root, folder), &fallback);
        let pick = self.running_pick(root, &map.implementers)?;
        self.new_picked("implementer", &pick, true)
    }

    /// What an agent reviewer of a repository runs on: its pick, refused as a new session of a
    /// role is, and never on another agent: its agent off there, gone, or not available is
    /// refused as not available on this machine.
    pub(super) fn reviewer_pick(&self, root: &str, pick: &StepPick) -> Result<Picked, Fault> {
        let runtimes = self.runtimes();
        let repository = self.name_of(root);
        let on = runtimes.get(&pick.runtime).is_some()
            && runtimes.is_on(&pick.runtime, repository.as_deref());
        if !on {
            let name = self.runtime_name(&pick.runtime);
            return Err(Fault::refused(refusals::unavailable(&name)));
        }
        self.new_picked("reviewer", pick, true)
    }

    /// What a run of a step picks, from a feature's options: for the run that goes to a
    /// session, and a new session of it.
    pub(super) fn run_pick(
        &self,
        root: &str,
        folder: &str,
        run_step: &str,
        agent: &str,
    ) -> Result<(Map, StepPick), Fault> {
        let fallback = self.runtime_for(root, None);
        let fallback = fallback.unwrap_or_else(|| agent.to_owned());
        let map = to_map(&self.run_options(root, folder), &fallback);
        let none = || Fault::internal(format!("{run_step} is no run step"));
        let pick = self.running_pick(root, map.step(run_step).ok_or_else(none)?)?;
        Ok((map, pick))
    }

    /// A new session of a step, as a run that cuts makes one: refused as `new_picked` says.
    pub(super) fn step_picked(&self, step: &str, pick: &StepPick) -> Result<Picked, Fault> {
        self.new_picked(step, pick, true)
    }
}

/// The runtime a session runs on, by its stored `agent`: refused while it is unregistered, or
/// off in the session's repository.
pub(crate) fn session_runtime(runner: &Runner, row: &Session) -> Result<Arc<dyn Runtime>, Fault> {
    let runtimes = runner.runtimes();
    let repository = runner.name_of(&row.repo);
    let runtime = runtimes.get(&row.agent);
    let on = runtimes.is_on(&row.agent, repository.as_deref());
    runtime
        .filter(|_| on)
        .ok_or_else(|| Fault::refused(refusals::runtime_off(&runtimes.title(&row.agent))))
}

/// The session's runtime, once it is on in its repository, and available: else refused.
pub(crate) fn ready(runner: &Runner, row: &Session) -> Result<Arc<dyn Runtime>, Fault> {
    let runtime = session_runtime(runner, row)?;
    runner.check_available(&row.agent)?;
    Ok(runtime)
}

/// Whether a session's runtime is registered, on in its repository, and available.
pub(crate) fn runs_on(runner: &Runner, row: &Session) -> bool {
    ready(runner, row).is_ok()
}

/// The runtime a message to `session` goes to, or without one to a new session of the main
/// checkout `root`, on `chosen` or the first one on there: refused while it is off there,
/// unregistered, or not available.
pub(crate) fn message_runtime(
    runner: &Runner,
    root: &str,
    session: Option<&Session>,
    chosen: Option<&str>,
) -> Result<Arc<dyn Runtime>, Fault> {
    if let Some(session) = session {
        return ready(runner, session);
    }
    let name = runner.new_session_runtime(root, chosen)?;
    runner.check_available(&name)?;
    let gone = || Fault::refused(refusals::runtime_off(&name));
    runner.runtimes().get(&name).ok_or_else(gone)
}
