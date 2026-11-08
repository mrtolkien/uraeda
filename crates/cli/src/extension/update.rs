//! `ura extension update`: fetches the branch or tag an installed extension follows, prints the
//! diff, and moves it only once confirmed.

use std::fmt::Write;
use std::process::ExitCode;

use uraeda_core::extensions::install;

use super::{Folders, short, title};
use crate::picker::{self, Answer, Item, Picker};
use crate::terminal;

pub fn run(folders: &Folders, name: &str, yes: bool) -> Result<ExitCode, String> {
    let title = title(folders, name);
    let pending = install::update(&folders.config, name).map_err(|error| error.message)?;
    let (from, to) = (short(&pending.from), short(&pending.to));
    if pending.from == pending.to {
        println!("{title} is up to date at {from}");
        return Ok(ExitCode::SUCCESS);
    }
    println!("{title}: {from} -> {to}");
    print!("{}", visible(&pending.diff));
    let moves = if yes {
        true
    } else if terminal::interactive(false) {
        ask(&title, from, to)?
    } else {
        println!("{title} stays at {from}: pass --yes to move it");
        return Ok(ExitCode::SUCCESS);
    };
    if moves {
        install::apply(&folders.config, name, &pending.to).map_err(|error| error.message)?;
        println!("Moved {title} to {to}");
    } else {
        println!("{title} stays at {from}");
    }
    Ok(ExitCode::SUCCESS)
}

/// `diff`, the untrusted files of a commit not checked out yet, with its control characters but
/// newlines and tabs made visible, so none moves the cursor, retitles the terminal, or hides a
/// line: `^[` for escape, `^?` for delete, `\u{9b}` for the other ones.
fn visible(diff: &str) -> String {
    let mut shown = String::with_capacity(diff.len());
    for character in diff.chars() {
        match character {
            '\n' | '\t' => shown.push(character),
            '\u{0}'..='\u{1f}' => {
                shown.push('^');
                shown.extend(char::from_u32(u32::from(character) + 0x40));
            }
            '\u{7f}' => shown.push_str("^?"),
            _ if character.is_control() => {
                let _ = write!(shown, "\\u{{{:x}}}", u32::from(character));
            }
            _ => shown.push(character),
        }
    }
    shown
}

/// Asks whether to move, keeping the commit by default; a cancel keeps it.
fn ask(title: &str, from: &str, to: &str) -> Result<bool, String> {
    let item = |label: String| Item {
        label,
        detail: String::new(),
    };
    let items = vec![
        item(format!("No, stay at {from}")),
        item(format!("Yes, move to {to}")),
    ];
    let question = format!("Move {title} to {to}?");
    let answer =
        picker::run(Picker::select(&question, items, 0)).map_err(|error| error.to_string())?;
    let moves = answer == Some(Answer::One(1));
    println!("{question} {}", if moves { "yes" } else { "no" });
    Ok(moves)
}
