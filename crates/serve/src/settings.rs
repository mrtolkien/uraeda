//! The settings page: how each step of the workflow runs, its agent, model, and effort, and which
//! steps share a session; the build's implementers; the reviewers and their depth; and whether the
//! pages tell the agent's session to continue. Each change is saved at once in `config.toml`,
//! through the core's writer of `[runs]`, which keeps the rest of the file as it was.
//!
//! - `GET  /{token}/settings`: the page.
//! - `POST /{token}/settings/runs`: `{ version, options }` gives `{ version }`.
//! - `POST /{token}/settings/serve`: `{ version, wake }` gives `{ version }`.
//!
//! `version` is a hash of the file's text as the page read it: a file changed since, by hand or
//! by another page, is refused, never written over.

use std::fmt::Write as _;
use std::path::Path;
use std::sync::Arc;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uraeda_core::settings::{self, ReviewerOptions, RunOptions, RunPick, STEPS, StepOptions};

use crate::config::{self, Wake};
use crate::html::escape;
use crate::review::routes::version_of;
use crate::round::routes::Failure;
use crate::{Shared, html};

/// The agents a step may run on, besides any other the file names.
const AGENTS: [&str; 2] = ["claude", "codex"];

/// The models offered as you type, besides the ones the file names: any other may be typed.
const MODELS: [&str; 4] = ["fable", "opus", "sonnet", "haiku"];

/// The efforts offered, besides any other the file names.
const EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

/// What each step does, as the page says it under its name.
fn step_words(step: &str) -> (&'static str, &'static str) {
    match step {
        "discovery" => ("Discovery", "Research, then the rounds of questions"),
        "spec" => ("Spec", "Writes the spec, and revises it after your review"),
        "plan" => ("Plan", "Writes the plan, its tasks and waves"),
        "build" => ("Build", "Leads the build: hands out the tasks, then fixes"),
        "review" => ("Review", "The final review, then the pull request"),
        "comments" => (
            "Comments",
            "The pull request's comments, catch-ups, and pushes",
        ),
        _ => ("Step", ""),
    }
}

/// An agent, a model, and an effort, as the page sends them: empty for the default.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Pick {
    #[serde(default)]
    agent: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    effort: String,
}

impl Pick {
    fn of(agent: &Option<String>, model: &Option<String>, effort: &Option<String>) -> Pick {
        let text = |v: &Option<String>| v.clone().unwrap_or_default();
        Pick {
            agent: text(agent),
            model: text(model),
            effort: text(effort),
        }
    }

    fn values(&self) -> (Option<String>, Option<String>, Option<String>) {
        let value = |v: &str| Some(v.trim().to_string()).filter(|v| !v.is_empty());
        (value(&self.agent), value(&self.model), value(&self.effort))
    }
}

/// A step's options, as the page sends them.
#[derive(Deserialize)]
pub struct Step {
    step: String,
    #[serde(flatten)]
    pick: Pick,
    /// Whether the step starts a new session, cut from the step before.
    new_session: bool,
}

/// A reviewer, as the page sends it: an agent on its pick, or a command.
#[derive(Deserialize)]
pub struct Reviewer {
    #[serde(flatten)]
    pick: Pick,
    #[serde(default)]
    instructions: String,
    #[serde(default)]
    command: String,
}

/// The run options, as the page sends them.
#[derive(Deserialize)]
pub struct Runs {
    steps: Vec<Step>,
    implementers: Pick,
    reviewers: Vec<Reviewer>,
    depth: String,
}

impl Runs {
    /// The options to write: only what differs from the defaults is set.
    fn options(&self) -> RunOptions {
        let steps = self
            .steps
            .iter()
            .filter_map(|step| {
                let (agent, model, effort) = step.pick.values();
                let default_cut = step.step == "plan";
                let new_session = (step.step != "discovery" && step.new_session != default_cut)
                    .then_some(step.new_session);
                (agent.is_some() || model.is_some() || effort.is_some() || new_session.is_some())
                    .then(|| StepOptions {
                        step: step.step.clone(),
                        agent,
                        model,
                        effort,
                        new_session,
                    })
            })
            .collect();
        let (agent, model, effort) = self.implementers.values();
        let implementers =
            (agent.is_some() || model.is_some() || effort.is_some()).then_some(RunPick {
                agent,
                model,
                effort,
            });
        let reviewers: Vec<ReviewerOptions> = self
            .reviewers
            .iter()
            .map(|r| {
                let command = Some(r.command.trim().to_string()).filter(|c| !c.is_empty());
                let (agent, model, effort) = r.pick.values();
                let instructions =
                    Some(r.instructions.trim().to_string()).filter(|i| !i.is_empty());
                match command {
                    Some(command) => ReviewerOptions {
                        command: Some(command),
                        ..ReviewerOptions::default()
                    },
                    None => ReviewerOptions {
                        // An agent reviewer names its agent: the default one when none is picked.
                        agent: agent.or_else(|| Some(AGENTS[0].to_string())),
                        model,
                        effort,
                        instructions,
                        command: None,
                    },
                }
            })
            .collect();
        RunOptions {
            steps,
            implementers,
            reviewers: (!reviewers.is_empty()).then_some(reviewers),
            review_depth: (self.depth == "branch").then(|| "branch".to_string()),
        }
    }
}

