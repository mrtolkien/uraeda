//! Diagnostics: `ura check`'s problems for the open text of a file under `specs/`, each covering
//! its whole line.

use std::path::Path;

use lsp_types::{Diagnostic, DiagnosticSeverity, Position, Range, Uri};
use uraeda_core::check;
use uraeda_core::workspace::Problem;

use crate::documents::Documents;

/// The diagnostics of `uri`: its open text checked in place of its file, or none once it is closed.
pub(crate) fn of(documents: &Documents, uri: &Uri) -> Vec<Diagnostic> {
    match (documents.text(uri), documents.path(uri)) {
        (Some(text), Some(path)) => check_text(&documents.root, &path, text),
        _ => Vec::new(),
    }
}

fn check_text(root: &Path, path: &Path, text: &str) -> Vec<Diagnostic> {
    check::check_text(root, path, text)
        .into_iter()
        .map(|problem| diagnostic(text, problem))
        .collect()
}

/// A problem as a diagnostic over its line, 0-based; on the first line when it has none.
fn diagnostic(text: &str, problem: Problem) -> Diagnostic {
    let line = problem.line.unwrap_or(1).saturating_sub(1);
    let end = text
        .lines()
        .nth(line)
        .map_or(0, |line| line.encode_utf16().count());
    let line = u32::try_from(line).unwrap_or(u32::MAX);
    Diagnostic {
        range: Range::new(
            Position::new(line, 0),
            Position::new(line, u32::try_from(end).unwrap_or(u32::MAX)),
        ),
        severity: Some(DiagnosticSeverity::ERROR),
        source: Some("uraeda".to_string()),
        message: problem.message,
        ..Diagnostic::default()
    }
}
