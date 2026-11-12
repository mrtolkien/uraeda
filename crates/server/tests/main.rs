//! The server's integration tests, in one program: each file of `tests/` is a module, and
//! `support/` is what they share. One program links the server once, where a program per file
//! linked it 25 times, 10 GB of a cold build.
//!
//! A test is named by its module: `cargo nextest run -p uraeda-server -E 'test(/^browser::/)'`
//! runs the browser's, and `cargo test -p uraeda-server --test tests -- sessions::` those of
//! the sessions.

mod support;
mod accounts;
mod browser;
mod claude;
mod codex;
mod diagram;
mod extension_pages;
mod extensions_vm;
mod features;
mod files;
mod git;
mod jobs;
mod live;
mod mcp;
mod parity;
mod preview;
mod pulls;
mod runner_store;
mod runtimes;
mod sandbox;
mod sessions;
mod sign_in;
mod skeleton;
mod web;
mod workspace;
mod writing;

/// Every test file of `tests/` is a module of this program: a file left out would never run.
#[test]
fn every_test_file_is_a_module_of_this_program() {
    let tests = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests");
    let main = std::fs::read_to_string(tests.join("main.rs")).expect("tests/main.rs");
    let entries = std::fs::read_dir(&tests).expect("the tests' folder").flatten();
    let files = entries.filter_map(|entry| entry.file_name().into_string().ok());
    let mut missing: Vec<String> = files
        .filter_map(|name| name.strip_suffix(".rs").map(str::to_owned))
        .filter(|name| name != "main" && !main.contains(&format!("\nmod {name};\n")))
        .collect();
    missing.sort();
    assert!(
        missing.is_empty(),
        "tests/{missing:?} are not modules of tests/main.rs, so they never run: add `mod <name>;` \
         for each to tests/main.rs, in its order"
    );
}
