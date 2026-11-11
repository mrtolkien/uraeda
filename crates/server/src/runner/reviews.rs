//! The reviews of a feature, as the run options decision says: every reviewer of a review runs
//! at once, an agent through its own review in a sub-session of the feature, a command the
//! human wrote in the feature's worktree, and their findings are committed in `findings-NN.md`
//! before they are fixed.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use uraeda_core::actions::findings::{Findings, FindingsSection};
use uraeda_core::api;
use uraeda_protocol::ErrorCode;

use super::manager::Runner;
use super::picks::{Reviewer, StepPick, to_map};
use super::session::Session;
use super::sub_sessions::SubStart;
use crate::live::{Fault, locked};
use crate::mcp::{self, Answer, Review, RunAgent};
use crate::records::writing::{self, Write, land};
use crate::runtimes::{Child, ReviewAsk, ReviewMessage, Spawn};

/// The answer of a wave's review on a feature whose reviews run on the branch only.
const BRANCH_ONLY: &str = "No review: this feature's reviews run on the branch only.";

/// Findings a hook refused to commit: what the reviewers gave, and their file, from the top
/// level, when the refusal left it written.
#[derive(Clone)]
struct Unsaved {
    findings: Findings,
    path: Option<String>,
}

/// The tools the agents' MCP endpoint runs for the sessions: `run_agent` and `review`.
pub(super) struct Tools {
    runner: Runner,
    /// The findings a hook refused to commit, by their review: the same review asked again
    /// commits them instead of running its reviewers again.
    unsaved: Arc<Mutex<HashMap<String, Unsaved>>>,
}

impl Tools {
    pub(super) fn of(runner: Runner) -> Tools {
        Tools {
            runner,
            unsaved: Arc::default(),
        }
    }
}

impl mcp::Runner for Tools {
    fn run_agent(&self, session: &str, input: RunAgent) -> Answer {
        Box::pin(self.runner.clone().run_agent(session.to_owned(), input))
    }

    fn review(&self, session: &str, input: Review) -> Answer {
        let (runner, unsaved) = (self.runner.clone(), self.unsaved.clone());
        Box::pin(review(runner, unsaved, session.to_owned(), input))
    }
}

/// What answers the tools once the server stops.
pub(super) struct Stopped;

impl mcp::Runner for Stopped {
    fn run_agent(&self, _: &str, _: RunAgent) -> Answer {
        Box::pin(async { Err("The server is stopping.".to_owned()) })
    }

    fn review(&self, _: &str, _: Review) -> Answer {
        Box::pin(async { Err("The server is stopping.".to_owned()) })
    }
}

/// A review to run: what it reviews, its commits by their full ids, where, and who asked.
struct Asked {
    reviewed: String,
    base: String,
    head: String,
    context: Option<String>,
    cwd: PathBuf,
    parent: Session,
    folder: String,
}

/// The key of a review's findings: its feature, what it reviewed, and its commits.
fn key(asked: &Asked) -> String {
    let commits = format!("{}..{}", asked.base, asked.head);
    [
        asked.parent.repo.as_str(),
        &asked.folder,
        &asked.reviewed,
        &commits,
    ]
    .join("\0")
}

