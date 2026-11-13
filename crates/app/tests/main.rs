//! The app crate's integration tests, in one program: each file of `tests/` is a module. One
//! program links the app, Native Shell, and GTK once, where a program per file linked them ten
//! times.
//!
//! A test is named by its module: `cargo nextest run -p uraeda-app -E 'test(/^outside::/)'`
//! runs the checks of what the app assumes of Native Shell.

mod extensions;
mod host;
mod isolated;
mod keys;
mod layers;
mod native;
mod outside;
mod package;
mod parity;
mod shaders;
mod theme;

/// Every test file of `tests/` is a module of this program: a file left out would never run.
#[test]
fn every_test_file_is_a_module_of_this_program() {
    let tests = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests");
    let main = std::fs::read_to_string(tests.join("main.rs")).expect("tests/main.rs");
    let entries = std::fs::read_dir(&tests)
        .expect("the tests' folder")
        .flatten();
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
