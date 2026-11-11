//! The list of what the app's TSX imports from `uraeda/native`. Nothing is written here but the
//! list: each part of the app keeps its Rust in a file of its own, beside this one, and adds one
//! line to [`register`].
//!
//! To export functions, as `about.rs` does:
//!
//! 1. In a new file, `crates/app/src/<part>.rs`, write a unit struct with `#[module]`, and its
//!    `impl` with `#[module(flat)]`. Each `pub(crate) fn` of the block is one export, under its
//!    name in camel case: TSX imports `fn first_line` as `firstLine`. Without `flat`, TSX imports
//!    the struct's name, an object with the functions.
//! 2. Give the struct and each function a doc comment: it is the export's documentation in
//!    TypeScript, and `tests/native.rs` fails without one.
//! 3. Name the file in `lib.rs`, `mod <part>;`, and add `.module::<crate::<part>::<Struct>>()`
//!    below.
//!
//! TypeScript's types come from Rust's: `vp run app:check` writes them in
//! `app/.nsh/types/uraeda/native.d.ts`, then checks the TSX against them. A function that is
//! neither `async` nor takes a `ModuleCx` returns its value inside the TSX call; the others return
//! a promise. A struct TSX reads or writes derives `JsObject`.
//!
//! A class, `#[class]` on a struct and its `impl`, is added with `.class::<..>()`: TSX makes it
//! with `new`, and its state stays in Rust. A component, `#[component]` on a function, is added
//! with `.register::<..>()`.
//!
//! Every export shares the module's one set of names: a function's name has to say enough alone,
//! or its part drops `flat`.

use nsh_core::prelude::*;

/// Adds every export of `uraeda/native` to `registry`, one line for each part.
pub(crate) fn register(registry: &mut Registry) {
    registry.module::<crate::about::About>();
    // The files of `assets/`, the bundled fonts, which Native Shell registers before the first frame.
    registry.assets(assets!());
    registry.module::<crate::fonts::Fonts>();
    registry.module::<crate::theme::Theme>();
    registry.module::<crate::diagram::Diagrams>();
    registry.module::<crate::highlight::Highlight>();
    registry.module::<crate::time::Clocks>();
    registry
        .module::<crate::reply::Markdown>()
        .class::<crate::reply::ReplySplitter>();
    registry
        .module::<crate::vim_bridge::VimBridge>()
        .register::<crate::vim_bridge::TextEditor>();
}
