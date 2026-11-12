//! What the app tells Codex of every session it runs: the instructions every built-in agent is
//! given, `built_in::instructions`, then its sandbox's section. Codex's runtime gives them as a
//! thread's developer instructions.
//!
//! The sandbox's words are the Node server's,
//! as they were when the runtime was ported.

use std::path::Path;

use super::super::built_in;

/// The developer instructions of every thread: the app's, with the section on extensions, then
/// the sandbox's. `folder` is the owner's extensions folder, and `docs` the documentation of
/// the extension API.
pub(super) fn instructions(folder: &Path, docs: &Path) -> String {
    let app = built_in::instructions(folder, docs);
    let folder = folder.display();
    format!(
        "{app}\n# Sandbox\n\n{SANDBOX} Writing in `{folder}`, your extensions folder, needs \
         escalated permissions too, from its first try. {NEVER}\n"
    )
}

/// What Codex cannot do without escalating, so it asks its reviewer instead of failing, or
/// working around the sandbox. The extensions folder is not writable: Uraeda runs what it
/// holds, so each write there is reviewed first.
const SANDBOX: &str = r#"Your commands run in a sandbox: you write in the working directory only, git's own folder is read-only, and the network is off. So run every git command that writes, as `git add`, `git commit`, `git mv`, and `git worktree add`, and every command that uses the network, as `git push` and `gh`, with escalated permissions from its first try (`sandbox_permissions: "require_escalated"`, with a one-line justification): a reviewer approves each before it runs, and you are allowed to ask."#;

const NEVER: &str = "Never work around the sandbox, and never stop at a git command the sandbox refused: run it again with escalated permissions.";
