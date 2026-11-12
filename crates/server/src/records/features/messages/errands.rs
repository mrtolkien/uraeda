//! The messages of the errands an agent runs outside a feature's steps: postponing a feature or a
//! change, and writing and applying a decisions check. Each names the skill's reference it
//! follows, and where the agent stops.

/// The message that asks for a decisions check, `specs/DECISIONS-CHECK.md`.
pub(super) const CHECK_DECISIONS: &str = "/uraeda Check the decisions: write specs/DECISIONS-CHECK.md, \
     following references/decisions-check.md. Stop when the check waits for my answers.";

/// The message that applies the human's answers to the decisions check.
pub(super) const APPLY_DECISIONS_CHECK: &str = "/uraeda Apply my answers in specs/DECISIONS-CHECK.md, \
     following references/decisions-check.md.";

/// The message that postpones the feature or the change of `kind` in `path`, on `branch`, as
/// "Postpone or block" in `references/projects.md` says: its proposal written, its line in Later.
pub(super) fn postpone(kind: &str, path: &str, branch: &str) -> String {
    format!(
        "/uraeda Postpone the {kind} {path}/ on branch {branch}, following \"Postpone or block\" \
         in skills/uraeda/references/projects.md: write its proposal, and move its line to \
         Later.\nStop when it is postponed, and earlier only if you need a decision from me.\n"
    )
}
