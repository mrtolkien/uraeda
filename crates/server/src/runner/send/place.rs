//! Where a message goes: its feature's branch and step, whether a workflow message still
//! applies or runs as a chat, and the session a workflow run goes to.

use super::*;

/// Where a message goes: its feature's branch, and for the workflow's, the step its run
/// starts and that step's run step, or the line saying it runs as a chat. At `catch-up`,
/// `caught_up_to` is the default branch's commit it catches up with, read now.
#[derive(Default)]
pub(super) struct Place {
    pub(super) as_chat: Option<String>,
    pub(super) branch: Option<String>,
    pub(super) caught_up_to: Option<String>,
    pub(super) run_step: Option<String>,
    pub(super) step: Option<String>,
}

/// The fields a session takes once a workflow run is delivered to it, so a refused run changes
/// nothing.
#[derive(Clone, Default)]
pub(super) struct Fields {
    pub(super) effort: Option<Option<String>>,
    pub(super) step: Option<String>,
}

impl Fields {
    pub(in crate::runner) fn is_empty(&self) -> bool {
        self.effort.is_none() && self.step.is_none()
    }

    pub(in crate::runner) fn apply(&self, row: &mut Session) {
        if let Some(effort) = &self.effort {
            row.effort.clone_from(effort);
        }
        if let Some(step) = &self.step {
            row.step = Some(step.clone());
        }
    }
}

/// Why a workflow message sent now runs as a chat, the line its turn shows, or none when it
/// still applies: a comments message while the comments message is recommended; a message
/// read at a step while that step's is; a hand-over's, without a step, while the step waits on
/// the agent. The line says what holds now.
fn sent_as_chat(
    root: &Path,
    folder: &str,
    next: &NextView,
    workflow: &Run,
) -> Result<Option<&'static str>, Fault> {
    let comments = workflow.trigger == "comments";
    let mut feature = None;
    let applies = match (comments, &workflow.step) {
        (false, None) => next.step.waits_on == "agent",
        (comments, step) => {
            let read = feature.insert(api::read_feature(root, folder)?);
            let recommended = recommend(read, next, None);
            match comments {
                true => recommended.trigger == Some(Trigger::Comments),
                false => recommended.step.is_some() && recommended.step == *step,
            }
        }
    };
    if applies {
        return Ok(None);
    }
    if next.step.waits_on == "human" {
        return Ok(Some(SENT_AS_CHAT));
    }
    let feature = match feature {
        Some(feature) => feature,
        None => api::read_feature(root, folder)?,
    };
    Ok(Some(match comments && feature.pull_request.is_none() {
        true => SENT_AS_CHAT_NO_PULL_REQUEST,
        false => SENT_AS_CHAT_MOVED_ON,
    }))
}

/// Where a message goes: see [`Place`]. Refused once its feature is merged.
pub(super) fn send_place(
    root: &str,
    folder: Option<&str>,
    workflow: Option<&Run>,
) -> Result<Place, Fault> {
    let Some(folder) = folder else {
        return match workflow {
            Some(_) => Err(Fault::internal("a chat has no workflow to continue")),
            None => Ok(Place::default()),
        };
    };
    let next = api::next_step(Path::new(root), folder)?;
    let Some(branch) = next.branch.clone() else {
        return Err(Fault::refused(refusals::NO_BRANCH));
    };
    let place = Place {
        branch: Some(branch),
        ..Place::default()
    };
    let Some(workflow) = workflow else {
        return Ok(place);
    };
    if let Some(as_chat) = sent_as_chat(Path::new(root), folder, &next, workflow)? {
        return Ok(Place {
            as_chat: Some(as_chat.to_owned()),
            ..place
        });
    }
    let caught_up_to = match next.step.name == CATCH_UP {
        true => next.step.catch_up.map(|catch_up| catch_up.commit),
        false => None,
    };
    Ok(Place {
        caught_up_to,
        run_step: next.step.run_step,
        step: Some(next.step.name),
        ..place
    })
}