/// Runs `review` for the workflow session `parent`: on a feature whose reviews run on the
/// branch only, a wave's review runs nothing; else every reviewer at once, each giving its
/// section, a reviewer that fails saying why, then the findings committed. Answers with the
/// file's path and its text. Counted as the parent's call: its watchdog waits meanwhile. It
/// ends its reviewers and writes nothing once the call is dropped, or the parent's turn halts.
async fn review(
    runner: Runner,
    unsaved: Arc<Mutex<HashMap<String, Unsaved>>>,
    parent: String,
    input: Review,
) -> Result<String, String> {
    let (_counted, mut halted) = runner.counted(&parent);
    let reviewing = async {
        let blocking = runner.clone();
        let read = tokio::task::spawn_blocking(move || blocking.asked(&parent, input));
        let lost = |_| "The review could not start.".to_owned();
        let (asked, reviewers) = match read.await.map_err(lost)? {
            Ok(Some(asked)) => asked,
            Ok(None) => return Ok(BRANCH_ONLY.to_owned()),
            Err(fault) => return Err(fault.message().to_owned()),
        };
        let key = key(&asked);
        let kept = locked(&unsaved).get(&key).cloned();
        let found = match kept {
            Some(kept) => kept,
            None => {
                let names: Vec<String> = reviewers
                    .iter()
                    .map(|reviewer| runner.reviewer_name(reviewer))
                    .collect();
                let sections = reviewers.iter().enumerate().map(|(index, reviewer)| {
                    section(&runner, &asked, reviewer, unique_name(&names, index))
                });
                let sections = futures_util::future::join_all(sections).await;
                let commits = format!("{}..{}", asked.base, asked.head);
                let findings = Findings {
                    reviewed: asked.reviewed.clone(),
                    commits,
                    sections,
                };
                Unsaved {
                    findings,
                    path: None,
                }
            }
        };
        let saving = runner.clone();
        let saved = tokio::task::spawn_blocking(move || saving.save(&unsaved, &key, &asked, found));
        let lost = |_| "The findings could not be saved.".to_owned();
        saved
            .await
            .map_err(lost)?
            .map_err(|fault| fault.message().to_owned())
    };
    tokio::select! {
        answer = reviewing => answer,
        _ = halted.wait_for(|halted| *halted) => Err("The call was cancelled.".to_owned()),
    }
}

/// A reviewer's section: its findings, or why it did not review.
async fn section(
    runner: &Runner,
    asked: &Asked,
    reviewer: &Reviewer,
    name: String,
) -> FindingsSection {
    let found = match reviewer {
        Reviewer::Command(command) => run_command(runner, command, &asked.cwd).await,
        Reviewer::Agent { pick, instructions } => {
            agent_review(runner, asked, pick, instructions.as_deref(), &name).await
        }
    };
    let text = match found {
        Ok(text) if text.trim().is_empty() => "No findings given.".to_owned(),
        Ok(text) => text.trim().to_owned(),
        Err(why) => format!("Did not review: {why}"),
    };
    FindingsSection {
        reviewer: name,
        text,
    }
}

/// An agent reviewer's findings: its last message, from a sub-session of the parent in the
/// feature's worktree, on its pick, given the agent's own review of the range, at its effort,
/// else its model's default.
async fn agent_review(
    runner: &Runner,
    asked: &Asked,
    pick: &StepPick,
    instructions: Option<&str>,
    name: &str,
) -> Result<String, String> {
    let (starting, parent) = (runner.clone(), asked.parent.clone());
    let (pick, cwd) = (pick.clone(), asked.cwd.clone());
    let texts = [asked.context.as_deref(), instructions];
    let added: Vec<&str> = texts
        .into_iter()
        .flatten()
        .filter(|text| !text.trim().is_empty())
        .collect();
    let added = Some(added.join("\n\n")).filter(|added| !added.is_empty());
    let (base, head) = (asked.base.clone(), asked.head.clone());
    let about = format!("{name} on {base}..{head}");
    let started = tokio::task::spawn_blocking(move || {
        let picked = starting.reviewer_pick(&parent.repo, &pick)?;
        let runtimes = starting.runtimes();
        let listed = runtimes.models(&pick.runtime);
        let effort = pick.effort.clone().or_else(|| listed?.defaults.effort);
        let ask = ReviewAsk {
            base,
            head,
            effort,
            instructions: added,
        };
        let own = runtimes
            .get(&pick.runtime)
            .and_then(|runtime| runtime.review_message(&ask));
        let message = own.unwrap_or_else(|| plain_review(&ask));
        let start = SubStart {
            about,
            cwd,
            message: message.text,
            pick: picked,
            review: message.review,
        };
        starting.start_sub(&parent.id, "reviewer", start)
    });
    let sub = match started.await {
        Ok(started) => started.map_err(|fault| fault.message().to_owned())?,
        Err(_) => return Err("the reviewer could not start".to_owned()),
    };
    runner.idle(&sub.id).await;
    let answering = runner.clone();
    let answered = tokio::task::spawn_blocking(move || answering.answer(&sub));
    answered
        .await
        .unwrap_or_else(|_| Err("the reviewer's answer was lost".to_owned()))
}

