//! The workflow's messages: the text a step's run starts with, which the human reads and may
//! change before sending, and the one message recommended to a feature now.

mod text;

use uraeda_core::api;
use uraeda_core::view::{FeatureView, NextView};
use uraeda_protocol::{
    ItemArgs, PostponeMessage, RecommendedMessage, Trigger, WorkflowMessage, WorkflowMessageArgs,
};

pub(super) use text::{Run, Subject, run_message};

use crate::live::{Fault, Registry};
use crate::records::repositories;
use crate::runner::{Runner, picks};
use crate::shared::Shared;

/// Why a feature without a branch gets no message.
const NO_BRANCH: &str = "This feature has no branch left: it is merged.";

/// Why a workflow message is refused to a feature whose step waits on the human.
const WAITS_ON_HUMAN: &str = "The feature waits on you now: there is nothing to continue.";

/// Why no message is recommended to a feature that waits on the human, or on nobody.
const NOTHING_TO_RECOMMEND: &str = "No recommended message: the feature waits on you";

/// Why no message is recommended at a pull request whose state `gh` could not read.
const UNKNOWN_PULL_REQUEST: &str = "No recommended message: the pull request's state is unknown";

/// The comments message's name.
const COMMENTS_NAME: &str = "Address the pull request's comments";

/// Registers the records `WorkflowMessage`, `RecommendedMessage`, and `PostponeMessage`.
pub(super) fn register(registry: &Registry) {
    registry.record::<WorkflowMessage>(workflow);
    registry.record::<RecommendedMessage>(recommended);
    registry.record::<PostponeMessage>(postpone);
}

/// The value of the record `PostponeMessage`: a feature's postponement, refused without a branch
/// to close. None for a folder that is no feature's.
fn postpone(shared: &Shared, args: ItemArgs) -> Result<Option<PostponeMessage>, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let read = api::next_step(&repository.path, &args.id)
        .and_then(|next| Ok((next, api::read_feature(&repository.path, &args.id)?)));
    let Ok((next, feature)) = read else {
        return Ok(None);
    };
    Ok(Some(match &next.branch {
        Some(branch) => PostponeMessage {
            refusal: None,
            text: text::postpone(&feature.kind, &feature.path, branch),
        },
        None => PostponeMessage {
            refusal: Some(NO_BRANCH.to_owned()),
            text: String::new(),
        },
    }))
}

/// The value of the record `WorkflowMessage`: empty, with the refusal, when the feature has no
/// branch, or does not wait on the agent. None for a folder that is no feature's.
fn workflow(shared: &Shared, args: WorkflowMessageArgs) -> Result<Option<WorkflowMessage>, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    // The core reads no step for a folder that is no feature's.
    let Ok(next) = api::next_step(&repository.path, &args.folder) else {
        return Ok(None);
    };
    let step = next.step.name.clone();
    let refused = |refusal: &str| WorkflowMessage {
        refusal: Some(refusal.to_owned()),
        step: step.clone(),
        text: String::new(),
    };
    let (Some(branch), reference) = (&next.branch, &next.step.reference) else {
        return Ok(Some(refused(NO_BRANCH)));
    };
    let Some(reference) = reference
        .as_deref()
        .filter(|_| next.step.waits_on == "agent")
    else {
        return Ok(Some(refused(WAITS_ON_HUMAN)));
    };
    let Ok(feature) = api::read_feature(&repository.path, &args.folder) else {
        return Ok(None);
    };
    let reference = match args.trigger {
        Trigger::Comments => text::comments_reference(&feature.kind),
        _ => reference,
    };
    let comments = args.trigger == Trigger::Comments;
    Ok(Some(WorkflowMessage {
        refusal: None,
        text: of_step(&feature, &next, branch, reference, comments),
        step,
    }))
}

/// The workflow's message of a feature for a trigger, as its record reads it: what the server
/// sends by itself, as a started change's first run.
pub(crate) fn workflow_message(
    shared: &Shared,
    repo: &str,
    folder: &str,
    trigger: Trigger,
) -> Result<Option<WorkflowMessage>, Fault> {
    let args = WorkflowMessageArgs {
        repo: repo.to_owned(),
        folder: folder.to_owned(),
        trigger,
    };
    workflow(shared, args)
}

