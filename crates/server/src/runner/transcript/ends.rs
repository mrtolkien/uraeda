//! A tool call's end, a background task's, and a turn's result.

use super::*;

impl Runner {
    /// Records a tool call's end, with its result.
    pub(in crate::runner) fn end_tool(
        &self,
        state: &mut State,
        session: &str,
        id: &str,
        is_error: bool,
        output: String,
    ) -> Result<(), Fault> {
        let Some(live) = state.lives.get(session) else {
            return Ok(());
        };
        let repo = live.repo.clone();
        let Some(running) = live.turn.as_mut() else {
            return Ok(());
        };
        let turn = running.id;
        let Some(tool) = running.remove_tool(id) else {
            return Ok(());
        };
        let end = Event::ToolEnd {
            id: id.to_owned(),
            is_error,
            output,
        };
        self.store().append(turn, self.now(), &end)?;
        self.page_changed(&repo, turn, tool.page);
        if tool.subagent.is_some() {
            self.changed(state, session, Some(turn), None);
        }
        Ok(())
    }

    /// The background tasks still running: a task's tool call ends once it reports back, not
    /// when it starts. The commands' count is said as it changes; once none runs, a process
    /// with no turn starts its idle timer.
    pub(in crate::runner) fn background(
        &self,
        state: &mut State,
        session: &str,
        serial: u64,
        tasks: &[BackgroundTask],
    ) -> Result<(), Fault> {
        let Some(proc) = proc_of(state, session, serial) else {
            return Ok(());
        };
        let before = proc.commands();
        let running = |id: &String| tasks.iter().any(|task| task.tool == *id);
        let done: Vec<String> = proc.background.iter().map(|(id, _)| id.clone()).collect();
        let done: Vec<String> = done.into_iter().filter(|id| !running(id)).collect();
        let background: Vec<(String, BackgroundKind)> = tasks
            .iter()
            .map(|task| (task.tool.clone(), task.kind))
            .collect();
        proc.background.clone_from(&background);
        let commands = proc.commands();
        for id in done {
            let tool = self.running(state, session).and_then(|turn| turn.tool(&id));
            if let Some((is_error, output)) = tool.and_then(|tool| tool.ended.take()) {
                self.end_tool(state, session, &id, is_error, output)?;
            }
        }
        if self
            .running(state, session)
            .is_some_and(|turn| turn.replied)
        {
            let label = match background.is_empty() {
                true => WORKING.to_owned(),
                false => waiting_label(&background),
            };
            self.set_activity(state, session, label, false, false);
        }
        if commands != before {
            self.changed(state, session, None, None);
        }
        let idle = self.running(state, session).is_none() && background.is_empty();
        if idle {
            self.next(state, session);
        }
        Ok(())
    }

    /// Ends the turn with its result, unless a message steered into it waits to be read, or a
    /// background task still runs: the agent answers them before the turn settles.
    #[expect(
        clippy::too_many_arguments,
        reason = "a result's parts, and its turn's"
    )]
    pub(in crate::runner) fn result(
        &self,
        state: &mut State,
        session: &str,
        serial: u64,
        denials: &[Denial],
        ruled: Vec<Ruled>,
        ok: bool,
        end: TurnEnd,
    ) -> Result<(), Fault> {
        let Some((turn, first)) = self
            .running(state, session)
            .map(|turn| (turn.id, turn.first.clone()))
        else {
            return Ok(());
        };
        for (denial, (target, rule)) in denials.iter().zip(ruled) {
            let blocked = Event::Denial {
                tool: denial.tool.clone(),
                target,
                rule,
            };
            self.add_line(state, session, turn, &blocked)?;
        }
        self.settle(state, session, &first, Reading::Read);
        let Some(live) = state.lives.get(session) else {
            return Ok(());
        };
        let unread = live
            .messages
            .values()
            .any(|sent| sent.turn == turn && sent.written && sent.state == Reading::Pending);
        let steered = live.unread(turn, &first);
        let Some(proc) = live.proc.as_ref().filter(|proc| proc.serial == serial) else {
            return Ok(());
        };
        let (background, name) = (proc.background.clone(), proc.name.clone());
        let (agent, takes_back) = (proc.agent.clone(), proc.capabilities.take_back);
        let stop = live.turn.as_ref().and_then(|turn| turn.stop.clone());
        if ok && stop.is_none() && (unread || !background.is_empty()) {
            if !unread {
                if let Some(running) = self.running(state, session) {
                    running.replied = true;
                }
                self.set_activity(state, session, waiting_label(&background), false, false);
            }
            return Ok(());
        }
        // A turn that ends on its own, as one that failed, takes back what the agent did not
        // read: it would otherwise run after it, in no turn.
        if stop.is_none() && takes_back {
            for id in steered {
                agent.take_back(&id);
                self.mark(state, session, &id, Reading::TakenBack);
            }
        }
        let end = stop.unwrap_or_else(|| match (end.state, end.reason) {
            (TurnState::Failed, None) => {
                let reason = format!("{name} ended the turn with an error.");
                TurnEnd::because(TurnState::Failed, reason)
            }
            (state, reason) => TurnEnd { state, reason },
        });
        self.end(state, session, turn, end);
        self.next(state, session);
        Ok(())
    }
}
