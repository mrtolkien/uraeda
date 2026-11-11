//! A message's way to a session: checked, placed at its feature's step, sent to the session its
//! run's options give, then steered into the running turn, queued after it, or starting one.

use std::path::Path;

use uraeda_core::api;
use uraeda_core::view::NextView;
use uraeda_protocol::Trigger;

use super::event::{ChatImage, Event, Origin};
use super::live::{Reading, Sent, Workflow};
use super::manager::{MAX_IMAGES, Runner, State, refusals};
use super::message::{
    SENT_AS_CHAT, SENT_AS_CHAT_MOVED_ON, SENT_AS_CHAT_NO_PULL_REQUEST, chat_opening, chat_title,
    continue_message,
};
use super::picks::{self, is_step};
use super::processes::uuid;
use super::running::{Shown, Starting, line};
use super::session::{NewSession, Session};
use super::status::CATCH_UP;
use super::turn::{ContinueReason, NewTurn, Turn, TurnKind, TurnState};
use crate::live::Fault;
use crate::records::features::recommend;
use crate::runtimes::{Outgoing, SentImage, When};

/// A chat image sent with a message: what its line keeps, and its file's path.
#[derive(Clone, Debug)]
pub(crate) struct Image {
    pub image: ChatImage,
    pub path: std::path::PathBuf,
}

/// A message to send: its text, its chat images, and for the workflow's, what started it.
/// `opening` is a line the server puts before the message, as the one telling a session moved
/// to a change where it works now.
#[derive(Clone, Debug, Default)]
pub(crate) struct Message {
    pub text: String,
    pub images: Vec<Image>,
    pub opening: Option<String>,
    pub workflow: Option<Run>,
}

/// What makes a message the workflow's: what started it, the step its message was read at,
/// and a line its turn shows before the message, as an automatic run's. `fresh` always starts
/// a new session of its change or feature.
#[derive(Clone, Debug, Default)]
pub(crate) struct Run {
    pub trigger: String,
    pub step: Option<String>,
    pub fresh: bool,
    pub line: Option<String>,
}

/// Where a message went: its session, which a workflow run's may have been made for it, and
/// its turn.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Went {
    pub session: String,
    pub turn: i64,
}

/// A message checked before any session work.
#[derive(Clone)]
pub(super) struct Checked {
    /// The images its line keeps.
    held: Vec<ChatImage>,
    /// Their files, which the agent gets.
    paths: Vec<SentImage>,
    text: String,
    opening: Option<String>,
    workflow: Option<Run>,
}

/// Where a message goes: its feature's branch, and for the workflow's, the step its run
/// starts and that step's run step, or the line saying it runs as a chat. At `catch-up`,
/// `caught_up_to` is the default branch's commit it catches up with, read now.
#[derive(Default)]
struct Place {
    as_chat: Option<String>,
    branch: Option<String>,
    caught_up_to: Option<String>,
    run_step: Option<String>,
    step: Option<String>,
}

/// The fields a session takes once a workflow run is delivered to it, so a refused run changes
/// nothing.
#[derive(Clone, Default)]
struct Fields {
    effort: Option<Option<String>>,
    step: Option<String>,
}

impl Fields {
    fn is_empty(&self) -> bool {
        self.effort.is_none() && self.step.is_none()
    }

    fn apply(&self, row: &mut Session) {
        if let Some(effort) = &self.effort {
            row.effort.clone_from(effort);
        }
        if let Some(step) = &self.step {
            row.step = Some(step.clone());
        }
    }
}

/// Whether a session belongs to a dropped change or feature: a session with a folder archived.
pub(crate) fn of_dropped(row: &Session) -> bool {
    row.folder.is_some() && row.archived_at.is_some()
}

/// Refuses a message's images: more than 10, to an agent that does not declare images, or with
/// the workflow's message, which is the workflow's own text.
pub(crate) fn check_images(count: usize, workflow: bool, reads_images: bool) -> Result<(), Fault> {
    let refusal = match count {
        0 => return Ok(()),
        _ if workflow => refusals::WORKFLOW_IMAGES,
        count if count > MAX_IMAGES => refusals::TOO_MANY_IMAGES,
        _ if !reads_images => refusals::NO_IMAGES,
        _ => return Ok(()),
    };
    Err(Fault::refused(refusal))
}