impl Runner {
    /// The session a workflow run of `run_step` goes to, from the feature's latest session
    /// `row`, and the fields it takes: that one when it never ran, which then starts for the
    /// step on the pick it was made on; that one when it runs the step already, whatever its
    /// pick; that one too when it runs on the step's agent and model, and ran no workflow, or
    /// its step's joint joins the step, on the step's effort; else a new session of the
    /// feature on the step's pick, which becomes its latest. `fresh` always starts a new one,
    /// once `row` ran. A new session is refused, before it exists, while a move holds `row`,
    /// or another session of its folder works and `row` does not.
    pub(super) fn run_session(
        &self,
        row: &Session,
        folder: &str,
        run_step: &str,
        fresh: bool,
    ) -> Result<(Fields, String), Fault> {
        let stay = |fields: Fields| Ok((fields, row.id.clone()));
        let store = self.store();
        let turns = store.turns(&row.id)?;
        // The run step a session runs: the one it started for, else, for a session started
        // before steps had sessions of their own, its latest workflow turn's.
        let ran = row.step.clone().or_else(|| {
            let workflow = |turn: &&Turn| turn.kind == TurnKind::Workflow && turn.step.is_some();
            let last = turns.iter().rev().find(workflow)?.step.clone()?;
            let step = uraeda_core::steps::StepName::parse(&last)?.run_step()?;
            Some(step.to_owned())
        });
        if !fresh && ran.as_deref() == Some(run_step) {
            return stay(Fields::default());
        }
        let (map, pick) = self.run_pick(&row.repo, folder, run_step, &row.agent)?;
        let starts = Fields {
            step: row.step.is_none().then(|| run_step.to_owned()),
            ..Fields::default()
        };
        if turns.is_empty() {
            // It never started: it starts on the pick it was made on, the human's or its
            // step's.
            let step = Some(run_step.to_owned()).filter(|step| row.step.as_ref() != Some(step));
            return stay(Fields {
                step,
                ..Fields::default()
            });
        }
        let current = picks::StepPick {
            runtime: row.agent.clone(),
            model: row.model.clone(),
            effort: None,
        };
        let on_pick = row.agent == pick.runtime && self.same_pick(&row.repo, &current, &pick);
        // A session that ran no step, as a chat moved to the feature, takes it on the step's
        // pick.
        let joined = !fresh
            && on_pick
            && ran.as_deref().is_none_or(|ran| {
                is_step(ran) && self.step_session(&row.repo, &map, ran, run_step)
            });
        if joined {
            // The effort a joined step runs on: its own, or the agent's default when it picks
            // none. Refused when the session's model does not take it.
            let effort = match pick.effort == row.effort {
                true => None,
                false => {
                    let (model, effort) = (row.model.as_deref(), pick.effort.as_deref());
                    self.check_effort(&row.agent, model, effort)?;
                    Some(pick.effort.clone())
                }
            };
            return stay(Fields { effort, ..starts });
        }
        let picked = self.step_picked(run_step, &pick)?;
        {
            let mut state = self.state();
            if state.lives.is_moving(&row.id) {
                return Err(Fault::refused(refusals::AGENT_WORKING));
            }
            let live = state.lives.get(&row.id);
            let behind = live.is_some_and(|live| live.turn.is_some() || !live.queue.is_empty());
            if !behind && state.lives.other_working(&row.id, true) {
                drop(state);
                let kind = api::read_feature(Path::new(&row.repo), folder)?.kind;
                return Err(Fault::refused(refusals::other_working(&kind)));
            }
        }
        let created = self.create(NewSession {
            repo: row.repo.clone(),
            folder: Some(folder.to_owned()),
            parent: None,
            role: None,
            step: Some(run_step.to_owned()),
            worktree: None,
            agent: picked.agent,
            native_id: uuid(),
            title: None,
            model: picked.model,
            effort: picked.effort,
        })?;
        Ok((Fields::default(), created.id))
    }
}
