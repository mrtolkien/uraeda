//! The settings page: each step's pick and sessions written in `config.toml` with the rest of the
//! file kept, a stale page refused, and the wake switch.

mod support;

use std::fs;

use support::Server;
use tempfile::TempDir;
use uraeda_serve::Settings;
use uraeda_serve::providers::{Effort, Model, Provider};
use uraeda_serve::review::routes::version_of;

const FILE: &str = "# Mine: keep this comment.\n[keyboard]\nvim_mode = true\n\n[runs]\nscheduled_jobs = false\n\n[runs.steps.spec]\nagent = \"claude\"\nmodel = \"fable\"\neffort = \"high\"\n\n[serve]\nrepositories = [\"/x\"]\n";

/// Claude Code with Fable and Opus, and Codex with one model, as they would list them.
fn agents() -> Vec<Provider> {
    let effort = |id: &str, default: bool| Effort {
        id: id.into(),
        label: id.into(),
        default,
    };
    let model = |slug: &str, name: &str, efforts: Vec<Effort>| Model {
        slug: slug.into(),
        name: name.into(),
        aliases: Vec::new(),
        default: false,
        efforts,
    };
    vec![
        Provider {
            id: "claude".into(),
            name: "Claude Code".into(),
            models: vec![
                model(
                    "fable",
                    "Fable 5.2",
                    vec![effort("medium", true), effort("high", false)],
                ),
                model(
                    "opus",
                    "Opus 5.5",
                    vec![effort("medium", true), effort("max", false)],
                ),
            ],
            problem: None,
        },
        Provider {
            id: "codex".into(),
            name: "Codex".into(),
            models: vec![model("gpt-a", "GPT A", vec![effort("ultra", false)])],
            problem: None,
        },
    ]
}

fn server(dir: &TempDir) -> Server {
    fs::write(dir.path().join("config.toml"), FILE).unwrap();
    Server::serving(Settings::default(), dir.path().to_path_buf(), agents())
}

fn read(dir: &TempDir) -> String {
    fs::read_to_string(dir.path().join("config.toml")).unwrap()
}

/// The page's options with `spec` on Opus, Build cut from Plan, and one command reviewer.
fn options() -> &'static str {
    r#"{"steps":[
        {"step":"discovery","agent":"","model":"","effort":"","new_session":false},
        {"step":"spec","agent":"codex","model":"gpt-a","effort":"ultra","new_session":false},
        {"step":"plan","agent":"","model":"","effort":"","new_session":true},
        {"step":"build","agent":"","model":"","effort":"","new_session":true},
        {"step":"review","agent":"","model":"","effort":"","new_session":false},
        {"step":"comments","agent":"","model":"","effort":"","new_session":false}],
      "implementers":{"agent":"codex","model":"","effort":"medium"},
      "reviewers":[{"agent":"","model":"","effort":"","instructions":"","command":"just review"}],
      "depth":"branch"}"#
}

#[test]
fn the_page_draws_each_step_its_sessions_and_the_reviewers() {
    let dir = TempDir::new().unwrap();
    let server = server(&dir);
    let answer = server.get(&format!("/{}/settings", server.token));
    assert_eq!(answer.status(), 200);
    let page = answer.into_body().read_to_string().unwrap();
    for word in [
        "Discovery",
        "Comments",
        "Implementers",
        "+ Reviewer",
        "Branch only",
    ] {
        assert!(page.contains(word), "{word}");
    }
    // The spec's row: Claude Code's mark, its model's name, and its effort on the meter.
    let spec = page.find("data-step=\"spec\"><button").unwrap();
    let row = &page[spec..page[spec..]
        .find("</li>")
        .map_or(page.len(), |end| spec + end)];
    assert!(
        row.contains("data-agent=\"claude\" data-model=\"fable\" data-effort=\"high\""),
        "{row}"
    );
    assert!(row.contains("<span class=\"what\">Fable 5.2</span>"));
    assert!(row.contains(
        "<i class=\"on\"></i><i class=\"on\"></i></span><span class=\"effort-name\">high"
    ));
    assert!(row.contains("<svg"), "the agent's mark");
    assert!(page.contains("<dialog class=\"picker\""));
    assert!(
        page.contains("\"name\":\"Codex\""),
        "the agents, for the picker"
    );
    // Plan starts a new session by default; the other joints join.
    assert!(
        page.contains("aria-pressed=\"true\" data-step=\"plan\""),
        "{page}"
    );
    assert!(page.contains("aria-pressed=\"false\" data-step=\"build\""));
    let home = server.get(&format!("/{}/", server.token));
    assert!(
        home.into_body()
            .read_to_string()
            .unwrap()
            .contains("href=\"settings\"")
    );
}

#[test]
fn a_save_writes_the_runs_and_keeps_the_rest_of_the_file() {
    let dir = TempDir::new().unwrap();
    let server = server(&dir);
    let body = format!(
        r#"{{"version":"{}","options":{}}}"#,
        version_of(FILE),
        options()
    );
    let answer = server.write(&format!("/{}/settings/runs", server.token), &body);
    assert_eq!(answer.status(), 200);
    let text = read(&dir);
    assert!(text.starts_with("# Mine: keep this comment."), "{text}");
    assert!(text.contains("scheduled_jobs = false"));
    assert!(text.contains("repositories = [\"/x\"]"));
    assert!(text.contains("agent = \"codex\""), "{text}");
    assert!(text.contains("model = \"gpt-a\""), "{text}");
    assert!(text.contains("effort = \"ultra\""));
    assert!(!text.contains("fable"));
    assert!(
        text.contains("[runs.steps.build]\nnew_session = true"),
        "{text}"
    );
    assert!(
        !text.contains("[runs.steps.plan]"),
        "Plan's cut is the default: {text}"
    );
    assert!(
        text.contains("[runs.implementers]\nagent = \"codex\"\neffort = \"medium\""),
        "{text}"
    );
    assert!(text.contains("command = \"just review\""));
    assert!(text.contains("review_depth = \"branch\""));
}

#[test]
fn a_page_that_read_another_version_is_refused() {
    let dir = TempDir::new().unwrap();
    let server = server(&dir);
    let body = format!(r#"{{"version":"0","options":{}}}"#, options());
    let answer = server.write(&format!("/{}/settings/runs", server.token), &body);
    assert_eq!(answer.status(), 409);
    assert_eq!(read(&dir), FILE);
}

#[test]
fn the_wake_switch_writes_the_serve_section() {
    let dir = TempDir::new().unwrap();
    let server = server(&dir);
    let on = server.write(
        &format!("/{}/settings/serve", server.token),
        &format!(r#"{{"version":"{}","wake":true}}"#, version_of(FILE)),
    );
    assert_eq!(on.status(), 200);
    let text = read(&dir);
    assert!(text.contains("wake = \"t3\""), "{text}");
    assert!(text.contains("repositories = [\"/x\"]"));
    let off = server.write(
        &format!("/{}/settings/serve", server.token),
        &format!(r#"{{"version":"{}","wake":false}}"#, version_of(&text)),
    );
    assert_eq!(off.status(), 200);
    assert!(!read(&dir).contains("wake"));
}
