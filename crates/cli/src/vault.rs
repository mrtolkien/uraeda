//! `ura vault`: the human's notes, read and written for an agent, in the vault the settings name
//! (`[vault] path`), else `Uraeda` in Uraeda's data folder. It never touches git.

use std::io::Read;
use std::process::ExitCode;

use clap::Subcommand;
use uraeda_core::repositories::default_data_dir;
use uraeda_core::settings::default_config_dir;
use uraeda_vault::{Vault, check, layout, notes};

#[derive(clap::Args)]
pub struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// List a folder's folders and notes, each note with its description
    Ls {
        /// The folder, from the vault's: the vault itself without it
        #[arg(default_value = "")]
        path: String,
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
    /// Print a note
    Read {
        /// The note, from the vault's folder: `wiki/apps/todoist.md`
        path: String,
    },
    /// Write a note from standard input, or set one frontmatter field and leave the rest as it was
    Write {
        /// The note, from the vault's folder: `inbox/sort-completed-tasks.md`
        path: String,
        /// Set this field instead, as `name=value`: `--set status=started`
        #[arg(long, value_name = "FIELD=VALUE")]
        set: Option<String>,
    },
    /// Delete a note: it moves to the vault's `.trash/`
    Rm {
        /// The note, from the vault's folder
        path: String,
    },
    /// Report wikilinks that resolve to no note, and wiki notes without a description
    Check {
        /// Print JSON
        #[arg(long)]
        json: bool,
    },
}

pub fn run(args: Args) -> Result<ExitCode, String> {
    let vault =
        Vault::locate(&default_config_dir(), &default_data_dir()).map_err(|e| e.to_string())?;
    if !matches!(args.command, Command::Write { .. }) && !vault.root().is_dir() {
        return Err(format!(
            "no vault at {}: `ura serve` or `ura vault write` makes it",
            vault.root().display()
        ));
    }
    match args.command {
        Command::Ls { path, json } => {
            let entries = notes::ls(&vault, &path).map_err(|e| e.to_string())?;
            if json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&entries).unwrap_or_default()
                );
            } else {
                for entry in entries {
                    match entry.description {
                        Some(description) => println!("{}  {description}", entry.path),
                        None => println!("{}", entry.path),
                    }
                }
            }
        }
        Command::Read { path } => {
            print!("{}", notes::read(&vault, &path).map_err(|e| e.to_string())?);
        }
        Command::Write { path, set } => {
            layout::ensure(&vault, &[]).map_err(|e| e.to_string())?;
            match set {
                Some(assignment) => notes::set(&vault, &path, &assignment),
                None => {
                    let mut bytes = Vec::new();
                    std::io::stdin()
                        .read_to_end(&mut bytes)
                        .map_err(|e| e.to_string())?;
                    notes::write(&vault, &path, &bytes)
                }
            }
            .map_err(|e| e.to_string())?;
        }
        Command::Rm { path } => notes::rm(&vault, &path).map_err(|e| e.to_string())?,
        Command::Check { json } => {
            let problems = check::check(&vault);
            if json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&problems).unwrap_or_default()
                );
            } else {
                problems.iter().for_each(|p| println!("{p}"));
            }
            if !problems.is_empty() {
                return Ok(ExitCode::FAILURE);
            }
        }
    }
    Ok(ExitCode::SUCCESS)
}
