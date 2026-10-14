//! Uraeda's workflow logic, shared by the `ura` CLI and, through napi-rs, by the server.

pub mod actions;
pub mod api;
pub mod check;
pub mod embedded;
pub mod files;
pub mod gates;
pub mod git;
pub mod repositories;
pub mod slug;
pub mod steps;
pub mod target;
pub mod today;
pub mod view;
pub mod watch;
pub mod workspace;