/// The message of a feature's step, from `reference`: the comments message with `comments`.
fn of_step(
    feature: &FeatureView,
    next: &NextView,
    branch: &str,
    reference: &str,
    comments: bool,
) -> String {
    let catch_up = next.step.catch_up.as_ref();
    run_message(&Run {
        branch,
        subject: Subject {
            kind: &feature.kind,
            path: &feature.path,
        },
        reference,
        step: &next.step.name,
        comments,
        plan_review: next.step.plan_review,
        catch_up: catch_up.map(|catch_up| catch_up.branch.as_str()),
    })
}

/// What the human's Continue does at a feature's step, in the words of its page's button:
/// `Continue, write the plan`.
pub(crate) fn continue_name(step: &str) -> String {
    let work = text::goal(step, None, None).work;
    format!("Continue, {}", text::lowered(&work))
}

/// The value of the record `RecommendedMessage`: the one workflow message that applies to a
/// feature now, or why none does. None for a folder that is no feature's.
fn recommended(shared: &Shared, args: ItemArgs) -> Result<Option<RecommendedMessage>, Fault> {
    let repository = repositories::find(shared, &args.repo)?;
    let read = api::next_step(&repository.path, &args.id)
        .and_then(|next| Ok((next, api::read_feature(&repository.path, &args.id)?)));
    let Ok((next, feature)) = read else {
        return Ok(None);
    };
    let agent = unavailable(shared, &repository.path, &args.id);
    Ok(Some(recommend(&feature, &next, agent.as_deref())))
}

/// No message, and why.
fn none(reason: &str) -> RecommendedMessage {
    RecommendedMessage {
        name: None,
        reason: Some(reason.to_owned()),
        step: None,
        text: String::new(),
        trigger: None,
    }
}

/// Why the runtime a feature's message goes to cannot take it: its latest session's, which its
/// run goes to, or a new session's. None while it is on in the repository, and available.
fn unavailable(shared: &Shared, root: &std::path::Path, folder: &str) -> Option<String> {
    let runner = Runner::find(shared)?;
    let root = root.to_string_lossy();
    let latest = runner.store().latest_session(&root, folder).ok().flatten();
    let takes = picks::message_runtime(&runner, &root, latest.as_ref(), None);
    takes.err().map(|fault| fault.message().to_owned())
}

/// The one workflow message that applies to a feature now: nothing without its branch, or
/// while its agent cannot take it, `unavailable` saying why; the step's own while it waits on
/// the agent, the comments message for changes requested on its pull request; else the
/// comments message while its pull request is open or a draft, and its state known.
pub(crate) fn recommend(
    feature: &FeatureView,
    next: &NextView,
    unavailable: Option<&str>,
) -> RecommendedMessage {
    let step = &next.step;
    let Some(branch) = &next.branch else {
        return none(NO_BRANCH);
    };
    if let Some(unavailable) = unavailable {
        return none(unavailable);
    }
    let message = |name: String, reference: &str, trigger: Trigger| RecommendedMessage {
        name: Some(name),
        reason: None,
        step: Some(step.name.clone()),
        text: of_step(
            feature,
            next,
            branch,
            reference,
            trigger == Trigger::Comments,
        ),
        trigger: Some(trigger),
    };
    let comments =
        |reference: &str| message(COMMENTS_NAME.to_owned(), reference, Trigger::Comments);
    // An unknown pull request's step waits on the agent, and its message is not recommended.
    let unknown = step.name == "pull-request-unknown";
    if let Some(reference) = step.reference.as_deref()
        && step.waits_on == "agent"
        && !unknown
    {
        if step.name == "pull-request-changes" {
            return comments(reference);
        }
        let catch_up = step
            .catch_up
            .as_ref()
            .map(|catch_up| catch_up.branch.as_str());
        let work = text::goal(&step.name, step.plan_review, catch_up).work;
        let name = format!("Continue, {}", text::lowered(&work));
        return message(name, reference, Trigger::Manual);
    }
    // Without `gh`, the pull request is its record's, read as open: its state is unknown.
    let known = !unknown && step.pull_request.as_deref() != Some("unknown");
    match (feature.pull_request.is_some() && known, unknown) {
        (true, _) => comments(text::comments_reference(&feature.kind)),
        (false, true) => none(UNKNOWN_PULL_REQUEST),
        (false, false) => none(NOTHING_TO_RECOMMEND),
    }
}
