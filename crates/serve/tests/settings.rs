//! The settings page: each step's pick and sessions written in `config.toml` with the rest of the
//! file kept, a stale page refused, and the wake switch.

mod support;

use std::fs;

use support::Server;
use tempfile::TempDir;
use uraeda_serve::Settings;
use uraeda_serve::review::routes::version_of;

const FILE: &str = "# Mine: keep this comment.\n[keyboard]\nvim_mode = true\n\n[runs]\nscheduled_jobs = false\n\n[runs.steps.spec]\nagent = \"claude\"\nmodel = \"fable\"\neffort = \"high\"\n\n[serve]\nrepositories = [\"/x\"]\n";

fn server(dir: &TempDir) -> Server {
    fs::write(dir.path().join("config.toml"), FILE).unwrap();
    Server::configured(Settings::default(), dir.path().to_path_buf())
}

fn read(dir: &TempDir) -> String {
    fs::read_to_string(dir.path().join("config.toml")).unwrap()
}

/// The page's options with `spec` on Opus, Build cut from Plan, and one command reviewer.
fn options() -> &'static str {
    r#"{"steps":[
        {"step":"discovery","agent":"","model":"","effort":"","new_session":false},
        {"step":"spec","agent":"claude","model":"opus","effort":"max","new_session":false},
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
        "Reviewers",
        "The branch only",
    ] {
        assert!(page.contains(word), "{word}");
    }
    assert!(page.contains("value=\"fable\""), "the spec's model as set");
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
    assert!(text.contains("model = \"opus\""), "{text}");
    assert!(text.contains("effort = \"max\""));
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
