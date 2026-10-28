//! `ura expand`: a proposal of `PRIORITIES.md` expanded into a proposal file, on the default
//! branch.

use std::process::ExitCode;

use uraeda_core::actions::{expand, place};

use crate::{editor, output, terminal};

pub fn run(text: Option<String>, no_edit: bool) -> Result<ExitCode, String> {
    let (git, workspace) = output::workspace()?;
    let default = workspace
        .default_branch
        .clone()
        .ok_or("no default branch: commit on main first")?;
    let previous = git.current_branch();
    let place = place::reach(&git, &default).map_err(|error| error.to_string())?;
    let refused = |error: String| {
        place::switch_back(&git, &place, previous.as_deref());
        error
    };
    let Some(text) = text else {
        let candidates = expand::candidates(&place).map_err(|e| refused(e.to_string()))?;
        let proposals: Vec<_> = candidates.iter().collect();
        return Err(refused(format!(
            "name the proposal: ura expand <text>{}",
            expand::listed(&proposals)
        )));
    };
    let expanded = expand::run(&place, &text).map_err(|e| refused(e.to_string()))?;
    output::say_place(&git, &place);
    println!("created {}", expanded.path);
    println!("linked  \"{}\" in specs/PRIORITIES.md", expanded.text);
    if !no_edit && terminal::interactive(false) && !editor::open(&place.root.join(&expanded.path)) {
        println!("open it in your editor: {}", expanded.path);
    }
    Ok(ExitCode::SUCCESS)
}