/// A review asked in plain words, for an agent without a review of its own.
fn plain_review(ask: &ReviewAsk) -> ReviewMessage {
    let range = format!("{}..{}", ask.base, ask.head);
    let prompt = format!(
        "Review the code changes of the commits {range}, from `git diff {range}`, without \
         changing any file. Answer with your findings only, as a list, most important first, \
         each with its file and line."
    );
    let text = match &ask.instructions {
        Some(instructions) => format!("{prompt}\n\n{instructions}"),
        None => prompt,
    };
    ReviewMessage {
        text,
        review: false,
    }
}

/// What ends a command reviewer when its review is dropped.
struct Ended(Child);

impl Drop for Ended {
    fn drop(&mut self) {
        self.0.end_short();
    }
}

/// Runs a command reviewer, `sh -c <command>` in `cwd`, its stdin closed: its output, stdout
/// and stderr as they came, and its exit code when it failed.
async fn run_command(runner: &Runner, command: &str, cwd: &Path) -> Result<String, String> {
    let spawn = Spawn {
        program: "sh".to_owned(),
        // Both outputs on one stream, in the order the command wrote them.
        args: vec!["-c".to_owned(), format!("exec 2>&1\n{command}")],
        cwd: cwd.to_owned(),
        env: Vec::new(),
    };
    let mut child = Ended(Child::spawn(&runner.shared, spawn));
    child.0.end_input();
    let mut lines = child.0.lines();
    let mut output = String::new();
    while let Some(line) = lines.next().await {
        output.push_str(&line);
        output.push('\n');
    }
    let exit = child.0.exited().await;
    let super::event::Event::Exit { code, stderr, .. } = exit else {
        return Ok(output);
    };
    match code {
        None => Err(Some(stderr)
            .filter(|stderr| !stderr.is_empty())
            .unwrap_or_else(|| format!("{command} did not run."))),
        Some(0) => Ok(output),
        Some(code) => Ok(format!("{}\n\nexit code {code}", output.trim_end())),
    }
}

/// The name of the reviewer at `index`, numbered after the first reviewer of the same name.
fn unique_name(names: &[String], index: usize) -> String {
    let name = &names[index];
    let before = names[..index].iter().filter(|one| *one == name).count();
    match before {
        0 => name.clone(),
        before => format!("{name} ({})", before + 1),
    }
}

/// The answer of a review whose findings are committed: their file's path, then their text.
fn answer_of(file: &Path) -> Result<String, Fault> {
    let text = fs::read_to_string(file);
    let text = text.map_err(|error| Fault::internal(format!("{}: {error}", file.display())))?;
    Ok(format!("{}\n\n{text}", file.display()))
}

impl Runner {
    /// What a review asked for reviews, and by whom: none on a feature whose reviews run on
    /// the branch only, for a wave's review.
    fn asked(&self, parent: &str, input: Review) -> Result<Option<(Asked, Vec<Reviewer>)>, Fault> {
        let row = self.store().session(parent)?;
        let only = || Fault::refused("Only a workflow session of a feature runs reviews.");
        let row = row.filter(|row| row.parent.is_none()).ok_or_else(only)?;
        let folder = row.folder.clone().ok_or_else(only)?;
        let fallback = self
            .runtime_for(&row.repo, None)
            .unwrap_or_else(|| row.agent.clone());
        let map = to_map(&self.run_options(&row.repo, &folder), &fallback);
        if map.branch_only && input.reviewed != "branch" {
            return Ok(None);
        }
        let cwd = PathBuf::from(api::work_dir(Path::new(&row.repo), &folder)?);
        // Each commit by its full id, as the worktree has it now: a name, like `HEAD`, asked
        // again after a new commit is another range, whose reviewers run again.
        let base = api::resolve_commit(&cwd, &input.base)?;
        let head = api::resolve_commit(&cwd, &input.head)?;
        let asked = Asked {
            reviewed: input.reviewed,
            base,
            head,
            context: input.context,
            cwd,
            parent: row,
            folder,
        };
        Ok(Some((asked, map.reviewers)))
    }

