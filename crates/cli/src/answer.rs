//! `ura answer`: one answer at a time, then the submission of the round.

use std::process::ExitCode;

use uraeda_core::actions::{answer, place};
use uraeda_core::target::{Purpose, Target};
use uraeda_core::today;

use crate::output;

/// Whether an argument names a question, `Q2` or `Q2.B`, or the notes: never a target.
fn is_question(argument: &str) -> bool {
    if argument == "notes" {
        return true;
    }
    let Some(rest) = argument.strip_prefix('Q') else {
        return false;
    };
    let (number, letter) = match rest.split_once('.') {
        Some((number, letter)) => (number, Some(letter)),
        None => (rest, None),
    };
    !number.is_empty()
        && number.bytes().all(|b| b.is_ascii_digit())
        && letter.is_none_or(|l| l.len() == 1 && l.bytes().all(|b| b.is_ascii_uppercase()))
}

pub fn run(arguments: Vec<String>, submit: bool, no_commit: bool) -> Result<ExitCode, String> {
    let starts_with_question = arguments.first().is_some_and(|first| is_question(first));
    let limit = if starts_with_question { 2 } else { 3 };
    if arguments.len() > limit {
        return Err("the answer is one argument: quote it".into());
    }
    let (target, question, text) = match arguments.as_slice() {
        [] => (None, None, None),
        [first, rest @ ..] if starts_with_question => (None, Some(first), rest.first()),
        [target, rest @ ..] => (Some(target), rest.first(), rest.get(1)),
    };
    if submit && question.is_some() {
        return Err("--submit takes no answer: answer first, then submit".into());
    }
    if !submit && question.is_none() {
        return Err(
            "name a question and its answer: ura answer [target] <question> <answer>, or --submit"
                .into(),
        );
    }
    if !submit && text.is_none() {
        return Err("give the answer: ura answer [target] <question> <answer>".into());
    }
    let (git, workspace) = output::workspace()?;
    let index = match output::target(&workspace, target.map(String::as_str), Purpose::Answers)? {
        Target::Feature(index) | Target::File(index, _) => index,
        Target::Draft(draft) => return Err(format!("{draft} is not started")),
    };
    let feature = &workspace.features[index];
    let branch = feature
        .branch
        .clone()
        .ok_or_else(|| format!("{} has no branch", feature.folder))?;
    let previous = git.current_branch();
    let place = place::reach(&git, &branch).map_err(|error| error.to_string())?;
    let refused = |error: String| {
        place::switch_back(&git, &place, previous.as_deref());
        error
    };
    if submit {
        if !no_commit {
            let path = answer::round_path(feature).map_err(|e| refused(e.to_string()))?;
            place::ensure_only_staged(&place, &[path]).map_err(|e| refused(e.to_string()))?;
        }
        let change =
            answer::submit(&place, feature, today::today()).map_err(|e| refused(e.to_string()))?;
        output::say_switched(&place);
        let round = change
            .subject
            .rsplit(' ')
            .next()
            .unwrap_or_default()
            .to_string();
        if no_commit {
            println!("Round {round} answered in {}: commit it.", change.paths[0]);
        } else {
            output::commit(&place, &change)?;
            println!(
                "Round {round} answered, committed as \"{}\".",
                change.subject
            );
        }
    } else if let (Some(question), Some(text)) = (question, text) {
        let written =
            answer::write(&place, feature, question, text).map_err(|e| refused(e.to_string()))?;
        output::say_switched(&place);
        let what = if question == "notes" {
            "Notes written".to_string()
        } else {
            format!("{question} answered")
        };
        println!(
            "{what} in {}. {} of {} questions answered.",
            written.file, written.answered, written.total
        );
    }
    Ok(ExitCode::SUCCESS)
}
