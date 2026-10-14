mod common;

use std::time::Instant;

use common::*;
use lsp_types::DiagnosticSeverity;

fn messages(diagnostics: &[lsp_types::Diagnostic]) -> Vec<(u32, String)> {
    diagnostics
        .iter()
        .map(|diagnostic| (diagnostic.range.start.line, diagnostic.message.clone()))
        .collect()
}

/// US1.1
#[test]
fn an_unsaved_change_shows_its_problem() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());

    session.open(&path, &spec_text);
    assert_eq!(session.diagnostics(&path), []);
    session.change(
        &path,
        &spec_text.replace("risk-tier: high", "risk-tier: extreme"),
    );
    let diagnostics = session.diagnostics(&path);

    assert_eq!(diagnostics.len(), 1, "{diagnostics:?}");
    assert_eq!(diagnostics[0].range.start.line, 4);
    assert_eq!(diagnostics[0].range.start.character, 0);
    assert_eq!(diagnostics[0].range.end.line, 4);
    assert_eq!(
        diagnostics[0].range.end.character,
        "risk-tier: extreme".len() as u32
    );
    assert_eq!(
        diagnostics[0].message,
        "risk-tier \"extreme\" is not one of low, medium, high"
    );
    assert_eq!(diagnostics[0].source.as_deref(), Some("uraeda"));
    assert_eq!(diagnostics[0].severity, Some(DiagnosticSeverity::ERROR));
    assert_eq!(repo.read(&format!("{FEATURE}/spec.md")), spec_text);
}

#[test]
fn a_problem_without_a_line_is_on_line_1() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());

    session.open(&path, &spec_text.replace("risk-tier: high\n", ""));

    assert_eq!(
        messages(&session.diagnostics(&path)),
        [(0, "no \"risk-tier\" field".to_string())]
    );
}

#[test]
fn saving_and_closing_publish_again() {
    let (repo, path, spec_text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    let edited = spec_text.replace("risk-tier: high", "risk-tier: extreme");

    session.open(&path, &edited);
    assert_eq!(session.diagnostics(&path).len(), 1);
    session.save(&path);
    assert_eq!(session.diagnostics(&path).len(), 1);
    session.close(&path);

    assert_eq!(session.diagnostics(&path), []);
}

#[test]
fn a_file_that_is_no_workflow_file_has_no_diagnostics() {
    let (repo, _, _) = feature_with_spec();
    let notes = repo.path().join(FEATURE).join("mockups/notes.md");
    repo.write(&format!("{FEATURE}/mockups/notes.md"), "no title\n");
    let mut session = Session::start(repo.path());

    session.open(&notes, "no title\n");

    assert_eq!(session.diagnostics(&notes), []);
}

#[test]
fn a_file_outside_specs_has_no_diagnostics() {
    let (repo, path, spec_text) = feature_with_spec();
    let readme = repo.path().join("README.md");
    let mut session = Session::start(repo.path());

    session.open(&readme, "---\nstatus: nonsense\n---\n");
    // Messages arrive in order: once the spec's diagnostics are in, any for the README would be.
    session.open(&path, &spec_text);
    assert_eq!(session.diagnostics(&path), []);

    assert_eq!(
        session.notifications("textDocument/publishDiagnostics"),
        Vec::<serde_json::Value>::new()
    );
}

/// Review focus 1: a feature checked out only in its worktree is read from the worktree.
#[test]
fn a_worktree_is_its_own_root() {
    let repo = TestRepo::new();
    repo.switch_new("2026-10-06-recurring-tasks");
    write_example(&repo);
    repo.commit("feature");
    repo.switch("main");
    let worktree = repo.path().join(".worktrees/2026-10-06-recurring-tasks");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-06-recurring-tasks",
    ]);
    assert!(!repo.exists("specs"));
    let path = worktree.join(FEATURE).join("spec.md");
    let text = std::fs::read_to_string(&path)
        .unwrap()
        .replace("risk-tier: high", "risk-tier: extreme");
    let mut session = Session::start(&worktree);

    session.open(&path, &text);

    assert_eq!(
        messages(&session.diagnostics(&path)),
        [(
            4,
            "risk-tier \"extreme\" is not one of low, medium, high".to_string()
        )]
    );
}

/// The example's spec, open in a session with no diagnostics; returns it and the spec's path and
/// text.
fn example_spec_open() -> (Session, std::path::PathBuf, String) {
    let root = example();
    let path = root.join(FEATURE).join("spec.md");
    let text = std::fs::read_to_string(&path).unwrap();
    let mut session = Session::start(&root);
    session.open(&path, &text);
    assert_eq!(session.diagnostics(&path), []);
    (session, path, text)
}

/// SC-001's behaviour, its 300 ms measured by `bench_diagnostics_arrive_within_300_ms`: a changed
/// `risk-tier` gives exactly one diagnostic.
#[test]
fn a_changed_risk_tier_gives_one_diagnostic() {
    let (mut session, path, text) = example_spec_open();

    session.change(
        &path,
        &text.replace("risk-tier: high", "risk-tier: extreme"),
    );

    assert_eq!(
        messages(&session.diagnostics(&path)),
        [(
            4,
            "risk-tier \"extreme\" is not one of low, medium, high".to_string()
        )]
    );
}

/// SC-001: run by `vp run bench`.
#[test]
#[ignore = "benchmark"]
fn bench_diagnostics_arrive_within_300_ms() {
    let (mut session, path, text) = example_spec_open();

    let start = Instant::now();
    session.change(
        &path,
        &text.replace("risk-tier: high", "risk-tier: extreme"),
    );
    let diagnostics = session.diagnostics(&path);
    let elapsed = start.elapsed();

    assert_eq!(diagnostics.len(), 1, "{diagnostics:?}");
    assert!(elapsed.as_millis() < 300, "{elapsed:?}");
}
