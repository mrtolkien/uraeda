//! `ura init`: the `specs/` folder and the skill, in the repository's top level.

use std::process::ExitCode;

use uraeda_core::actions::init::{self, InitLine};
use uraeda_core::git::Git;

pub fn run(no_skill: bool) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let git = Git::discover(&cwd).map_err(|error| error.to_string())?;
    let lines = init::run(git.root(), !no_skill).map_err(|error| error.to_string())?;
    let mut constitution = false;
    for line in &lines {
        match line {
            InitLine::Created(path) => {
                constitution |= path == "specs/CONSTITUTION.md";
                println!("created {path}");
            }
            InitLine::Kept(path, None) => println!("kept    {path}"),
            InitLine::Kept(path, Some(why)) => println!("kept    {path}: {why}"),
            InitLine::Installed(path, count) => println!("created {path} ({})", files(*count)),
            InitLine::Updated(path, count) => println!("updated {path} ({})", files(*count)),
            InitLine::Linked(link, target) => println!("linked  {link} -> {target}"),
        }
    }
    if constitution {
        println!("Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.");
    }
    Ok(ExitCode::SUCCESS)
}

fn files(count: usize) -> String {
    let plural = if count == 1 { "" } else { "s" };
    format!("{count} file{plural}")
}
