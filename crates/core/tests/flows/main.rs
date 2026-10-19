//! The core's flows: the workflow's rules, run through the public API on real repositories.
//! One binary, one module per area: `specs/done/2026-10-19-fix-testing.md` says what the flows replaced.

#[path = "../common/mod.rs"]
mod common;

mod api_files;
mod attachments;
mod check;
mod clock;
mod decisions;
mod draft_images;
mod git_contract;
mod history;
mod notes;
mod repositories;
mod reviews;
mod rounds;
mod runs;
mod settings;
mod steps;
mod support;
mod text_kept;
mod undo;
mod views;
mod watch;
