//! Rounds of questions: a feature's latest round, answered, noted, and submitted, and the
//! default branch's rounds, the inbox's triage and the decisions check.

use uraeda_core::actions::default_round::DefaultRound;
use uraeda_core::api::{self, undo};
use uraeda_core::files::document::hash;
use uraeda_core::view::FileView;
use uraeda_protocol::{
    AnswerSave, AnswersSubmit, DefaultRoundAnswer, DefaultRoundDismiss, DefaultRoundNotes,
    DefaultRoundRetry, DefaultRoundSubmit, NotesSave, Saved, SettledComment, SettledEdit,
    SettledRemove,
};

use super::undo::recorded;
use super::{Write, write};
use crate::live::Registry;

/// Registers the actions `answer.save`, `answers.submit`, `notes.save`, `settled.*`, and
/// `defaultRound.*`.
pub(super) fn register(registry: &Registry) {
    answers(registry);
    settled(registry);
    default_saves(registry);
    default_commits(registry);
}

/// A feature's round: its answers and notes, saved, and its submit, which commits.
fn answers(registry: &Registry) {
    registry.action::<AnswerSave>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let (folder, question) = (&input.folder, &input.question);
            let (letters, comment) = (&input.letters, &input.comment);
            api::save_answer(repo, folder, question, letters, comment, &input.previous)?;
            Ok(())
        })
    });
    registry.action::<NotesSave>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
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
    registry.action::<SettledComment>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            api::add_settled_comment(repo, &input.folder, &input.subject, &input.text)?;
            Ok(())
        })
    });
    registry.action::<SettledEdit>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let (folder, subject) = (&input.folder, &input.subject);
            let (text, previous) = (&input.text, &input.previous);
            api::edit_settled_comment(repo, folder, input.number, subject, text, previous)?;
            Ok(())
        })
    });
    registry.action::<SettledRemove>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let (folder, subject) = (&input.folder, &input.subject);
            recorded(repo, undo::round(repo, folder), || {
                api::remove_settled_comment(repo, folder, input.number, subject, &input.previous)
            })
        })
    });
}

/// A round of the default branch, saved: each save answers the round's hash, which the next
/// one takes as its `base`.
fn default_saves(registry: &Registry) {
    registry.action::<DefaultRoundAnswer>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let round = api::default_round(&input.id)?;
            let (question, letters) = (&input.question, &input.letters);
            let (comment, previous) = (&input.comment, &input.previous);
            let base = &input.base;
            let saved =
                api::save_round_answer(repo, round, question, letters, comment, previous, base)?;
            Ok(written(&saved))
        })
    });
    registry.action::<DefaultRoundNotes>(|call, input| {
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let round = api::default_round(&input.id)?;
            let (notes, previous) = (&input.notes, &input.previous);
            let saved = api::save_round_notes(repo, round, notes, previous, &input.base)?;
            Ok(written(&saved))
        })
    });
}

/// A round of the default branch, committed with the lists' commits: submitted, committed
/// again, or, for the triage, dismissed.
fn default_commits(registry: &Registry) {
    registry.action::<DefaultRoundSubmit>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::submit_round(repo, api::default_round(&input.id)?, &input.previous)?;
            Ok(())
        })
    });
    registry.action::<DefaultRoundRetry>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::retry_round(repo, api::default_round(&input.id)?)?;
            Ok(())
        })
    });
    registry.action::<DefaultRoundDismiss>(|call, input| {
        let commit = Write::of_lists().named(input.write);
        write(call.shared(), &input.repo, commit, |repo| {
            api::dismiss_round(repo, DefaultRound::Triage, &input.previous)?;
            Ok(())
        })
    });
}

/// What a save of a round answers: the hash of its text as written.
fn written(round: &FileView) -> Saved {
    Saved {
        hash: hash(&round.current.text),
    }
}