/// A message checked before any session work: text, or images alone.
pub(super) fn check_send(input: Message, reads_images: bool) -> Result<Checked, Fault> {
    let blank = input.text.trim().is_empty();
    if blank && input.images.is_empty() {
        return Err(Fault::refused(refusals::BLANK));
    }
    check_images(input.images.len(), input.workflow.is_some(), reads_images)?;
    let paths = input.images.iter().map(|image| SentImage {
        path: image.path.clone(),
    });
    Ok(Checked {
        paths: paths.collect(),
        held: input.images.into_iter().map(|image| image.image).collect(),
        text: match blank {
            true => String::new(),
            false => input.text,
        },
        opening: input.opening,
        workflow: input.workflow,
    })
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
fn send_place(root: &str, folder: Option<&str>, workflow: Option<&Run>) -> Result<Place, Fault> {
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

/// Whether a session is busy: a turn of it runs or waits, or another session of its change or
/// feature works.
fn busy(state: &mut State, session: &str) -> bool {
    let other = state.lives.other_working(session, true);
    let live = state.lives.get(session);
    other || live.is_some_and(|live| live.turn.is_some() || !live.queue.is_empty())
}

/// The turn a checked message starts or queues: a workflow turn for a run that still applies,
/// else a chat, with the line saying it runs as one, and its opening before its text.
fn starting(
    checked: Checked,
    place: &Place,
    run: Option<&Run>,
    opening: Option<String>,
) -> Starting {
    let text = match (&opening, checked.text.is_empty()) {
        (None, _) => checked.text.clone(),
        (Some(opening), true) => opening.clone(),
        (Some(opening), false) => format!("{opening}\n{}", checked.text),
    };
    Starting {
        kind: match run {
            Some(_) => TurnKind::Workflow,
            None => TurnKind::Chat,
        },
        trigger: run.map(|run| run.trigger.clone()),
        step: place.step.clone(),
        allowed: None,
        caught_up_to: place.caught_up_to.clone(),
        lines: run.and_then(|run| run.line.clone()).into_iter().collect(),
        after: place.as_chat.clone().into_iter().collect(),
        shown: Shown {
            origin: match run {
                Some(_) => Origin::Workflow,
                None => Origin::Human,
            },
            text: checked.text,
            opening,
            images: checked.held,
        },
        message: Outgoing {
            id: uuid(),
            text,
            images: checked.paths,
            when: When::Queue,
            review: false,
        },
    }
}

impl Runner {
    /// Sends a message to a session, and returns the session it went to and its turn. Idle,
    /// it starts a turn, opening the process when it is closed. During a turn, the human's
    /// message is steered into it, and the workflow's is queued after it. A workflow message
    /// that no longer applies runs as a chat, with the line saying so. A message may be images
    /// alone, at most 10, to an agent that declares images; the workflow's message takes none.
    /// A workflow run goes to the session its step's options give, maybe a new session of the
    /// change or the feature, which it returns; another session of it working refuses a
    /// message.
    pub(crate) fn send(&self, row: &Session, input: Message) -> Result<Went, Fault> {
        // A workflow message takes no images, and its run's session, maybe another, checks
        // its agent.
        let reads_images = match input.workflow {
            Some(_) => false,
            None => picks::ready(self, row)?.capabilities().images,
        };
        let message = check_send(input, reads_images)?;
        self.serial(row, || {
            self.as_human(&row.id, || self.send_to(&row.id, message))
        })
    }

    /// The human's message or Allow takes the place of the run's continue, and sets the count
    /// back: a refused one gives both back. The cancelled turns' change is said either way.
    pub(super) fn as_human<T>(
        &self,
        session: &str,
        body: impl FnOnce() -> Result<T, Fault>,
    ) -> Result<T, Fault> {
        let taken = self.take_over(session);
        let done = body();
        if done
            .as_ref()
            .is_err_and(|fault| fault.code() == uraeda_protocol::ErrorCode::Refused)
        {
            self.restore(session, &taken);
        }
        let mut state = self.state();
        for turn in taken.turns() {
            self.changed(&mut state, session, Some(turn), None);
        }
        done
    }

    /// Sends a checked message to the session, in its own turn. A workflow run goes to the
    /// session its run step's options give: a new session of the change or the feature
    /// becomes its latest, queued there while the session it was sent to works. The session
    /// the message goes to is refused while its agent is off or gone. A session of a dropped
    /// change or feature is refused: its worktree is gone, and stays gone.
    pub(super) fn send_to(&self, session: &str, checked: Checked) -> Result<Went, Fault> {
        let row = self.row(session)?;
        if of_dropped(&row) {
            return Err(Fault::refused(refusals::DROPPED));
        }
        let (folder, behind) = {
            let mut state = self.state();
            let live = state.lives.get(session);
            let folder = live.as_ref().and_then(|live| live.folder.clone());
            let behind = live.is_some_and(|live| live.turn.is_some() || !live.queue.is_empty());
            (folder.or_else(|| row.folder.clone()), behind)
        };
        let place = send_place(&row.repo, folder.as_deref(), checked.workflow.as_ref())?;
        let run = checked
            .workflow
            .as_ref()
            .filter(|_| place.as_chat.is_none());
        let run_step = place.run_step.clone().filter(|step| is_step(step));
        let (Some(run), Some(folder), Some(run_step)) = (run, folder, run_step) else {
            picks::ready(self, &row)?;
            return self.deliver(session, checked, place, false, Fields::default());
        };
        let (fields, next) = self.run_session(&row, &folder, &run_step, run.fresh)?;
        let mut going = self.row(&next)?;
        fields.apply(&mut going);
        picks::ready(self, &going)?;
        if next == session {
            return self.deliver(session, checked, place, false, fields);
        }
        self.serial(&going, || {
            self.deliver(&next, checked, place, behind, fields)
        })
    }

    /// Refuses a session a move or a drop holds, or that a drop archived: checked again after
    /// each wait.
    fn unmoved(&self, state: &State, session: &str) -> Result<(), Fault> {
        if state.lives.is_moving(session) {
            return Err(Fault::refused(refusals::AGENT_WORKING));
        }
        match of_dropped(&self.row(session)?) {
            true => Err(Fault::refused(refusals::DROPPED)),
            false => Ok(()),
        }
    }

    /// Sends the message in this session: steered into its turn, queued after it, or starting
    /// one. A session whose change or feature works in another session is refused, or,
    /// `behind` it, queued. The session takes `fields`, a workflow run's pick, once no refusal
    /// is left, before its turn queues or starts.
    fn deliver(
        &self,
        session: &str,
        checked: Checked,
        place: Place,
        behind: bool,
        fields: Fields,
    ) -> Result<Went, Fault> {
        let row = self.row(session)?;
        let run = checked.workflow.clone().filter(|_| place.as_chat.is_none());
        let went = |turn| Went {
            session: session.to_owned(),
            turn,
        };
        {
            let mut state = self.state();
            self.unmoved(&state, session)?;
            let own = state.lives.get(session);
            let own = own.is_some_and(|live| live.turn.is_some() || !live.queue.is_empty());
            if !behind && !own && busy(&mut state, session) {
                drop(state);
                let folder = row.folder.as_deref().unwrap_or_default();
                let kind = api::read_feature(Path::new(&row.repo), folder)?.kind;
                return Err(Fault::refused(refusals::other_working(&kind)));
            }
            self.reopened(&row, &checked.text, !checked.paths.is_empty())?;
            if let Some(turn) = self.steer(&mut state, session, &checked)? {
                return Ok(went(turn));
            }
        }
        let opening = match (&checked.opening, &run) {
            (Some(opening), _) => Some(opening.clone()),
            (None, None) => self.opening_of(session, place.branch.as_deref(), None)?,
            (None, Some(_)) => None,
        };
        let mut starting = starting(checked, &place, run.as_ref(), opening);
        {
            let mut state = self.state();
            self.unmoved(&state, session)?;
            if !fields.is_empty() {
                self.store()
                    .edit_session(session, |row| fields.apply(row))?;
                self.changed(&mut state, session, None, None);
            }
            // A busy session queues the turn: Uraeda writes its message once the running turn
            // ends, or once the other session of its folder is idle, which wakes it.
            if busy(&mut state, session) {
                let workflow = run.map(|run| Workflow {
                    trigger: run.trigger,
                    step: run.step,
                    fresh: run.fresh,
                    line: run.line,
                });
                return Ok(went(self.queue(&mut state, session, starting, workflow)?));
            }
            if let Some(live) = state.lives.get(session) {
                live.starting = true;
            }
        }
        let opened = self.open(session, None);
        let mut state = self.state();
        if let Some(live) = state.lives.get(session) {
            live.starting = false;
        }
        let begun = opened.and_then(|opened| {
            let first = opened.line.into_iter();
            starting.lines = first.chain(std::mem::take(&mut starting.lines)).collect();
            self.begin(&mut state, session, starting)
        });
        // A start that failed lets the sessions waiting for it go.
        begun
            .map(went)
            .inspect_err(|_| self.wake(&mut state, session))
    }

    /// Steers a human's message into the session's running turn, when the agent can steer and
    /// the turn is not ending: the turn it joined. It is written to the agent at once, and
    /// pending until the agent reads it.
    fn steer(
        &self,
        state: &mut State,
        session: &str,
        checked: &Checked,
    ) -> Result<Option<i64>, Fault> {
        let live = state.lives.get(session);
        let steered = live.and_then(|live| {
            let turn = live.turn.as_ref().filter(|turn| turn.stop.is_none())?;
            let steers = live.proc.as_ref()?.capabilities.steer;
            (checked.workflow.is_none() && steers).then_some(turn.id)
        });
        let Some(turn) = steered else {
            return Ok(None);
        };
        let id = uuid();
        let shown = Shown {
            origin: Origin::Human,
            text: checked.text.clone(),
            opening: None,
            images: checked.held.clone(),
        };
        let (page, seq) = self.add_line(state, session, turn, &shown.event(&id))?;
        let Some(live) = state.lives.get(session) else {
            return Err(Fault::internal(format!("session {session} is not kept")));
        };
        let sent = Sent {
            turn,
            seq,
            page,
            written: true,
            state: Reading::Pending,
            origin: Origin::Human,
            text: shown.text,
            opening: None,
            images: shown.images,
        };
        live.messages.insert(id.clone(), sent);
        if let Some(proc) = live.proc.as_ref() {
            proc.agent.send(Outgoing {
                id,
                text: checked.text.clone(),
                images: checked.paths.clone(),
                when: When::Steer,
                review: false,
            });
        }
        Ok(Some(turn))
    }

    /// Titles a chat without a title by its message, and brings an archived session back: a
    /// dropped change's session was refused before.
    fn reopened(&self, row: &Session, text: &str, images: bool) -> Result<(), Fault> {
        let untitled = row.folder.is_none() && row.title.is_none();
        if !untitled && row.archived_at.is_none() {
            return Ok(());
        }
        self.store().edit_session(&row.id, |row| {
            if untitled {
                row.title = Some(chat_title(text, images));
            }
            row.archived_at = None;
        })?;
        Ok(())
    }

    /// The chat opening a chat message on a feature starts with: on its session's first turn,
    /// or after a workflow run. A queued turn's, `before`, looks at the turns before it.
    fn opening_of(
        &self,
        session: &str,
        branch: Option<&str>,
        before: Option<i64>,
    ) -> Result<Option<String>, Fault> {
        let row = self.row(session)?;
        let (Some(folder), Some(branch)) = (row.folder.as_deref(), branch) else {
            return Ok(None);
        };
        let turns = self.store().turns(session)?;
        let earlier = turns.iter().rev().find(|turn| {
            turn.kind != TurnKind::Allow && before.is_none_or(|before| turn.id < before)
        });
        if earlier.is_some_and(|turn| turn.kind != TurnKind::Workflow) {
            return Ok(None);
        }
        let feature = api::read_feature(Path::new(&row.repo), folder)?;
        Ok(Some(chat_opening(&feature.kind, &feature.path, branch)))
    }

    /// Checks a queued workflow run again as it starts: one that no longer applies starts as a
    /// chat, from the human, with the line saying so in place of the workflow's line, and the
    /// chat opening when a chat there opens with it, after the opening it was sent with.
    /// Refused once its feature is merged.
    pub(super) fn recheck_queued(&self, session: &str, turn: i64) -> Result<(), Fault> {
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
    pub(super) fn deliver_continue(
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
            live.queue.push_back(super::live::Queued {
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

    /// The session a workflow run of `run_step` goes to, from the feature's latest session
    /// `row`, and the fields it takes: that one when it never ran, which then starts for the
    /// step on the pick it was made on; that one when it runs the step already, whatever its
    /// pick; that one too when it runs on the step's agent and model, and ran no workflow, or
    /// its step's joint joins the step, on the step's effort; else a new session of the
    /// feature on the step's pick, which becomes its latest. `fresh` always starts a new one,
    /// once `row` ran. A new session is refused, before it exists, while a move holds `row`,
    /// or another session of its folder works and `row` does not.
    fn run_session(
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
