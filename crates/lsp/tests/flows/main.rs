//! The language server's flows: `ura lsp` driven in memory as an editor drives it, on real
//! repositories. One binary, one module per protocol area: `specs/done/2026-10-19-fix-testing.md`
//! says what they replaced. No flow asserts a label or a message's words, only positions, data, files,
//! and git.

#[path = "../common/mod.rs"]
mod common;

mod commands;
mod diagnostics;
mod fields;
mod reads;
mod writes;
