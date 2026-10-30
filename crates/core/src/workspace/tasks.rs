//! The tasks done on a feature's task branches: a wave's tasks are built at once, each on its own
//! local branch, `<branch>-task-N`, and each counts as done once its boxes are, before its merge.

use std::collections::{BTreeMap, BTreeSet};

use super::{Feature, Kind, ReadFrom, Reading};
use crate::files::plan;
use crate::git::Branch;
use crate::steps::{self, PullRequest, StepName};

impl Reading<'_> {
    /// Adds to each feature being built the tasks done on its task branches, and moves its step's
    /// progress with them.
    pub(super) fn add_task_branches(
        &self,
        branches: &[Branch],
        features: &mut BTreeMap<(Kind, String), Feature>,
    ) {
        for feature in features.values_mut() {
            if feature.step.name != StepName::Implementation {
                continue;
            }
            let Some(branch) = feature.branch.as_deref() else {
                continue;
            };
            let done = self.task_branch_done(branches, branch, &feature.path);
            if !done.is_empty() {
                feature.with_task_branch_done(done);
            }
        }
    }

    /// The tasks, by number and title, whose boxes are all checked in the plan at the tip of a
    /// local task branch of `branch`, the task its name numbers only. A task the plan has not, as
    /// one dropped from it since, is not one.
    fn task_branch_done(
        &self,
        branches: &[Branch],
        branch: &str,
        path: &str,
    ) -> BTreeSet<(u32, String)> {
        let prefix = format!("{branch}-task-");
        let plan_path = format!("{path}/plan.md");
        branches
            .iter()
            .filter_map(|task_branch| {
                let number: u32 = task_branch.name.strip_prefix(&prefix)?.parse().ok()?;
                let from = ReadFrom::Commit(task_branch.local?);
                let text = self.reader.read(from, &plan_path)?;
                let task = plan::tasks(&text, path)
                    .into_iter()
                    .find(|task| task.number == number)?;
                (task.done >= task.total).then_some((number, task.title))
            })
            .collect()
    }
}

impl Feature {
    /// Sets the tasks done on its task branches, and its step with them, from its latest commit.
    fn with_task_branch_done(&mut self, done: BTreeSet<(u32, String)>) {
        if let Some(at_tip) = self.at_tip.as_deref_mut() {
            at_tip.task_branch_done = done.clone();
        }
        self.task_branch_done = done;
        self.step = steps::step(self.at_tip.as_deref().unwrap_or(self), PullRequest::Unknown);
    }
}
