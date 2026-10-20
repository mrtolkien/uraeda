//! Tab completion: `ura` answers the shell's `COMPLETE=<shell>` requests, with the repository's
//! drafts, features, inbox categories, and open questions as values. It reads local branches and
//! files only, never `gh`, so that a Tab stays fast.

use std::ffi::{OsStr, OsString};
use std::io::{self, Write};
use std::path::Path;

use clap_complete::engine::{ArgValueCandidates, ArgValueCompleter, CompletionCandidate};
use clap_complete::engine::{PathCompleter, ValueCompleter};
use clap_complete::env::EnvCompleter;
use uraeda_core::actions::answer;
use uraeda_core::files::clarifications;
use uraeda_core::files::inbox;
use uraeda_core::target::{self, Purpose, Target};
use uraeda_core::workspace::{Feature, Workspace};

use crate::{clean, output};

/// Answers a completion request and exits, when the shell sent one.
pub fn answer() {
    use clap_complete::env::{Bash, Elvish, Fish, Powershell, Shells};
    clap_complete::CompleteEnv::with_factory(<crate::Cli as clap::CommandFactory>::command)
        .shells(Shells(&[&Bash, &Elvish, &Fish, &Powershell, &Zsh]))
        .complete();
}

/// clap's zsh script, which also completes when zsh autoloads it as `_ura` from `fpath`, as
/// packages install it. clap's alone only registers itself on that first Tab, and completes from
/// the second.
struct Zsh;

impl EnvCompleter for Zsh {
    fn name(&self) -> &'static str {
        clap_complete::env::Zsh.name()
    }

    fn is(&self, name: &str) -> bool {
        clap_complete::env::Zsh.is(name)
    }

    fn write_registration(
        &self,
        var: &str,
        name: &str,
        bin: &str,
        completer: &str,
        buf: &mut dyn Write,
    ) -> io::Result<()> {
        clap_complete::env::Zsh.write_registration(var, name, bin, completer, buf)?;
        // The function clap's script defines.
        let function = format!("_clap_dynamic_completer_{}", name.replace('-', "_"));
        writeln!(
            buf,
            "if [ \"$funcstack[1]\" = \"_{name}\" ]; then\n    {function} \"$@\"\nfi"
        )
    }

    fn write_complete(
        &self,
        cmd: &mut clap::Command,
        args: Vec<OsString>,
        current_dir: Option<&Path>,
        buf: &mut dyn Write,
    ) -> io::Result<()> {
        clap_complete::env::Zsh.write_complete(cmd, args, current_dir, buf)
    }
}

/// The workspace, without its pull requests; `None` outside a repository with `specs/`.
fn workspace() -> Option<Workspace> {
    output::workspace().ok().map(|(_, workspace)| workspace)
}

/// A feature or change, by its slug, with its folder as help.
fn feature(feature: &Feature) -> CompletionCandidate {
    CompletionCandidate::new(&feature.slug).help(Some(feature.folder.clone().into()))
}

fn started_in(workspace: &Workspace) -> Vec<CompletionCandidate> {
    workspace
        .features
        .iter()
        .filter(|feature| !feature.is_finished())
        .map(feature)
        .collect()
}

/// The features and changes still under way: `next`, `review`, `note --about`.
pub fn started() -> ArgValueCandidates {
    ArgValueCandidates::new(|| workspace().map(|w| started_in(&w)).unwrap_or_default())
}

/// The drafts and postponed folders: `start`.
pub fn drafts() -> ArgValueCandidates {
    ArgValueCandidates::new(|| {
        let Some(workspace) = workspace() else {
            return Vec::new();
        };
        workspace
            .drafts
            .iter()
            .map(|draft| {
                CompletionCandidate::new(target::draft_name(draft)).help(Some(draft.clone().into()))
            })
            .collect()
    })
}

/// The merged features with a worktree or a branch left: `clean`.
pub fn merged() -> ArgValueCandidates {
    ArgValueCandidates::new(|| {
        let Some(workspace) = workspace() else {
            return Vec::new();
        };
        clean::candidates(&workspace)
            .into_iter()
            .map(feature)
            .collect()
    })
}

