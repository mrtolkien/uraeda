//! Rounds of questions: a feature's latest round, answered, noted, and submitted, and the
//! default branch's round, the inbox's triage.

use uraeda_core::api::{self, undo};
use uraeda_core::files::document::hash;
use uraeda_core::view::FileView;
use uraeda_protocol::{
    AnswerSave, AnswerSaved, AnswersSubmit, NotesSave, Saved, SettledAddComment, SettledEdit,
    SettledRemove, TriageAnswer, TriageDismiss, TriageNotes, TriageRetry, TriageSubmit,
};

use super::undo::recorded;
use super::{Write, write};
use crate::live::Registry;

/// Registers the actions `answer.save`, `answers.submit`, `notes.save`, `settled.*`, and
/// `triage.*`.
pub(super) fn register(registry: &Registry) {
    answers(registry);
    settled(registry);
    triage_saves(registry);
    triage_commits(registry);
}

/// A feature's round: its answers and notes, saved, and its submit, which commits.
fn answers(registry: &Registry) {
    registry.action::<AnswerSave>(|call, input| {
        let saving = Write::saving().on_feature(&input.folder);
        write(call.shared(), &input.repo, saving, |repo| {
            let (folder, question) = (&input.folder, &input.question);
            let (letters, comment) = (&input.letters, &input.comment);
            let saved =
                api::save_answer(repo, folder, question, letters, comment, &input.previous)?;
            Ok(answered(&saved, question))
        })
    });
    registry.action::<NotesSave>(|call, input| {
        let saving = Write::saving().on_feature(&input.folder);
        write(call.shared(), &input.repo, saving, |repo| {
            api::save_notes(repo, &input.folder, &input.notes, &input.previous)?;
            Ok(())
        })
    });
    registry.action::<AnswersSubmit>(|call, input| {
        let commit = Write::of_feature(&input.folder).named(input.write);
        let commit = match &input.file {
            Some(file) => commit.file(file),
            None => commit,
        };
        write(call.shared(), &input.repo, commit, |repo| {
            api::submit_answers(repo, &input.folder, input.file.as_deref(), input.resumes)?;
            Ok(())
        })
    });
}

/// The comments on a round's settled points: none commits, and a removal can be undone.
fn settled(registry: &Registry) {
    registry.action::<SettledAddComment>(|call, input| {
        let saving = Write::saving().on_feature(&input.folder);
        write(call.shared(), &input.repo, saving, |repo| {
            api::add_settled_comment(repo, &input.folder, &input.subject, &input.text)?;
            Ok(())
        })
    });
    registry.action::<SettledEdit>(|call, input| {
        let saving = Write::saving().on_feature(&input.folder);
        write(call.shared(), &input.repo, saving, |repo| {
            let (folder, subject) = (&input.folder, &input.subject);
            let (text, previous) = (&input.text, &input.previous);
            api::edit_settled_comment(repo, folder, input.number, subject, text, previous)?;
            Ok(())
        })
    });
    registry.action::<SettledRemove>(|call, input| {
        let saving = Write::saving().on_feature(&input.folder);
        write(call.shared(), &input.repo, saving, |repo| {
            let (folder, subject) = (&input.folder, &input.subject);
            recorded(repo, undo::round(repo, folder), || {
                api::remove_settled_comment(repo, folder, input.number, subject, &input.previous)
            })
        })
    });
}

/// The inbox's triage, saved: each save answers the triage's hash, which the next one takes as
/// its `base`.
fn triage_saves(registry: &Registry) {
    registry.action::<TriageAnswer>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let (question, letters) = (&input.question, &input.letters);
            let (comment, previous) = (&input.comment, &input.previous);
            let saved =
                api::save_triage_answer(repo, question, letters, comment, previous, &input.base)?;
            Ok(answered(&saved, question))
        })
    });
    registry.action::<TriageNotes>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let (notes, previous) = (&input.notes, &input.previous);
            let saved = api::save_triage_notes(repo, notes, previous, &input.base)?;
            Ok(written(&saved))
        })
    });
}

/// The inbox's triage, committed with the lists' commits: submitted, committed again, or
/// dismissed.
fn triage_commits(registry: &Registry) {
    registry.action::<TriageSubmit>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::submit_triage(repo, &input.previous)?;
            Ok(())
        })
    });
    registry.action::<TriageRetry>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::retry_triage(repo)?;
            Ok(())
        })
    });
    registry.action::<TriageDismiss>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::dismiss_triage(repo, &input.previous)?;
            Ok(())
        })
    });
}

/// What an answer's save answers: the answer as written, and the round's hash.
fn answered(round: &FileView, question: &str) -> AnswerSaved {
    let answer = round
        .current
        .items
        .clarifications
        .as_ref()
        .and_then(|items| items.questions.iter().find(|one| one.id == question))
        .map(|one| one.answer.clone())
        .unwrap_or_default();
    AnswerSaved {
        answer,
        hash: hash(&round.current.text),
    }
}

/// What a save of a round answers: the hash of its text as written.
fn written(round: &FileView) -> Saved {
    Saved {
        hash: hash(&round.current.text),
    }
}
