//! `ura install`: the skill, for the user in the home folder or in the repository's top level, in
//! `.agents/skills/`, `.claude/skills/`, or both, with each answer from a flag or asked.

use std::path::PathBuf;
use std::process::ExitCode;

use uraeda_core::actions::install::{self, Folders, InstallLine};
use uraeda_core::git::Git;

use crate::picker::{self, Answer, Item, Picker};
use crate::{shell, terminal};

#[derive(clap::Args)]
pub struct Flags {
    /// For your user, in ~/: every repository on this machine
    #[arg(long, conflicts_with = "repo")]
    pub user: bool,
    /// For this repository, at its top level
    #[arg(long)]
    pub repo: bool,
    /// In .agents/skills/uraeda: Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp
    #[arg(long)]
    pub agents: bool,
    /// In .claude/skills/uraeda: Claude Code; a link to .agents/skills/uraeda with --agents
    #[arg(long)]
    pub claude: bool,
    /// Update every copy ura installed, keeping the files you edited
    #[arg(long, conflicts_with_all = ["agents", "claude"])]
    pub update: bool,
    /// Set up Tab completion: in fish, write its file; in zsh, name the line to add. Alone, the
    /// skill is left as it is
    #[arg(long)]
    pub completions: bool,
    /// Never ask: without the flags it needs, fail and name them
    #[arg(long)]
    pub no_input: bool,
}

impl Flags {
    /// Whether only Tab completion is asked for: `--completions` without a flag of the skill.
    fn completions_only(&self) -> bool {
        self.completions && !(self.user || self.repo || self.agents || self.claude || self.update)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scope {
    User,
    Repo,
}

/// An answer: given by a flag, implied by the context, or to ask.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Choice<T> {
    Given(T),
    Implied(T),
    Ask,
}

/// The scope and the folders from the flags, `None` folders with `--update`; outside a
/// repository, the user is implied. Without a terminal, an error naming every missing flag.
pub fn resolve(
    flags: &Flags,
    interactive: bool,
    in_repo: bool,
) -> Result<(Choice<Scope>, Option<Choice<Folders>>), String> {
    let mut missing = Vec::new();
    let scope = if flags.user {
        Choice::Given(Scope::User)
    } else if flags.repo {
        Choice::Given(Scope::Repo)
    } else if !in_repo {
        Choice::Implied(Scope::User)
    } else if interactive {
        Choice::Ask
    } else {
        missing.push("--user or --repo");
        Choice::Ask
    };
    let folders = if flags.update {
        None
    } else if flags.agents || flags.claude {
        Some(Choice::Given(Folders {
            agents: flags.agents,
            claude: flags.claude,
        }))
    } else {
        if !interactive {
            missing.push("--agents, --claude, or both");
        }
        Some(Choice::Ask)
    };
    if !missing.is_empty() {
        return Err(format!(
            "no terminal to ask: pass {}",
            missing.join(", and ")
        ));
    }
    Ok((scope, folders))
}

/// The home folder, from `HOME`; `None` when it is unset or empty.
pub fn home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
}

fn item(label: &str, detail: &str) -> Item {
    Item {
        label: label.to_string(),
        detail: detail.to_string(),
    }
}

/// The scope picker, the user first; `folder` is the name of the repository's top level.
pub fn scope_picker(folder: &str) -> Picker {
    let items = vec![
        item("Your user, in ~/", ": every repository on this machine"),
        item(&format!("This repository, in {folder}/"), ""),
    ];
    Picker::select("Install the Uraeda skill for:", items, 0)
}

/// The folder picker, both checked.
pub fn folders_picker() -> Picker {
    let items = vec![
        item(
            ".agents/skills",
            "Codex, Gemini CLI, Copilot, Cursor, OpenCode, Amp",
        ),
        item(".claude/skills", "Claude Code"),
    ];
    Picker::multi(
        "Into the folders your agents read:",
        items,
        vec![true, true],
    )
}

