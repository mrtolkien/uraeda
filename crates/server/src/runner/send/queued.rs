//! A queued workflow run checked again as it starts, and an automatic continue's turn.

use super::*;

impl Runner {
    /// Checks a queued workflow run again as it starts: one that no longer applies starts as a
    /// chat, from the human, with the line saying so in place of the workflow's line, and the
    /// chat opening when a chat there opens with it, after the opening it was sent with.
    /// Refused once its feature is merged.
    pub(in crate::runner) fn recheck_queued(&self, session: &str, turn: i64) -> Result<(), Fault> {
        let row = self.row(session)?;
        let (run, message, folder) = {
            let mut state = self.state();
            let Some(live) = state.lives.get(session) else {
                return Ok(());
            };
            let queued = live.queue.iter().find(|queued| queued.id == turn);
            let Some((workflow, message)) = queued
                .and_then(|queued| Some((queued.workflow.clone()?, queued.message.id.clone())))
            else {
                return Ok(());
            };
            let run = Run {
                trigger: workflow.trigger,
                step: workflow.step,
                fresh: workflow.fresh,
                line: workflow.line,
            };
            (run, message, live.folder.clone())
        };
        let place = send_place(&row.repo, folder.as_deref(), Some(&run))?;
        let Some(as_chat) = place.as_chat else {
            return Ok(());
        };
        let chat = self.opening_of(session, place.branch.as_deref(), Some(turn))?;
        let mut state = self.state();
        let Some(live) = state.lives.get(session) else {
            return Ok(());
        };
        let repo = live.repo.clone();
        // A take-back, or Stop, may have ended it meanwhile.
        let waits = live.queue.iter().any(|queued| queued.id == turn);
        let Some(sent) = live.messages.get_mut(&message).filter(|_| waits) else {
            return Ok(());
        };
        // A workflow message's opening is the one it was sent with: it stays first.
        let lines: Vec<String> = sent.opening.take().into_iter().chain(chat).collect();
        let opening = (!lines.is_empty()).then(|| lines.join("\n"));
        (sent.origin, sent.opening) = (Origin::Human, opening.clone());
        let shown = Event::Message {
            id: message.clone(),
            origin: Origin::Human,
            text: sent.text.clone(),
            opening: opening.clone(),
            images: sent.images.clone(),
        };
        // The workflow's line before the message said why it ran, as a catch-up's: a chat runs
        // for none of it. The message takes its place, and the line saying it runs as a chat
        // follows it.
        if !self
            .store()
            .retype_queued(turn, &[shown, line(&as_chat)], self.now())?
        {
            return Ok(());
        }
        (sent.seq, sent.page) = (0, 0);
        let text = sent.text.clone();
        if let Some(queued) = live.queue.iter_mut().find(|queued| queued.id == turn) {
            queued.message.text = match opening {
                Some(opening) => format!("{opening}\n{text}"),
                None => text,
            };
            queued.workflow = None;
        }
        self.page_changed(&repo, turn, 0);
        self.changed(&mut state, session, Some(turn), None);
        Ok(())
    }

    /// Queues an automatic continue's turn in the session, at once, counts it, and returns it:
    /// the message of `reason`, from the workflow, after its line, in a turn of the stopped
    /// turn's kind, step, and trigger, an allow turn's as a chat. The turn, its lines, and the
    /// count are written as one, or not at all. The session's queue starts it, behind another
    /// session of its change or feature working, as any queued turn; it is not checked again
    /// as a workflow message.
    pub(in crate::runner) fn deliver_continue(
        &self,
        state: &mut State,
        session: &str,
        opens_with: &str,
        reason: ContinueReason,
        stopped: &Turn,
    ) -> Result<i64, Fault> {
        let id = uuid();
        let text = continue_message(reason).to_owned();
        let chat = matches!(stopped.kind, TurnKind::Allow | TurnKind::Chat);
        let kept = |field: &Option<String>| field.clone().filter(|_| !chat);
        let new = NewTurn {
            session_id: session.to_owned(),
            kind: match chat {
                true => TurnKind::Chat,
                false => stopped.kind,
            },
            trigger: kept(&stopped.trigger),
            step: kept(&stopped.step),
            allowed: None,
            // A continued catch-up, or retry of one, catches up with the same commit.
            caught_up_to: stopped.caught_up_to.clone(),
            state: TurnState::Queued,
        };
        let message = Event::Message {
            id: id.clone(),
            origin: Origin::Workflow,
            text: text.clone(),
            opening: None,
            images: Vec::new(),
        };
        let store = self.store();
        let (queued, places) =
            store.queue_continue(new, &[line(opens_with), message], self.now())?;
        let page = store.page_of(queued, places[1])?.unwrap_or_default();
        Self::track(state, queued);
        if let Some(live) = state.lives.get(session) {
            let sent = Sent {
                turn: queued,
                seq: places[1],
                page,
                written: false,
                state: Reading::Pending,
                origin: Origin::Workflow,
                text: text.clone(),
                opening: None,
                images: Vec::new(),
            };
            live.messages.insert(id.clone(), sent);
            live.queue.push_back(crate::runner::live::Queued {
                id: queued,
                message: Outgoing {
                    id,
                    text,
                    images: Vec::new(),
                    when: When::Queue,
                    review: false,
                },
                workflow: None,
            });
        }
        self.changed(state, session, Some(queued), Some(TurnState::Queued));
        self.next(state, session);
        Ok(queued)
    }
}
