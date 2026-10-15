//! `ura review`: comments on a spec or a plan, then a verdict.

use std::process::ExitCode;

use uraeda_core::actions::review::{self, Tier};
use uraeda_core::actions::{list, place};
use uraeda_core::files::review::Anchor;
use uraeda_core::target::{Purpose, Target};
use uraeda_core::today;

use crate::output;

pub struct Options {
    pub target: Option<String>,
    pub comment: Option<Vec<String>>,
    pub approve: bool,
    pub request_changes: bool,
    pub summary: Option<String>,
    pub tier: Tier,
    pub no_commit: bool,
}

/// `50`, `50-52`, or `general`.
fn lines(text: &str) -> Result<Option<(usize, usize)>, String> {
    if text == "general" {
        return Ok(None);
    }
    let invalid = || format!("\"{text}\" is not N, N-M, or general");
    let (start, end) = match text.split_once(['-', '–']) {
        Some((start, end)) => (start, end),
        None => (text, text),
    };
    let start = start.trim().parse().map_err(|_| invalid())?;
    let end = end.trim().parse().map_err(|_| invalid())?;
    Ok(Some((start, end)))
}

pub fn run(options: Options) -> Result<ExitCode, String> {
    let actions = [
        options.comment.is_some(),
        options.approve,
        options.request_changes,
    ];
    if actions.iter().filter(|a| **a).count() != 1 {
        return Err("give one of --comment <lines> <text>, --approve, or --request-changes".into());
    }
    let (git, workspace) = output::workspace()?;
    let (index, named) =
        match output::target(&workspace, options.target.as_deref(), Purpose::Review)? {
            Target::Feature(index) => (index, None),
            Target::File(index, file) => (index, Some(file)),
            Target::Draft(draft) => return Err(format!("{draft} is not started")),
        };
    let feature = &workspace.features[index];
    let file = review::reviewed_file(feature, named.as_deref()).map_err(|e| e.to_string())?;
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
    if let Some(comment) = &options.comment {
        let [range, text] = comment.as_slice() else {
            return Err(
                "--comment takes the lines and the text: --comment 50-52 \"Name it\"".into(),
            );
        };
        let lines = lines(range).map_err(refused)?;
        let added = review::comment(&git, &place, feature, &file, lines, text)
            .map_err(|e| refused(e.to_string()))?;
        output::say_place(&git, &place);
        if added.replaced {
            println!("replaced a pending review of an older version");
        }
        let where_ = match &added.anchor {
            Anchor::General => "on the whole file".to_string(),
            Anchor::Lines(start, end, heading) if start == end => {
                format!("on line {start}, under \"{heading}\"")
            }
            Anchor::Lines(start, end, heading) => {
                format!("on lines {start}–{end}, under \"{heading}\"")
            }
        };
        println!("C{} added to {}, {where_}.", added.number, added.review);
        return Ok(ExitCode::SUCCESS);
    }
    let today = today::today();
    let summary = options.summary.as_deref();
    let done = if options.approve {
        format!("{file} approved")
    } else {
        format!("Changes requested on {file}")
    };
    if options.no_commit {
        let change = if options.approve {
            review::approve(&place, feature, &file, summary, &options.tier, today)
        } else {
            review::request_changes(&place, feature, &file, summary, today)
        }
        .map_err(|e| refused(e.to_string()))?;
        output::say_place(&git, &place);
        println!("{done}: commit {}.", list(&change.paths));
    } else {
        let committed = if options.approve {
            review::approve_and_commit(&place, feature, &file, summary, &options.tier, today)
        } else {
            review::request_changes_and_commit(&place, feature, &file, summary, today)
        }
        .map_err(|e| refused(output::action_error(e)))?;
        output::say_place(&git, &place);
        println!("{done}, committed as \"{}\".", committed.change.subject);
    }
    Ok(ExitCode::SUCCESS)
}
