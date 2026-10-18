//! The stages of a feature and of a change, the commit types that start each, and the stage a
//! step is in.

use serde::Serialize;

use crate::git::CommitInfo;
use crate::steps::{Step, StepName};
use crate::workspace::{FileKind, Kind};

/// A stage of a feature's or a change's page.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Stage {
    Proposal,
    Questions,
    Spec,
    Plan,
    Build,
    Fix,
    PullRequest,
    Merged,
}

/// The commit types of code: a feature's build or a change's fix.
const CODE: &[&str] = &[
    "feat", "fix", "refactor", "test", "docs", "perf", "build", "ci", "style",
];

impl Stage {
    pub fn as_str(&self) -> &'static str {
        match self {
            Stage::Proposal => "proposal",
            Stage::Questions => "questions",
            Stage::Spec => "spec",
            Stage::Plan => "plan",
            Stage::Build => "build",
            Stage::Fix => "fix",
            Stage::PullRequest => "pull-request",
            Stage::Merged => "merged",
        }
    }

    /// Whether a commit of type `kind` can start this stage: the merge is read from the default
    /// branch's history, never from a type.
    pub(crate) fn takes(&self, kind: &str) -> bool {
        match self {
            Stage::Proposal => true,
            Stage::Questions => kind == "discovery",
            Stage::Spec => kind == "spec",
            Stage::Plan => kind == "decision" || kind == "plan",
            Stage::Build | Stage::Fix => CODE.contains(&kind),
            Stage::PullRequest => kind == "finish",
            Stage::Merged => false,
        }
    }
}

/// A feature's stages, or a change's, with Questions only when it had a round.
pub(crate) fn of(kind: Kind, had_round: bool) -> Vec<Stage> {
    match kind {
        Kind::Feature => vec![
            Stage::Proposal,
            Stage::Questions,
            Stage::Spec,
            Stage::Plan,
            Stage::Build,
            Stage::PullRequest,
            Stage::Merged,
        ],
        Kind::Change => [Stage::Proposal]
            .into_iter()
            .chain(had_round.then_some(Stage::Questions))
            .chain([Stage::Fix, Stage::PullRequest, Stage::Merged])
            .collect(),
    }
}

/// Each stage's start, in Unix seconds: the first commit, by author time, at or after the previous
/// started stage's start, whose type starts it. `scoped` is sorted by author time, each commit
/// with its type.
pub(crate) fn starts(stages: &[Stage], scoped: &[(&str, &CommitInfo)]) -> Vec<Option<i64>> {
    let mut bound = i64::MIN;
    stages
        .iter()
        .map(|stage| {
            let start = scoped
                .iter()
                .find(|(kind, commit)| commit.authored >= bound && stage.takes(kind))
                .map(|(_, commit)| commit.authored);
            if let Some(start) = start {
                bound = start;
            }
            start
        })
        .collect()
}

/// The index of the stage a step is in: `stages.len()` once merged, and the last started stage,
/// or the first, when the step names none of them.
pub(crate) fn current(step: &Step, stages: &[Stage], starts: &[Option<i64>]) -> u32 {
    let stage = match step.name {
        StepName::HumanGate => step
            .file
            .as_deref()
            .and_then(FileKind::of)
            .and_then(|(kind, _)| match kind {
                FileKind::Proposal => Some(Stage::Proposal),
                FileKind::Clarifications => Some(Stage::Questions),
                FileKind::Spec => Some(Stage::Spec),
                FileKind::Plan => Some(Stage::Plan),
                _ => None,
            }),
        StepName::Discovery => Some(Stage::Questions),
        StepName::Spec | StepName::SpecRevision => Some(Stage::Spec),
        StepName::Approval | StepName::Plan | StepName::PlanRevision => Some(Stage::Plan),
        StepName::Implementation | StepName::FinalReview => Some(Stage::Build),
        StepName::Change => Some(Stage::Fix),
        StepName::Finish
        | StepName::PullRequest
        | StepName::PullRequestChanges
        | StepName::PullRequestUnknown => Some(Stage::PullRequest),
        StepName::Done => return stages.len() as u32,
        StepName::None => None,
    };
    let index = stage
        .and_then(|stage| stages.iter().position(|known| *known == stage))
        .or_else(|| starts.iter().rposition(Option::is_some))
        .unwrap_or(0);
    index as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn step(name: StepName, file: Option<&str>) -> Step {
        Step {
            name,
            file: file.map(String::from),
            ..Step::none()
        }
    }

    #[test]
    fn each_step_is_in_its_stage() {
        let feature = of(Kind::Feature, true);
        let change = of(Kind::Change, false);
        let none = vec![None; feature.len()];
        let gate = |file| step(StepName::HumanGate, Some(file));
        let cases = [
            (gate("proposal.md"), "proposal"),
            (gate("clarifications-01.md"), "questions"),
            (gate("spec.md"), "spec"),
            (gate("plan.md"), "plan"),
            (step(StepName::Discovery, None), "questions"),
            (step(StepName::Spec, None), "spec"),
            (step(StepName::SpecRevision, None), "spec"),
            (step(StepName::Approval, None), "plan"),
            (step(StepName::Plan, None), "plan"),
            (step(StepName::PlanRevision, None), "plan"),
            (step(StepName::Implementation, None), "build"),
            (step(StepName::FinalReview, None), "build"),
            (step(StepName::Finish, None), "pull-request"),
            (step(StepName::PullRequest, None), "pull-request"),
            (step(StepName::PullRequestChanges, None), "pull-request"),
            (step(StepName::PullRequestUnknown, None), "pull-request"),
        ];
        for (step, stage) in cases {
            let index = current(&step, &feature, &none) as usize;
            assert_eq!(feature[index].as_str(), stage, "{:?}", step.name);
        }
        let fix = current(&step(StepName::Change, None), &change, &none);
        assert_eq!(change[fix as usize], Stage::Fix);
        assert_eq!(current(&Step::done(), &feature, &none), 7);
        let mut starts = none.clone();
        starts[..3].fill(Some(1));
        assert_eq!(current(&Step::none(), &feature, &starts), 2);
        assert_eq!(current(&Step::none(), &feature, &none), 0);
    }
}
