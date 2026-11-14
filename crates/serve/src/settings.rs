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
use serde::Deserialize;
use serde_json::{Value, json};
use uraeda_core::settings::{self, ReviewerOptions, RunOptions, STEPS};

use crate::config::{self, Wake};
use crate::html::escape;
use crate::providers::{self, Provider};
use crate::review::routes::version_of;
use crate::round::routes::Failure;
use crate::{Shared, html, marks};

mod sent;

use sent::{Pick, Runs};

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
    let held = Arc::clone(&shared);
    let drawn = tokio::task::spawn_blocking(move || {
        let text = file_text(&dir);
        let read = settings::read(&dir);
        let body = match read {
            Ok(read) => main(&read.runs, &serve, held.agents(), &dir, &version_of(&text)),
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

/// The page's `<main>`: the workflow as a track of steps, each a row that opens the picker.
fn main(
    options: &RunOptions,
    serve: &config::Settings,
    agents: Vec<Provider>,
    dir: &Path,
    version: &str,
) -> String {
    let choices = Choices { providers: agents };
    let mut out = String::with_capacity(16_000);
    let _ = write!(
        out,
        "<main class=\"settings\" data-version=\"{version}\">\
         <nav class=\"crumbs\"><a href=\"./\">‹ What waits on you</a></nav>\
         <h1>Settings</h1>\
         <p class=\"muted small\">How each step runs: tap one to pick its agent, model, and effort. \
         Saved at once in <code>{file}</code>.</p>\
         <p class=\"saved small muted\" aria-live=\"polite\"></p>",
        version = escape(version),
        file = escape(&shown(&dir.join(config::FILE))),
    );
    out.push_str("<ol class=\"track\" aria-label=\"How each step runs\">");
    for (index, step) in STEPS.iter().enumerate() {
        let set = options.steps.iter().find(|s| s.step == *step);
        let pick = set.map_or_else(Pick::default, |s| Pick::of(&s.agent, &s.model, &s.effort));
        if index > 0 {
            let cut = set.and_then(|s| s.new_session).unwrap_or(*step == "plan");
            let _ = write!(
                out,
                "<li class=\"joint\"><button type=\"button\" class=\"cut\" aria-pressed=\"{cut}\" \
                 data-step=\"{step}\" title=\"Whether this step starts a new session\">\
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
            "<li class=\"step\" data-step=\"{step}\">{row}",
            row = row(&pick, name, what, &choices),
        );
        if *step == "build" {
            let implementers = options
                .implementers
                .as_ref()
                .map_or_else(Pick::default, |p| Pick::of(&p.agent, &p.model, &p.effort));
            let _ = write!(
                out,
                "<ul class=\"under\"><li class=\"implementers\">{}</li></ul>",
                row(
                    &implementers,
                    "Implementers",
                    "Build the tasks, each in its own session",
                    &choices
                )
            );
        }
        if *step == "review" {
            reviewers(&mut out, options, &choices);
        }
        out.push_str("</li>");
    }
    out.push_str("</ol>");
    let _ = write!(
        out,
        "<section class=\"pages\" id=\"pages\"><h2>These pages</h2>\
         <label class=\"switch\"><input type=\"checkbox\" class=\"wake\"{checked}> \
         <span>Tell the feature's T3 Code session to continue when you send answers or a verdict\
         </span></label><p class=\"muted small\">Repositories: {repositories}. They and the port \
         are set in the file, and take effect when <code>ura serve</code> starts again.</p>\
         </section>",
        checked = if serve.wake.is_some() { " checked" } else { "" },
        repositories = serve
            .repositories
            .iter()
            .map(|r| format!("<code>{}</code>", escape(&shown(r))))
            .collect::<Vec<_>>()
            .join(", "),
    );
    for agent in &choices.providers {
        if let Some(problem) = &agent.problem {
            let _ = write!(
                out,
                "<p class=\"muted small\">{}: no model listed, {}.</p>",
                escape(&agent.name),
                escape(problem)
            );
        }
    }
    out.push_str(
        "<dialog class=\"picker\" aria-labelledby=\"picker-title\"><form method=\"dialog\">\
         <header><h2 id=\"picker-title\"></h2><button class=\"picker-done primary\" value=\"done\">Done\
         </button></header><div class=\"picker-body\"></div></form></dialog>",
    );
    choices.script(&mut out);
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

/// The reviewers under the review step, each a row, then when they review.
fn reviewers(out: &mut String, options: &RunOptions, choices: &Choices) {
    out.push_str("<ul class=\"under reviewers\">");
    for reviewer in options.reviewers.iter().flatten() {
        out.push_str(&reviewer_item(reviewer, choices));
    }
    let branch = options.review_depth.as_deref() == Some("branch");
    let _ = write!(
        out,
        "</ul><div class=\"review-more\"><button type=\"button\" class=\"add-reviewer small\">+ \
         Reviewer</button><div class=\"segmented depth\" role=\"radiogroup\" aria-label=\"When \
         the reviewers review\"><button type=\"button\" role=\"radio\" data-depth=\"waves\" \
         aria-checked=\"{waves}\">Each wave</button><button type=\"button\" role=\"radio\" \
         data-depth=\"branch\" aria-checked=\"{branch}\">Branch only</button></div></div>\
         <template class=\"reviewer-template\">{template}</template>",
        waves = !branch,
        template = reviewer_item(&ReviewerOptions::default(), choices),
    );
}

/// A reviewer's row: an agent on its pick, with its instructions, or a command.
fn reviewer_item(reviewer: &ReviewerOptions, choices: &Choices) -> String {
    let command = reviewer.command.clone().unwrap_or_default();
    let instructions = reviewer.instructions.clone().unwrap_or_default();
    let row = if command.is_empty() {
        let pick = Pick::of(&reviewer.agent, &reviewer.model, &reviewer.effort);
        row(&pick, "Reviewer", "", choices)
    } else {
        format!(
            "<button type=\"button\" class=\"row\" data-agent=\"command\"><span class=\"mark\">\
             {mark}</span><span class=\"body\"><span class=\"name\">Reviewer</span><span \
             class=\"what\"><code>{command}</code></span></span></button>",
            mark = marks::of("command"),
            command = escape(&command),
        )
    };
    format!(
        "<li class=\"reviewer\" data-command=\"{command}\" data-instructions=\"{instructions}\">\
         {row}</li>",
        command = escape(&command),
        instructions = escape(&instructions),
    )
}

/// A pick's row: the agent's mark, the name of what runs, the model, and the effort as a meter.
/// Its `data-` values are the pick, which the script reads and the picker changes.
fn row(pick: &Pick, name: &str, what: &str, choices: &Choices) -> String {
    let provider = providers::find(&choices.providers, &pick.agent);
    let model = provider.and_then(|p| providers::model(p, &pick.model));
    let model_name = match (provider, model) {
        (None, _) if pick.agent.is_empty() => "Default".to_string(),
        (None, _) => format!("{} (not listed)", pick.agent),
        (Some(p), None) if pick.model.is_empty() => {
            let usual = p.models.iter().find(|m| m.default);
            usual.map_or_else(|| p.name.clone(), |m| format!("{} · default", m.name))
        }
        (Some(_), None) => format!("{} (not offered)", pick.model),
        (Some(_), Some(m)) => m.name.clone(),
    };
    let shown = model.or_else(|| {
        provider.and_then(|p| p.models.iter().find(|m| m.default).or(p.models.first()))
    });
    let efforts = shown.map(|m| m.efforts.as_slice()).unwrap_or_default();
    let at = if pick.effort.is_empty() {
        efforts.iter().position(|e| e.default)
    } else {
        efforts.iter().position(|e| e.id == pick.effort)
    };
    let effort_name = match (pick.effort.is_empty(), at) {
        (_, Some(i)) => efforts[i].label.clone(),
        (true, None) => String::new(),
        (false, None) => pick.effort.clone(),
    };
    let meter: String = (0..efforts.len())
        .map(|i| {
            format!(
                "<i{}></i>",
                if at.is_some_and(|at| i <= at) {
                    " class=\"on\""
                } else {
                    ""
                }
            )
        })
        .collect();
    format!(
        "<button type=\"button\" class=\"row\" data-agent=\"{agent}\" data-model=\"{model}\" \
         data-effort=\"{effort}\" data-name=\"{name}\" title=\"{what}\"><span class=\"mark\">\
         {mark}</span><span class=\"body\"><span class=\"name\">{name}</span><span \
         class=\"what\">{model_name}</span></span><span class=\"effort{dim}\"><span \
         class=\"meter\">{meter}</span><span class=\"effort-name\">{effort_name}</span></span>\
         <span class=\"chevron\" aria-hidden=\"true\">›</span></button>",
        agent = escape(&pick.agent),
        model = escape(&pick.model),
        effort = escape(&pick.effort),
        name = escape(name),
        what = escape(what),
        mark = marks::of(provider.map_or(pick.agent.as_str(), |p| p.id.as_str())),
        model_name = escape(&model_name),
        dim = if pick.effort.is_empty() { " usual" } else { "" },
        effort_name = escape(&effort_name),
    )
}

/// What a pick chooses among: the agents and their models.
struct Choices {
    providers: Vec<Provider>,
}

impl Choices {
    /// The agents, their models, and their marks, as the picker reads them.
    fn script(&self, out: &mut String) {
        let marks: serde_json::Map<String, Value> = ["claude", "codex", "command", "", "other"]
            .iter()
            .map(|agent| ((*agent).to_string(), Value::String(marks::of(agent))))
            .collect();
        let data = json!({ "agents": self.providers, "marks": marks });
        let _ = write!(
            out,
            "<script type=\"application/json\" id=\"providers\">{}</script>",
            data.to_string().replace("</", "<\\/")
        );
    }
}
