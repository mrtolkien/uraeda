//! The `ura` CLI's flows: the real binary, run on temporary git repositories, never asserting a
//! message's words, only exit codes, data (JSON), files, and git. One binary, one module per
//! command family: `specs/2026-10-19-fix-testing/rulings.md` says what each guards.

#[path = "../common/mod.rs"]
mod common;

mod answers;
mod check;
mod clean;
mod install;
mod lsp_command;
mod next_status;
mod notes;
mod repo_rules;
mod reviews;
mod start;
