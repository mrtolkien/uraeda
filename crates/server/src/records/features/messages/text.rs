//! The text of the workflow's message: the goal of the run, and where it stops.

/// What a message is about: a feature's or a change's kind, and its folder's path.
pub(in super::super) struct Subject<'a> {
    /// `feature` or `change`.
    pub kind: &'a str,
    /// Its folder, from the top level.
    pub path: &'a str,
}

/// What a run's message is written from.
pub(in super::super) struct Run<'a> {
    /// The feature's branch.
    pub branch: &'a str,
    /// The feature or the change.
    pub subject: Subject<'a>,
    /// The skill file the step follows.
    pub reference: &'a str,
    /// The step's name.
    pub step: &'a str,
    /// Whether it is the comments message, whatever the step.
    pub comments: bool,
    /// The spec's `plan-review`, for the steps before the plan is approved.
    pub plan_review: Option<bool>,
    /// At `catch-up`, the default branch it catches up with.
    pub catch_up: Option<&'a str>,
}

/// What a run does from a step, and where it stops.
pub(super) struct Goal {
    /// What it does.
    pub work: String,
    /// Where it stops.
    pub stop: String,
}

/// Where a run that ends on the pull request stops.
const READY: &str = "the pull request is ready for review";

/// The comments message's goal: the pull request's comments, until it waits for review again.
fn comments() -> Goal {
    Goal {
        work: "Address the comments on its pull request".to_owned(),
        stop: format!("{READY} again"),
    }
}

/// What a run does from a step, and where it stops: the end of its step, as each step is a run
/// of its own. The plan's run stops at its review when the spec's `plan-review` asks for one,
/// else once it is committed. A catch-up names the default branch.
pub(super) fn goal(step: &str, plan_review: Option<bool>, catch_up: Option<&str>) -> Goal {
    let to = |work: &str, stop: &str| Goal {
        work: work.to_owned(),
        stop: stop.to_owned(),
    };
    let plan = |work: &str| match plan_review {
        Some(true) => to(work, "the plan waits for my review"),
        _ => to(work, "the plan is committed"),
    };
    let again = format!("{READY} again");
    match step {
        "discovery" => to(
            "Investigate it and ask me your questions",
            "the questions wait for my answers",
        ),
        "spec" => to(
            "Write the spec from the answers",
            "the spec waits for my review",
        ),
        "spec-revision" => to(
            "Revise the spec from my review",
            "the spec waits for my review again",
        ),
        "approval" => plan("Record the approved decisions and write the plan"),
        "plan" => plan("Write the plan"),
        "plan-revision" => plan("Revise the plan"),
        "implementation" => to("Implement the plan", "every task of the plan is checked"),
        "final-review" => to("Review the implementation", READY),
        "pull-request-changes" => comments(),
        "catch-up" => {
            let branch = catch_up.unwrap_or("the default branch");
            to(&format!("Catch up with {branch}"), &again)
        }
        "push" => to("Push the branch's commits to its pull request", READY),
        "change" => to("Investigate it, then make the change", READY),
        _ => to("Finish it", READY),
    }
}

/// The workflow's message: the goal of the run and where it stops. A resumed session keeps its
/// first system prompt, so every message names the skill and the step's reference.
pub(in super::super) fn run_message(run: &Run<'_>) -> String {
    let Goal { work, stop } = match run.comments {
        true => comments(),
        false => goal(run.step, run.plan_review, run.catch_up),
    };
    let Subject { kind, path } = &run.subject;
    format!(
        "/uraeda Continue the {kind} {path}/ on branch {}: {work}, starting with {}.\n\
         Stop when {stop}, and earlier only if you need a decision from me.\n",
        run.branch, run.reference
    )
}

/// The reference the comments message starts from: the change's for a change.
pub(super) fn comments_reference(kind: &str) -> &'static str {
    match kind {
        "change" => "skills/uraeda/references/change.md",
        _ => "skills/uraeda/references/implementation.md",
    }
}

/// A text with its first letter in lower case, after "Continue, ".
pub(super) fn lowered(text: &str) -> String {
    let mut letters = text.chars();
    match letters.next() {
        Some(first) => first.to_lowercase().chain(letters).collect(),
        None => String::new(),
    }
}
