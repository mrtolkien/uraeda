//! `ura inbox`: the inbox of the default branch printed, and what is done to the images its notes
//! hold.

use std::process::ExitCode;

use clap::Subcommand;
use serde::Serialize;
use uraeda_core::api;
use uraeda_core::files::document::plain;
use uraeda_core::files::inbox::{Inbox, InboxNote};

use crate::output;

#[derive(clap::Args)]
#[command(args_conflicts_with_subcommands = true)]
pub struct Args {
    #[command(subcommand)]
    command: Option<Command>,
    /// Print JSON
    #[arg(long)]
    json: bool,
}

#[derive(Subcommand)]
pub enum Command {
    /// Delete the images of proposal files and of note files that no file of their folder links
    Clean {
        /// Print what would be deleted, and delete nothing
        #[arg(long)]
        dry_run: bool,
    },
}

pub fn run(args: Args) -> Result<ExitCode, String> {
    match args.command {
        Some(Command::Clean { dry_run }) => clean(dry_run),
        None => print(args.json),
    }
}

/// The JSON of `ura inbox`: every note, in the order the text lists them.
#[derive(Serialize)]
struct Listing<'a> {
    notes: Vec<Note<'a>>,
}

/// A note of `ura inbox --json`: `None` prints as `null`. `text` is the plain text `ura inbox`
/// prints: a note file's title, not its link.
#[derive(Serialize)]
struct Note<'a> {
    category: Option<&'a str>,
    text: String,
    agent: bool,
    about: Option<&'a str>,
    file: Option<&'a str>,
}

/// Prints the inbox: the notes without a category first, then each category's name and its notes,
/// a blank line between groups.
fn print(json: bool) -> Result<ExitCode, String> {
    let (git, _) = output::workspace()?;
    let inbox = api::read_inbox(git.root()).map_err(|error| error.message)?;
    if json {
        output::print_json(&listing(&inbox));
    } else {
        print!("{}", render(&inbox));
    }
    Ok(ExitCode::SUCCESS)
}

fn listing(inbox: &Inbox) -> Listing<'_> {
    let notes = inbox
        .categories
        .iter()
        .flat_map(|category| {
            category.notes.iter().map(|note| Note {
                category: category.name.as_deref(),
                text: plain(&note.spans),
                agent: note.agent,
                about: note.about.as_deref(),
                file: note.file.as_deref(),
            })
        })
        .collect();
    Listing { notes }
}

fn render(inbox: &Inbox) -> String {
    let groups: Vec<String> = inbox
        .categories
        .iter()
        .map(|category| {
            let mut text = category
                .name
                .as_ref()
                .map(|name| format!("{}\n", output::style(output::Style::Bold, name)))
                .unwrap_or_default();
            for note in &category.notes {
                text.push_str(&line(note));
            }
            text
        })
        .collect();
    groups.join("\n")
}

/// `- `, `[agent] ` when marked, `[<slug>] ` when about one, and the note's plain text: a note
/// file's title.
fn line(note: &InboxNote) -> String {
    let agent = if note.agent { "[agent] " } else { "" };
    let about = note
        .about
        .as_ref()
        .map(|slug| format!("[{slug}] "))
        .unwrap_or_default();
    format!("- {agent}{about}{}\n", plain(&note.spans))
}

/// Lists the unlinked images, one path a line, and deletes them unless `dry_run`: the deletion is
/// left for the human to commit.
fn clean(dry_run: bool) -> Result<ExitCode, String> {
    let (git, _) = output::workspace()?;
    let found = api::clean_images(git.root(), dry_run).map_err(|error| error.message)?;
    for path in &found {
        println!("{path}");
    }
    eprintln!(
        "{}",
        match (found.len(), dry_run) {
            (0, _) => "no unlinked images".to_string(),
            (1, true) => "1 unlinked image: run again without --dry-run to delete it".to_string(),
            (count, true) => {
                format!("{count} unlinked images: run again without --dry-run to delete them")
            }
            (1, false) => "removed 1 unlinked image".to_string(),
            (count, false) => format!("removed {count} unlinked images"),
        }
    );
    Ok(ExitCode::SUCCESS)
}
