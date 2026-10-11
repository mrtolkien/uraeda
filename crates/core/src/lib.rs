//! Uraeda's workflow logic, shared by the `ura` CLI and, through napi-rs, by the server.

pub mod actions;
pub mod check;
pub mod embedded;
pub mod files;
pub mod git;
pub mod slug;
pub mod steps;
pub mod target;
pub mod temporary_status;
pub mod today;
pub mod watch;
pub mod workspace;
