//! A tool call's lines: its start, and its end.

use super::*;

impl Runner {
    /// A tool call starts: a new line, kept until its end.
    pub(in crate::runner) fn tool_start(
        &self,
        state: &mut State,
        session: &str,
        turn: i64,
        event: &Event,
    ) -> Result<(), Fault> {
        let Event::ToolStart {
            id,
            parent,
            subagent,
            ..
        } = event
        else {
            return Ok(());
        };
        let (page, _) = self.add_line(state, session, turn, event)?;
        let tool = Tool {
            page,
            parent: parent.clone(),
            subagent: subagent
                .as_ref()
                .map(|subagent| subagent.description.clone()),
            started_at: self.now(),
            calls: 0,
            latest: None,
            ended: None,
        };
        let starts = tool.subagent.is_some();
        if let Some(running) = self.running(state, session) {
            running.tools.push((id.clone(), tool));
        }
        // A sub-agent at work shows in the session's row.
        if starts {
            self.changed(state, session, Some(turn), None);
        }
        Ok(())
    }
}
