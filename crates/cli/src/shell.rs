//! Tab completion set up in the user's shell, from `$SHELL`: in fish, ura writes its own file,
//! `ura.fish` in fish's completions folder; in zsh, whose completion is a line in `~/.zshrc`, it
//! names the line to add.

use std::fs;
use std::path::{Path, PathBuf};

use crate::picker::{self, Answer, Item, Picker};

const FISH_LINE: &str = "COMPLETE=fish ura | source";
const ZSH_LINE: &str = "source <(COMPLETE=zsh ura)";
const QUESTION: &str = "Set up Tab completion for ura in fish?";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shell {
    Fish,
    Zsh,
    Other,
}

/// The user's shell, from `$SHELL`, and its name.
fn shell() -> (Shell, String) {
    let path = std::env::var("SHELL").unwrap_or_default();
    let name = Path::new(&path)
        .file_name()
        .map_or(String::new(), |name| name.to_string_lossy().into_owned());
    let shell = match name.as_str() {
        "fish" => Shell::Fish,
        "zsh" => Shell::Zsh,
        _ => Shell::Other,
    };
    (shell, name)
}

/// fish's completions folder: in `$XDG_CONFIG_HOME`, else in `~/.config`.
fn fish_file(home: &Path) -> PathBuf {
    std::env::var_os("XDG_CONFIG_HOME")
        .filter(|config| !config.is_empty())
        .map_or_else(|| home.join(".config"), PathBuf::from)
        .join("fish/completions/ura.fish")
}

/// A path under the home folder, shown from `~/`.
fn shown(path: &Path, home: &Path) -> String {
    path.strip_prefix(home).map_or_else(
        |_| path.display().to_string(),
        |rest| format!("~/{}", rest.display()),
    )
}

/// Sets Tab completion up, and prints what it did.
pub fn set_up(home: &Path) -> Result<(), String> {
    match shell() {
        (Shell::Fish, _) => write_fish(home),
        (Shell::Zsh, _) => {
            println!("note    Tab completion in zsh: add `{ZSH_LINE}` to ~/.zshrc, after compinit");
            Ok(())
        }
        (Shell::Other, name) if name.is_empty() => {
            println!("note    Tab completion: SHELL is not set, so ura cannot tell fish from zsh");
            Ok(())
        }
        (Shell::Other, name) => {
            println!("note    Tab completion: ura sets it up in fish and zsh, not in {name}");
            Ok(())
        }
    }
}

fn write_fish(home: &Path) -> Result<(), String> {
    let file = fish_file(home);
    let path = shown(&file, home);
    // Read as bytes: a file that is not UTF-8 is still someone's, never overwritten.
    match fs::read(&file) {
        Ok(bytes) if bytes.trim_ascii() == FISH_LINE.as_bytes() => println!("kept    {path}"),
        Ok(_) => println!("kept    {path}: not written by ura, add `{FISH_LINE}` to it"),
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
            return Err(format!("{path}: {error}"));
        }
        Err(_) => {
            let folder = file.parent().unwrap_or(home);
            fs::create_dir_all(folder)
                .and_then(|()| fs::write(&file, format!("{FISH_LINE}\n")))
                .map_err(|error| format!("{path}: {error}"))?;
            println!("created {path}");
        }
    }
    Ok(())
}

/// What a terminal install offers: in fish, without its file, to write it; in zsh, the line to
/// add, since ura cannot tell whether `~/.zshrc` has it. Neither looks for a package's script:
/// a fish file of the user's own only shadows it, with the same script.
pub fn offer(home: &Path) -> Result<(), String> {
    match shell().0 {
        Shell::Fish if !fish_file(home).exists() => ask(home),
        Shell::Zsh => set_up(home),
        Shell::Fish | Shell::Other => Ok(()),
    }
}

/// The question a terminal install asks in fish, yes first.
fn picker() -> Picker {
    let items = vec![
        Item {
            label: "Yes".to_string(),
            detail: ": complete ura's commands, drafts, and features with Tab".to_string(),
        },
        Item {
            label: "No".to_string(),
            detail: String::new(),
        },
    ];
    Picker::select(QUESTION, items, 0)
}

/// Asks, then sets Tab completion up on a yes; nothing on a no or a cancel.
fn ask(home: &Path) -> Result<(), String> {
    match picker::run(picker()).map_err(|error| error.to_string())? {
        Some(Answer::One(0)) => {
            println!("{QUESTION} yes");
            set_up(home)
        }
        Some(_) => {
            println!("{QUESTION} no");
            Ok(())
        }
        None => Ok(()),
    }
}
