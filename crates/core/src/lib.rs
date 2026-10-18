//! Uraeda's workflow logic, shared by the `ura` CLI and, through napi-rs, by the server.

pub mod actions;
pub mod api;
pub mod changes;
pub mod check;
pub mod decisions;
pub mod embedded;
pub mod files;
pub mod gates;
pub mod git;
pub mod history;
pub mod images;
pub mod pulls;
pub mod repositories;
pub mod settings;
pub mod slug;
pub mod steps;
pub mod target;
pub mod today;
pub mod view;
pub mod watch;
pub mod workspace;
