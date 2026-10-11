//! `ura draft`: a line of `PRIORITIES.md` turned into a draft file, on the default branch.

use std::process::ExitCode;

use uraeda_core::actions::{draft, place};

use crate::{editor, output};

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
        let candidates = draft::candidates(&place).map_err(|e| refused(e.to_string()))?;
        let entries: Vec<_> = candidates.iter().collect();
        return Err(refused(format!(
            "name the line: ura draft <text>{}",
            draft::listed(&entries)
        )));
    };
    let drafted = draft::run(&place, &text).map_err(|e| refused(e.to_string()))?;
    output::say_place(&git, &place);
    println!("created {}", drafted.path);
    println!("linked  \"{}\" in specs/PRIORITIES.md", drafted.text);
    if !no_edit && editor::available() && !editor::open(&place.root.join(&drafted.path)) {
        println!("open it in your editor: {}", drafted.path);
    }
    Ok(ExitCode::SUCCESS)
}
