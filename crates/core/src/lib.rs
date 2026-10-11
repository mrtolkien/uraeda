//! Uraeda's workflow logic, shared by the `ura` CLI and, through napi-rs, by the server.

pub mod check;
pub mod embedded;
pub mod files;
pub mod git;
pub mod steps;
pub mod temporary_status;
pub mod today;
pub mod workspace;