/// The line a scope leaves, chosen or implied.
pub fn answer_line(scope: Scope) -> String {
    let scope = match scope {
        Scope::User => "your user",
        Scope::Repo => "this repository",
    };
    format!("Install the Uraeda skill for: {scope}")
}

/// The line the folder picker leaves.
pub fn folders_line(folders: Folders) -> String {
    let mut names = Vec::new();
    if folders.agents {
        names.push(".agents/skills");
    }
    if folders.claude {
        names.push(".claude/skills");
    }
    format!("Into: {}", names.join(", "))
}

/// Asks for the folders, and prints the answer line; `None` on a cancel.
pub fn ask_folders() -> Result<Option<Folders>, String> {
    let Some(Answer::Many(checked)) =
        picker::run(folders_picker()).map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };
    let folders = Folders {
        agents: checked[0],
        claude: checked[1],
    };
    println!("{}", folders_line(folders));
    Ok(Some(folders))
}

/// Prints an install's lines, each a verb padded to 8 columns and a path.
pub fn print(lines: &[InstallLine]) {
    for line in lines {
        match line {
            InstallLine::Installed(path, count) => println!("created {path} ({})", files(*count)),
            InstallLine::Updated(path, count) => println!("updated {path} ({})", files(*count)),
            InstallLine::Linked(link, target) => println!("linked  {link} -> {target}"),
            InstallLine::Kept(path, None) => println!("kept    {path}"),
            InstallLine::Kept(path, Some(why)) => println!("kept    {path}: {why}"),
        }
    }
}

fn files(count: usize) -> String {
    let plural = if count == 1 { "" } else { "s" };
    format!("{count} file{plural}")
}

const CANCELLED: &str = "cancelled: nothing installed";

