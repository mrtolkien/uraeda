//! What Uraeda checks of a Codex thread's permissions: those Codex applied, from its
//! `thread/start` or `thread/resume` answer, and the trust of the session's project, given in
//! memory so that Codex does not write it to the user's settings.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::json::{object, text};

/// Codex's sandbox types, by the names its settings and documentation give them.
fn sandbox_name(kind: &str) -> &str {
    match kind {
        "dangerFullAccess" => "danger-full-access",
        "externalSandbox" => "an external sandbox",
        "readOnly" => "read-only",
        "workspaceWrite" => "workspace-write",
        other => other,
    }
}

fn applied(what: &str, wanted: &str) -> String {
    format!("Codex applied {what} instead of {wanted}: Uraeda does not run it")
}

/// A value as a refusal names it: a text as it is, anything else as JSON.
fn shown(value: Option<&Value>) -> String {
    match value {
        None => "undefined".to_owned(),
        Some(Value::String(text)) => text.clone(),
        Some(other) => other.to_string(),
    }
}

/// Why Uraeda does not run a thread whose answer says Codex applied other permissions than the
/// ones it asked for: the `workspace-write` sandbox with the network off, approvals on request,
/// reviewed by the automatic reviewer. None when it applied those.
pub(super) fn applied_problem(answer: &Value) -> Option<String> {
    let sandbox = object(answer, "sandbox");
    let kind = sandbox.and_then(|sandbox| sandbox.get("type"));
    if kind.and_then(Value::as_str) != Some("workspaceWrite") {
        let name = kind
            .and_then(Value::as_str)
            .map_or("no sandbox", sandbox_name);
        return Some(applied(name, "workspace-write"));
    }
    if sandbox.and_then(|sandbox| sandbox.get("networkAccess")) != Some(&Value::Bool(false)) {
        return Some(applied("a sandbox with the network on", "the network off"));
    }
    if text(answer, "approvalPolicy") != "on-request" {
        let policy = shown(answer.get("approvalPolicy"));
        return Some(applied(
            &format!("the approval policy {policy}"),
            "on-request",
        ));
    }
    if text(answer, "approvalsReviewer") != "auto_review" {
        let reviewer = shown(answer.get("approvalsReviewer"));
        return Some(applied(&format!("the reviewer {reviewer}"), "auto_review"));
    }
    None
}

/// The main checkout of the git repository whose working tree is `cwd`, as Codex keys a
/// project's trust: `cwd` itself for a main checkout, the folder holding the common git folder
/// for a linked worktree. None outside a repository, or for a bare one.
pub(super) fn git_main_root(cwd: &Path) -> Option<PathBuf> {
    let dot_git = cwd.join(".git");
    if fs::metadata(&dot_git).ok()?.is_dir() {
        return Some(cwd.to_owned());
    }
    let pointer = fs::read_to_string(&dot_git).ok()?;
    let pointer = pointer
        .lines()
        .find_map(|line| line.strip_prefix("gitdir:"))?
        .trim();
    let git_dir = cwd.join(pointer);
    let common = fs::read_to_string(git_dir.join("commondir")).ok()?;
    let common = plain(&git_dir.join(common.trim()));
    (common.file_name()? == ".git").then(|| common.parent().map(Path::to_owned))?
}

/// A path without its `.` and `..`, read as text.
fn plain(path: &Path) -> PathBuf {
    let mut plain = PathBuf::new();
    for part in path.components() {
        match part {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                plain.pop();
            }
            part => plain.push(part),
        }
    }
    plain
}

/// The trust level Codex gives the project of `cwd`, from the user's `projects` setting as
/// `config/read` gives it: the entry of `cwd`, else of its main checkout `root`, else of the
/// closest folder holding either; `trusted` without one, the level Codex then writes to the
/// user's settings and applies.
pub(super) fn trust(cwd: &Path, root: Option<&Path>, projects: Option<&Value>) -> String {
    let level_of = |path: &Path| {
        let entry = projects?.get(path.to_str()?)?;
        Some(entry.get("trust_level")?.as_str()?.to_owned())
    };
    let own = std::iter::once(cwd);
    let roots = root.into_iter().flat_map(Path::ancestors);
    let above = cwd.ancestors().skip(1);
    let level = own.chain(roots).chain(above).find_map(level_of);
    level.unwrap_or_else(|| "trusted".to_owned())
}