/// The settings file's text, empty when there is none.
fn file_text(dir: &Path) -> String {
    std::fs::read_to_string(dir.join(config::FILE)).unwrap_or_default()
}

/// Refuses a write from a page that read another version of the file.
fn same_version(dir: &Path, version: &str) -> Result<(), Failure> {
    if version_of(&file_text(dir)) == version {
        Ok(())
    } else {
        Err(Failure(
            StatusCode::CONFLICT,
            "The settings changed since you opened this page: nothing was saved. Reload to see \
             them."
                .into(),
        ))
    }
}

/// `GET /{token}/settings`.
pub async fn page(State(shared): State<Arc<Shared>>) -> Response {
    let dir = shared.config_dir.clone();
    let serve = shared.settings();
    let drawn = tokio::task::spawn_blocking(move || {
        let text = file_text(&dir);
        let read = settings::read(&dir);
        let body = match read {
            Ok(read) => main(&read.runs.options, &serve, &dir, &version_of(&text)),
            Err(error) => format!(
                "<main class=\"settings\"><nav class=\"crumbs\"><a href=\"./\">‹ What waits on \
                 you</a></nav><h1>Settings</h1><p class=\"error\">The settings file could not be \
                 read: {}. Fix it by hand, then reload.</p></main>",
                escape(&error.to_string())
            ),
        };
        html::page("Settings", &body)
    })
    .await;
    match drawn {
        Ok(page) => Html(page).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct SavedRuns {
    version: String,
    options: Runs,
}

/// `POST /{token}/settings/runs`.
pub async fn save_runs(
    State(shared): State<Arc<Shared>>,
    Json(body): Json<SavedRuns>,
) -> Result<Json<Value>, Failure> {
    let held = Arc::clone(&shared);
    tokio::task::spawn_blocking(move || {
        let _lock = held
            .writes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let dir = &held.config_dir;
        same_version(dir, &body.version)?;
        settings::set_run_options(dir, &body.options.options())
            .map_err(|e| Failure(StatusCode::UNPROCESSABLE_ENTITY, e.to_string()))?;
        Ok(Json(json!({ "version": version_of(&file_text(dir)) })))
    })
    .await
    .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
}

#[derive(Deserialize)]
pub struct SavedServe {
    version: String,
    wake: bool,
}

/// `POST /{token}/settings/serve`.
pub async fn save_serve(
    State(shared): State<Arc<Shared>>,
    Json(body): Json<SavedServe>,
) -> Result<Json<Value>, Failure> {
    let held = Arc::clone(&shared);
    tokio::task::spawn_blocking(move || {
        let _lock = held
            .writes
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let dir = &held.config_dir;
        same_version(dir, &body.version)?;
        let wake = body.wake.then(Wake::t3);
        config::set_wake(dir, wake.as_ref())
            .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        held.update(|settings| settings.wake = wake);
        Ok(Json(json!({ "version": version_of(&file_text(dir)) })))
    })
    .await
    .map_err(|e| Failure(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
}

/// The page's `<main>`.
fn main(options: &RunOptions, serve: &config::Settings, dir: &Path, version: &str) -> String {
    let mut known = Known::default();
    known.add_options(options);
    let mut out = String::with_capacity(16_000);
    let _ = write!(
        out,
        "<main class=\"settings\" data-version=\"{version}\">\
         <nav class=\"crumbs\"><a href=\"./\">‹ What waits on you</a></nav>\
         <h1>Settings</h1>\
         <p class=\"muted small\">Each change is saved at once, in <code>{file}</code>. A step left \
         on Default runs on its session's agent and model.</p>\
         <p class=\"saved small muted\" aria-live=\"polite\"></p>",
        version = escape(version),
        file = escape(&shown(&dir.join(config::FILE))),
    );
    out.push_str(
        "<section class=\"runs\" id=\"runs\"><h2>How each step runs</h2><ol class=\"steps\">",
    );
    for (index, step) in STEPS.iter().enumerate() {
        let set = options.steps.iter().find(|s| s.step == *step);
        let pick = set.map_or_else(Pick::default, |s| Pick::of(&s.agent, &s.model, &s.effort));
        if index > 0 {
            let cut = set.and_then(|s| s.new_session).unwrap_or(*step == "plan");
            let _ = write!(
                out,
                "<li class=\"joint\"><button type=\"button\" class=\"cut\" aria-pressed=\"{cut}\" \
                 data-step=\"{step}\"><span class=\"line\" aria-hidden=\"true\"></span>\
                 <span class=\"label\">{label}</span></button></li>",
                label = if cut {
                    "✂ New session"
                } else {
                    "Same session"
                },
            );
        }
        let (name, what) = step_words(step);
        let _ = write!(
            out,
            "<li class=\"step\" data-step=\"{step}\"><div class=\"head\"><h3>{name}</h3>\
             <p class=\"muted small\">{what}</p></div>{fields}",
            fields = fields(&pick, &format!("{name}'s"), &known),
        );
        if *step == "build" {
            let implementers = options
                .implementers
                .as_ref()
                .map_or_else(Pick::default, |p| Pick::of(&p.agent, &p.model, &p.effort));
            let _ = write!(
                out,
                "<div class=\"under implementers\"><h4>Implementers</h4><p class=\"muted small\">\
                 Build the tasks, each in its own session</p>{}</div>",
                fields(&implementers, "the implementers'", &known)
            );
        }
        if *step == "review" {
            reviewers(&mut out, options, &known);
        }
        out.push_str("</li>");
    }
    out.push_str("</ol></section>");
    let _ = write!(
        out,
        "<section class=\"pages\" id=\"pages\"><h2>These pages</h2>\
         <label class=\"switch\"><input type=\"checkbox\" class=\"wake\"{checked}> \
         <span>Tell the feature's T3 Code session to continue when you send answers or a verdict\
         </span></label><h3>Repositories</h3><ul class=\"muted\">{repositories}</ul>\
         <p class=\"muted small\">The repositories and the port are set in the file: a change \
         takes effect when <code>ura serve</code> starts again.</p></section>",
        checked = if serve.wake.is_some() { " checked" } else { "" },
        repositories = serve
            .repositories
            .iter()
            .map(|r| format!("<li><code>{}</code></li>", escape(&shown(r))))
            .collect::<String>(),
    );
    known.datalists(&mut out);
    out.push_str("</main>");
    out
}

/// A path as the page shows it, the home folder as `~`.
fn shown(path: &Path) -> String {
    let home = std::env::home_dir().unwrap_or_default();
    match path.strip_prefix(&home) {
        Ok(rest) if !home.as_os_str().is_empty() => format!("~/{}", rest.display()),
        _ => path.display().to_string(),
    }
}

/// The reviewers under the review step: each on its pick or a command, then their depth.
fn reviewers(out: &mut String, options: &RunOptions, known: &Known) {
    out.push_str(
        "<div class=\"under reviewers\"><h4>Reviewers</h4><p class=\"muted small\">Review the \
         build. None: one reviewer on the review step's agent.</p><ol class=\"reviewer-list\">",
    );
    for reviewer in options.reviewers.iter().flatten() {
        out.push_str(&reviewer_item(reviewer, known));
    }
    let _ = write!(
        out,
        "</ol><template class=\"reviewer-template\">{}</template>\
         <button type=\"button\" class=\"add-reviewer\">Add a reviewer</button>\
         <fieldset class=\"depth\"><legend>When they review</legend>\
         <label><input type=\"radio\" name=\"depth\" value=\"waves\"{waves}> Each wave, then the \
         branch</label><label><input type=\"radio\" name=\"depth\" value=\"branch\"{branch}> The \
         branch only</label></fieldset></div>",
        reviewer_item(&ReviewerOptions::default(), known),
        waves = if options.review_depth.as_deref() == Some("branch") {
            ""
        } else {
            " checked"
        },
        branch = if options.review_depth.as_deref() == Some("branch") {
            " checked"
        } else {
            ""
        },
    );
}

/// A reviewer's item: its pick and instructions, or its command.
fn reviewer_item(reviewer: &ReviewerOptions, known: &Known) -> String {
    let command = reviewer.command.clone().unwrap_or_default();
    let pick = Pick::of(&reviewer.agent, &reviewer.model, &reviewer.effort);
    format!(
        "<li class=\"reviewer\" data-kind=\"{kind}\"><div class=\"kinds\" role=\"group\" \
         aria-label=\"Kind of reviewer\"><button type=\"button\" class=\"kind-agent\" \
         aria-pressed=\"{agent}\">An agent</button><button type=\"button\" class=\"kind-command\" \
         aria-pressed=\"{is_command}\">A command</button><button type=\"button\" class=\"drop\">\
         Remove</button></div><div class=\"as-agent\">{fields}<label class=\"field wide\">\
         <span>Instructions, optional</span><textarea rows=\"2\" class=\"instructions\">\
         {instructions}</textarea></label></div><label class=\"field wide as-command\">\
         <span>Command, run in the feature's worktree</span><input type=\"text\" class=\"command\" \
         value=\"{command}\" placeholder=\"just review\"></label></li>",
        kind = if command.is_empty() {
            "agent"
        } else {
            "command"
        },
        agent = command.is_empty(),
        is_command = !command.is_empty(),
        fields = fields(&pick, "the reviewer's", known),
        instructions = escape(reviewer.instructions.as_deref().unwrap_or_default()),
        command = escape(&command),
    )
}

/// The agent, model, and effort fields of a pick.
fn fields(pick: &Pick, whose: &str, known: &Known) -> String {
    let options = |values: &[String], current: &str| -> String {
        let mut out = format!(
            "<option value=\"\"{}>Default</option>",
            if current.is_empty() { " selected" } else { "" }
        );
        for value in values {
            let _ = write!(
                out,
                "<option value=\"{v}\"{s}>{v}</option>",
                v = escape(value),
                s = if value == current { " selected" } else { "" }
            );
        }
        out
    };
    format!(
        "<div class=\"pick\"><label class=\"field\"><span>Agent</span><select class=\"agent\" \
         aria-label=\"{whose} agent\">{agents}</select></label>\
         <label class=\"field\"><span>Model</span><input type=\"text\" class=\"model\" \
         list=\"models\" value=\"{model}\" placeholder=\"Default\" autocapitalize=\"off\" \
         autocomplete=\"off\" aria-label=\"{whose} model\"></label>\
         <label class=\"field\"><span>Effort</span><select class=\"effort\" \
         aria-label=\"{whose} effort\">{efforts}</select></label></div>",
        whose = escape(whose),
        agents = options(&known.agents, &pick.agent),
        model = escape(&pick.model),
        efforts = options(&known.efforts, &pick.effort),
    )
}

/// The agents, models, and efforts offered: the usual ones, then those the file names.
struct Known {
    agents: Vec<String>,
    models: Vec<String>,
    efforts: Vec<String>,
}

impl Default for Known {
    fn default() -> Known {
        let owned = |list: &[&str]| list.iter().map(|v| (*v).to_string()).collect();
        Known {
            agents: owned(&AGENTS),
            models: owned(&MODELS),
            efforts: owned(&EFFORTS),
        }
    }
}

impl Known {
    fn add(&mut self, agent: &Option<String>, model: &Option<String>, effort: &Option<String>) {
        let push = |list: &mut Vec<String>, value: &Option<String>| {
            if let Some(value) = value.as_ref().filter(|v| !list.contains(v)) {
                list.push(value.clone());
            }
        };
        push(&mut self.agents, agent);
        push(&mut self.models, model);
        push(&mut self.efforts, effort);
    }

    fn add_options(&mut self, options: &RunOptions) {
        for step in &options.steps {
            self.add(&step.agent, &step.model, &step.effort);
        }
        if let Some(p) = &options.implementers {
            self.add(&p.agent, &p.model, &p.effort);
        }
        for r in options.reviewers.iter().flatten() {
            self.add(&r.agent, &r.model, &r.effort);
        }
    }

    /// The models offered as one types, for every model field.
    fn datalists(&self, out: &mut String) {
        out.push_str("<datalist id=\"models\">");
        for model in &self.models {
            let _ = write!(out, "<option value=\"{}\">", escape(model));
        }
        out.push_str("</datalist>");
    }
}