    /// A reviewer's name, as the run map shows it: its agent's and its model's names for
    /// people, the agent's default model's when it picks none; a command's own text.
    fn reviewer_name(&self, reviewer: &Reviewer) -> String {
        let pick = match reviewer {
            Reviewer::Command(command) => return command.clone(),
            Reviewer::Agent { pick, .. } => pick,
        };
        let agent = self.runtime_name(&pick.runtime);
        let list = self.runtimes().models(&pick.runtime);
        let defaults = list.as_ref().and_then(|list| list.defaults.model.clone());
        let Some(id) = pick.model.clone().or(defaults) else {
            return agent;
        };
        let listed = list.and_then(|list| list.models.into_iter().find(|one| one.id == id));
        format!("{agent} · {}", listed.map_or(id, |model| model.name))
    }

    /// Writes and commits a review's findings, or commits again their file a hook's refusal
    /// left written, through the repository's write queue, answering once the commit landed.
    /// Answers with the file's path and its text; on a hook's refusal, keeps them under `key`
    /// and answers that they are not committed, with the hook's output.
    fn save(
        &self,
        unsaved: &Mutex<HashMap<String, Unsaved>>,
        key: &str,
        asked: &Asked,
        found: Unsaved,
    ) -> Result<String, Fault> {
        let none = || Fault::refused("This repository left the list.");
        let repository = self.name_of(&asked.parent.repo).ok_or_else(none)?;
        let folder = asked.folder.clone();
        let (findings, path) = (found.findings.clone(), found.path.clone());
        let write = Write::of_feature(&folder).or_named("Committing a review's findings", "");
        let landing = land(
            &self.shared,
            &repository,
            write,
            move |root, _| match &path {
                None => Ok(api::write_findings(root, &folder, &findings)?),
                Some(path) => {
                    let name = Path::new(path)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy();
                    api::retry_commit(root, &folder, &name)?;
                    Ok(path.clone())
                }
            },
        )?;
        // Its commit lands behind the write, with the hooks: the answer waits for it.
        let landed = landing.answered().and_then(|saved| {
            writing::settled(&self.shared, &repository, &asked.folder)?;
            Ok(saved)
        });
        match landed {
            Ok(saved) => {
                locked(unsaved).remove(key);
                answer_of(&asked.cwd.join(saved))
            }
            Err(fault) if fault.code() == ErrorCode::Hook => {
                // The refusal left the file written: the same review asked again commits it.
                let left = found.path.or_else(|| self.last_findings(asked));
                let answer = match &left {
                    Some(left) => {
                        let file = asked.cwd.join(left);
                        format!(
                            "{}\n\nwritten, not committed: {}",
                            file.display(),
                            fault.message()
                        )
                    }
                    None => format!("not committed: {}", fault.message()),
                };
                let kept = Unsaved {
                    findings: found.findings,
                    path: left,
                };
                locked(unsaved).insert(key.to_owned(), kept);
                Ok(answer)
            }
            Err(fault) => {
                locked(unsaved).remove(key);
                Err(fault)
            }
        }
    }

    /// The path, from the top level, of the feature's last findings in its worktree: the ones
    /// just written, which a hook refused to commit.
    fn last_findings(&self, asked: &Asked) -> Option<String> {
        let root = Path::new(&asked.parent.repo);
        let feature = api::read_feature(root, &asked.folder).ok()?;
        let entries = fs::read_dir(asked.cwd.join(&feature.path)).ok()?;
        let round = |name: &str| {
            let digits = name.strip_prefix("findings-")?.strip_suffix(".md")?;
            digits.parse::<u32>().ok()
        };
        let names = entries.filter_map(|entry| entry.ok()?.file_name().into_string().ok());
        let last = names.filter_map(|name| Some((round(&name)?, name))).max()?;
        Some(format!("{}/{}", feature.path, last.1))
    }
}
