//! Uraeda's workflow logic, shared by the `ura` CLI and its `ura serve` pages.

pub mod actions;
pub mod api;
pub mod behind;
pub mod check;
mod compare;
pub mod decisions;
pub mod embedded;
pub mod files;
pub mod gates;
pub mod git;
pub mod images;
mod lock;
pub mod moves;
pub mod pulls;
pub mod repositories;
pub mod settings;
pub mod slug;
pub mod steps;
pub mod target;
pub mod today;
pub mod view;
pub mod workspace;
