//! A review of a spec or a plan: its pending comments, each undoable, and its verdict, which
//! commits.

use uraeda_core::actions::review::DecisionTarget;
use uraeda_core::api::{self, undo};
use uraeda_protocol::{
    CommitRetry, ReviewApprove, ReviewComment, ReviewEdit, ReviewRemove, ReviewRequestChanges,
    ReviewStartOver,
};

use super::undo::recorded;
use super::{Write, write};
use crate::live::Registry;

/// Registers the actions `review.*`, and `commit.retry`.
pub(super) fn register(registry: &Registry) {
    comments(registry);
    verdicts(registry);
    registry.action::<CommitRetry>(|call, input| {
        let commit = Write::of_feature(&input.folder)
            .file(&input.file)
            .named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::retry_commit(repo, &input.folder, &input.file)?;
            Ok(())
        })
    });
}

/// The pending review's writes: none commits, and each answers its change, for the undo.
fn comments(registry: &Registry) {
    registry.action::<ReviewComment>(|call, input| {
        let lines = input
            .start_line
            .map(|start| (start, input.end_line.unwrap_or(start)));
        let decision = input.decision.map(|decision| DecisionTarget {
            name: decision.name,
            removed: decision.removed,
        });
        let (folder, file, text) = (&input.folder, &input.file, &input.text);
        let saving = Write::saving().on_feature(folder);
        write(call.shared(), &input.repo, saving, |repo| {
            recorded(repo, undo::review(repo, folder, file), || {
                api::add_comment(repo, folder, file, lines, text, decision)
            })
        })
    });
    registry.action::<ReviewEdit>(|call, input| {
        let (folder, file) = (&input.folder, &input.file);
        let saving = Write::saving().on_feature(folder);
        write(call.shared(), &input.repo, saving, |repo| {
            recorded(repo, undo::review(repo, folder, file), || {
                api::edit_comment(repo, folder, file, input.number, &input.text)
            })
        })
    });
    registry.action::<ReviewRemove>(|call, input| {
        let (folder, file) = (&input.folder, &input.file);
        let saving = Write::saving().on_feature(folder);
        write(call.shared(), &input.repo, saving, |repo| {
            recorded(repo, undo::review(repo, folder, file), || {
                api::remove_comment(repo, folder, file, input.number)
            })
        })
    });
    registry.action::<ReviewStartOver>(|call, input| {
        let (folder, file) = (&input.folder, &input.file);
        let saving = Write::saving().on_feature(folder);
        write(call.shared(), &input.repo, saving, |repo| {
            recorded(repo, undo::review(repo, folder, file), || {
                api::start_over(repo, folder, file)
            })
        })
    });
}

/// The verdicts: each writes the file and its review, and commits them.
fn verdicts(registry: &Registry) {
    registry.action::<ReviewApprove>(|call, input| {
        let commit = Write::of_feature(&input.folder)
            .file(&input.file)
            .named(input.write);
        let summary = input.summary.as_deref();
        write(call.shared(), &input.repo, commit, |repo| {
            let (folder, file) = (&input.folder, &input.file);
            api::approve(repo, folder, file, summary, input.tier, input.plan_review)?;
            Ok(())
        })
    });
    registry.action::<ReviewRequestChanges>(|call, input| {
        let commit = Write::of_feature(&input.folder)
            .file(&input.file)
            .named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            let summary = input.summary.as_deref();
            api::request_changes(repo, &input.folder, &input.file, summary)?;
            Ok(())
        })
    });
}