pub fn run(flags: Flags) -> Result<ExitCode, String> {
    if flags.completions_only() {
        shell::set_up(&home().ok_or("HOME is not set: set it")?)?;
        return Ok(ExitCode::SUCCESS);
    }
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let git = Git::discover(&cwd);
    let interactive = terminal::interactive(flags.no_input);
    let (scope, folders) = resolve(&flags, interactive, git.is_ok())?;
    let scope = match scope {
        Choice::Given(scope) => scope,
        Choice::Implied(scope) => {
            println!("{}", answer_line(scope));
            scope
        }
        Choice::Ask => {
            // Asked only in a repository.
            let top = git.as_ref().map_err(|error| error.to_string())?.root();
            let folder = top.file_name().unwrap_or_default().to_string_lossy();
            let scope =
                match picker::run(scope_picker(&folder)).map_err(|error| error.to_string())? {
                    Some(Answer::One(0)) => Scope::User,
                    Some(Answer::One(_)) => Scope::Repo,
                    _ => return Err(CANCELLED.to_string()),
                };
            println!("{}", answer_line(scope));
            scope
        }
    };
    let home = home();
    let top = git.as_ref().ok().map(|git| git.root().to_path_buf());
    let (base, shown, other) = match scope {
        Scope::User => {
            let base = home
                .clone()
                .ok_or("HOME is not set: set it, or pass --repo")?;
            (base, "~/", top.map(|top| (top, "")))
        }
        Scope::Repo => {
            let top = git.map_err(|error| error.to_string())?.root().to_path_buf();
            (top, "", home.clone().map(|home| (home, "~/")))
        }
    };
    let lines = match folders {
        Some(Choice::Given(folders) | Choice::Implied(folders)) => {
            install::install(&base, shown, folders)
        }
        Some(Choice::Ask) => {
            let folders = ask_folders()?.ok_or(CANCELLED)?;
            install::install(&base, shown, folders)
        }
        None => install::update(&base, shown),
    }
    .map_err(|error| error.to_string())?;
    if lines.is_empty() {
        let place = if shown.is_empty() {
            "this repository"
        } else {
            shown
        };
        println!("nothing to update: ura installed no skill in {place}");
        return Ok(ExitCode::SUCCESS);
    }
    print(&lines);
    // A home folder that is the repository's top level has no other scope.
    let same = |other: &PathBuf| other.canonicalize().ok() == base.canonicalize().ok();
    if let Some((other, prefix)) = other.filter(|(other, _)| !same(other)) {
        for path in install::existing(&other) {
            println!(
                "note    another copy in {prefix}{path}: Claude Code reads the user's copy, \
                 other agents the repository's"
            );
        }
    }
    match home {
        Some(home) if flags.completions => shell::set_up(&home)?,
        Some(home) if interactive && !flags.update => shell::offer(&home)?,
        _ => {}
    }
    Ok(ExitCode::SUCCESS)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flags(names: &[&str]) -> Flags {
        let has = |name: &str| names.contains(&name);
        Flags {
            user: has("user"),
            repo: has("repo"),
            agents: has("agents"),
            claude: has("claude"),
            update: has("update"),
            completions: has("completions"),
            no_input: has("no_input"),
        }
    }

    #[test]
    fn resolves_answers() {
        use Choice::{Ask, Given, Implied};
        let agents = Folders {
            agents: true,
            claude: false,
        };
        let both = Folders {
            agents: true,
            claude: true,
        };
        let scope = "no terminal to ask: pass --user or --repo";
        let folders = "no terminal to ask: pass --agents, --claude, or both";
        let all = "no terminal to ask: pass --user or --repo, and --agents, --claude, or both";
        // (flags, interactive, in a repository) → the answers, or the error.
        let rows: &[(&[&str], bool, bool, Result<_, &str>)] = &[
            // Given by flags.
            (
                &["user", "agents", "claude"],
                false,
                true,
                Ok((Given(Scope::User), Some(Given(both)))),
            ),
            (
                &["repo", "agents"],
                false,
                true,
                Ok((Given(Scope::Repo), Some(Given(agents)))),
            ),
            // Scope, in a repository: asked in a terminal, an error otherwise.
            (&["agents"], true, true, Ok((Ask, Some(Given(agents))))),
            (&["agents"], false, true, Err(scope)),
            // Scope, outside one: the user, whether or not in a terminal.
            (
                &["agents"],
                true,
                false,
                Ok((Implied(Scope::User), Some(Given(agents)))),
            ),
            (
                &["agents"],
                false,
                false,
                Ok((Implied(Scope::User), Some(Given(agents)))),
            ),
            // Folders, without --update: asked in a terminal, an error otherwise.
            (&["user"], true, true, Ok((Given(Scope::User), Some(Ask)))),
            (&["user"], false, true, Err(folders)),
            (&[], false, false, Err(folders)),
            // --update takes no folders.
            (
                &["user", "update"],
                false,
                true,
                Ok((Given(Scope::User), None)),
            ),
            (&["update"], false, true, Err(scope)),
            (&["update"], true, true, Ok((Ask, None))),
            // Both missing: one error names both.
            (&[], true, true, Ok((Ask, Some(Ask)))),
            (&[], false, true, Err(all)),
        ];
        for (names, interactive, in_repo, expected) in rows {
            let expected = (*expected).map_err(String::from);
            assert_eq!(
                resolve(&flags(names), *interactive, *in_repo),
                expected,
                "{names:?}, interactive {interactive}, in a repository {in_repo}"
            );
        }
    }

    #[test]
    fn answer_lines() {
        assert_eq!(
            answer_line(Scope::User),
            "Install the Uraeda skill for: your user"
        );
        assert_eq!(
            answer_line(Scope::Repo),
            "Install the Uraeda skill for: this repository"
        );
        let folders = |agents, claude| folders_line(Folders { agents, claude });
        assert_eq!(folders(true, false), "Into: .agents/skills");
        assert_eq!(folders(false, true), "Into: .claude/skills");
        assert_eq!(folders(true, true), "Into: .agents/skills, .claude/skills");
    }
}
