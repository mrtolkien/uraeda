//! Diagnostics: `ura check`'s results of the text the editor holds, at each result's own severity.

use lsp_types::DiagnosticSeverity;

use crate::common::*;

/// The line of the field in a text, from 0.
fn line_of(text: &str, field: &str) -> u32 {
    text.lines()
        .position(|line| line.starts_with(field))
        .unwrap() as u32
}

#[test]
fn an_unsaved_change_shows_its_problem_on_its_line_and_writes_nothing() {
    let (repo, path, text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(&path, &text);
    assert_eq!(session.diagnostics(&path), []);

    session.change(
        &path,
        &text.replace("risk-tier: high", "risk-tier: extreme"),
    );
    let diagnostics = session.diagnostics(&path);

    assert_eq!(diagnostics.len(), 1, "{diagnostics:?}");
    assert_eq!(diagnostics[0].range.start.line, line_of(&text, "risk-tier"));
    assert_eq!(
        diagnostics[0].range.end.line,
        diagnostics[0].range.start.line
    );
    assert_eq!(diagnostics[0].source.as_deref(), Some("uraeda"));
    assert_eq!(diagnostics[0].severity, Some(DiagnosticSeverity::ERROR));
    assert_eq!(
        repo.read(&format!("{FEATURE}/spec.md")),
        text,
        "the file on disk is untouched"
    );

    let missing = text.replace("risk-tier: high\n", "");
    session.change(&path, &missing);
    assert_eq!(
        session.diagnostics(&path)[0].range.start.line,
        0,
        "a problem without a line is on the first"
    );
}

#[test]
fn saving_publishes_again_and_closing_clears() {
    let (repo, path, text) = feature_with_spec();
    let mut session = Session::start(repo.path());
    session.open(
        &path,
        &text.replace("risk-tier: high", "risk-tier: extreme"),
    );
    assert_eq!(session.diagnostics(&path).len(), 1);

    session.save(&path);
    assert_eq!(session.diagnostics(&path).len(), 1);
    session.close(&path);

    assert_eq!(session.diagnostics(&path), []);
}

#[test]
fn a_warning_is_sent_as_a_warning() {
    let (repo, _, _) = feature_with_spec();
    let path = repo.path().join(FEATURE).join("clarifications-01.md");
    let text = std::fs::read_to_string(&path)
        .unwrap()
        .replacen("status: answered", "status: awaiting-human", 1)
        .replacen("> [!NOTE]", "> [!IMPORTANT]", 1)
        .replacen(
            "> Answered on 2026-10-08.",
            "> 1 question and 1 follow-up, about 5 minutes.",
            1,
        );
    let mut session = Session::start(repo.path());

    session.open(&path, &text);
    let diagnostics = session.diagnostics(&path);

    assert!(!diagnostics.is_empty());
    assert!(
        diagnostics
            .iter()
            .all(|d| d.severity == Some(DiagnosticSeverity::WARNING)),
        "{diagnostics:?}"
    );
}

#[test]
fn only_workflow_files_of_specs_have_diagnostics_and_a_worktree_is_its_own_root() {
    let (repo, path, text) = feature_with_spec();
    repo.write(&format!("{FEATURE}/mockups/notes.md"), "no title\n");
    let notes = repo.path().join(FEATURE).join("mockups/notes.md");
    let readme = repo.path().join("README.md");
    let mut session = Session::start(repo.path());

    session.open(&notes, "no title\n");
    assert_eq!(
        session.diagnostics(&notes),
        [],
        "a file that is no workflow file has none"
    );
    session.open(&readme, "---\nstatus: nonsense\n---\n");
    // Messages arrive in order: once the spec's diagnostics are in, any for the README would be.
    session.open(&path, &text);
    assert_eq!(session.diagnostics(&path), []);
    assert!(
        session
            .notifications("textDocument/publishDiagnostics")
            .is_empty(),
        "a file outside specs/ is not checked"
    );

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
    assert!(
        !repo.exists("specs"),
        "main has no specs: the feature is read from its worktree"
    );
    let path = worktree.join(FEATURE).join("spec.md");
    let broken = std::fs::read_to_string(&path)
        .unwrap()
        .replace("risk-tier: high", "risk-tier: extreme");
    let mut session = Session::start(&worktree);

    session.open(&path, &broken);

    assert_eq!(session.diagnostics(&path).len(), 1);
}