/// The inbox's categories: `note --category`.
pub fn categories() -> ArgValueCandidates {
    ArgValueCandidates::new(|| {
        let text = workspace().and_then(|workspace| workspace.inbox);
        inbox::read(text.as_deref().unwrap_or_default())
            .names
            .into_iter()
            .map(CompletionCandidate::new)
            .collect()
    })
}

/// The features and changes under way, then files and folders: `check`.
pub fn checked() -> ArgValueCompleter {
    ArgValueCompleter::new(|current: &OsStr| {
        let mut candidates = workspace().map(|w| started_in(&w)).unwrap_or_default();
        candidates.retain(|candidate| starts_with(candidate, current));
        candidates.extend(PathCompleter::any().complete(current));
        candidates
    })
}

/// The rounds waiting for answers, by their feature's slug, then the open questions of the round
/// `ura answer` would pick. Once a target is typed, its round's open questions alone, and once a
/// question is, nothing: the next word is the answer. `answer`'s arguments.
pub fn questions() -> ArgValueCandidates {
    ArgValueCandidates::new(|| {
        let typed = Typed::read();
        let Some(workspace) = workspace().filter(|_| !typed.question) else {
            return Vec::new();
        };
        let cwd = std::env::current_dir().unwrap_or_default();
        let target = typed.target.as_deref();
        let picked = match target::resolve(&workspace, &cwd, target, Purpose::Answers) {
            Ok(Target::Feature(index) | Target::File(index, _))
                if target::waits_for(&workspace.features[index], Purpose::Answers) =>
            {
                open_questions(&workspace.features[index])
            }
            _ => Vec::new(),
        };
        if target.is_some() {
            return picked;
        }
        workspace
            .features
            .iter()
            .filter(|feature| target::waits_for(feature, Purpose::Answers))
            .map(feature)
            .chain(picked)
            .collect()
    })
}

/// The words typed after `answer`, before the one being completed. clap gives a completer that
/// word alone, so they are read from the words the shell passed, `ura -- ura answer <target>
/// <word>`, the word's index in `_CLAP_COMPLETE_INDEX` from zsh and bash, last from fish.
#[derive(Default)]
struct Typed {
    target: Option<String>,
    question: bool,
}

impl Typed {
    fn read() -> Typed {
        let words: Vec<String> = std::env::args()
            .skip_while(|arg| arg != "--")
            .skip(1)
            .collect();
        let current = std::env::var("_CLAP_COMPLETE_INDEX")
            .ok()
            .and_then(|index| index.parse().ok())
            .unwrap_or(words.len().saturating_sub(1));
        let before = words.get(..current).unwrap_or_default();
        let Some(answer) = before.iter().position(|word| word == "answer") else {
            return Typed::default();
        };
        let typed = before[answer + 1..]
            .iter()
            .filter(|word| !word.starts_with('-'));
        let (questions, targets): (Vec<&String>, Vec<&String>) =
            typed.partition(|word| crate::answer::is_question(word));
        Typed {
            target: targets.first().map(|target| (*target).clone()),
            question: !questions.is_empty(),
        }
    }
}

/// The questions of a feature's latest round still without an answer, then its notes.
fn open_questions(feature: &Feature) -> Vec<CompletionCandidate> {
    let Some(text) = answer::round_path(feature)
        .ok()
        .and_then(|path| feature.text(answer::name_of(&path)).map(String::from))
    else {
        return Vec::new();
    };
    let all = clarifications::parse(&text);
    all.iter()
        .filter(|question| question.answer.is_empty() && question.asked(&all))
        .map(|question| {
            CompletionCandidate::new(&question.id).help(Some(question.title.clone().into()))
        })
        .chain([CompletionCandidate::new("notes").help(Some("The round's notes".into()))])
        .collect()
}

fn starts_with(candidate: &CompletionCandidate, current: &OsStr) -> bool {
    candidate
        .get_value()
        .to_string_lossy()
        .starts_with(&*current.to_string_lossy())
}
