//! The repository's configuration follows the toolchain decision: `just ready` runs every check
//! and CI runs it, no test is retried but the one exception the human ruled, no doctest is left
//! unrun, and every recipe that runs tests is isolated.
//!
//! These read the `justfile`, `.config/nextest.toml`, the crates' manifests, and CI's workflow,
//! as the tests of the earlier toolchain's configuration read its tasks.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use toml_edit::{DocumentMut, Item};

fn root() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.ancestors().nth(2).unwrap().to_owned()
}

fn read(path: &str) -> String {
    let file = root().join(path);
    fs::read_to_string(&file).unwrap_or_else(|error| panic!("{}: {error}", file.display()))
}

/// A recipe of the `justfile`: the recipes it runs first, and its commands' lines.
#[derive(Default)]
struct Recipe {
    first: Vec<String>,
    lines: Vec<String>,
}

/// The recipes of a `justfile`, by name.
fn recipes(justfile: &str) -> BTreeMap<String, Recipe> {
    let mut recipes: BTreeMap<String, Recipe> = BTreeMap::new();
    let mut current = None;
    for line in justfile.lines() {
        let head = line.chars().next();
        if head.is_some_and(char::is_whitespace) {
            if let Some(recipe) = current.as_ref().and_then(|name| recipes.get_mut(name)) {
                recipe.lines.push(line.trim().to_owned());
            }
            continue;
        }
        let named = head.is_some_and(|letter| letter.is_ascii_alphabetic() || letter == '_');
        let assigned = line.contains(":=") || line.starts_with("set ");
        let Some((name, after)) = line.split_once(':').filter(|_| named && !assigned) else {
            continue;
        };
        let name = name.split_whitespace().next().unwrap().to_owned();
        let first = after.split_whitespace().map(str::to_owned).collect();
        let lines = Vec::new();
        recipes.insert(name.clone(), Recipe { first, lines });
        current = Some(name);
    }
    recipes
}

/// A recipe and every recipe it runs first, however far.
fn runs(recipes: &BTreeMap<String, Recipe>, name: &str) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut next = vec![name.to_owned()];
    while let Some(name) = next.pop() {
        if found.insert(name.clone()) {
            next.extend(recipes[&name].first.iter().cloned());
        }
    }
    found
}

/// The `run:` commands of a workflow: a step's command, never its name or a comment.
fn run_commands(workflow: &str) -> Vec<String> {
    let mut commands = Vec::new();
    let mut block: Option<usize> = None;
    for line in workflow.lines() {
        let indent = line.len() - line.trim_start().len();
        let text = line.trim();
        if let Some(inside) = block {
            if text.is_empty() || indent > inside {
                commands.push(text.to_owned());
                continue;
            }
            block = None;
        }
        let Some(command) = text.trim_start_matches("- ").strip_prefix("run:") else {
            continue;
        };
        match command.trim() {
            "|" | ">" | "|-" | ">-" => block = Some(indent),
            command => commands.push(command.to_owned()),
        }
    }
    commands
}

#[test]
fn ready_runs_every_check_and_ci_runs_ready() {
    let recipes = recipes(&read("justfile"));
    let ready = runs(&recipes, "ready");
    let checks = [
        "fmt-check",
        "lint",
        "lint-app",
        "lint-workflows",
        "specs",
        "test",
        "app-check",
        "app-test",
    ];
    for check in checks {
        assert!(ready.contains(check), "`just ready` does not run `{check}`");
    }
    // A run that never ends, or opens the app, is no check: nothing waits for it.
    for never in ["app", "app-dev", "gallery", "sandbox"] {
        assert!(!ready.contains(never), "`just ready` runs `{never}`");
    }
    // The Rust tests are the whole workspace's: no package or filter narrows them.
    let test = &recipes["test"].lines;
    assert_eq!(test.len(), 1, "{test:?}");
    assert!(test[0].ends_with("cargo nextest run \"$@\""), "{}", test[0]);

    let ci = run_commands(&read(".github/workflows/ci.yml"));
    let runs_ready = |command: &String| command == "nix develop --command just ready";
    assert!(
        ci.iter().any(runs_ready),
        "no job of CI runs `just ready`: {ci:?}"
    );
}

#[test]
fn the_reader_of_a_workflow_takes_commands_and_no_name_or_comment() {
    let workflow = "jobs:\n  ready:\n    name: nix develop --command just ready\n    steps:\n      \
                    # run: nix develop --command just ready\n      \
                    - run: echo 'just ready'\n      - name: Check\n        run: |\n          \
                    git status\n          just ready\n      - uses: a\n";
    assert_eq!(
        run_commands(workflow),
        ["echo 'just ready'", "git status", "just ready"]
    );
}

/// The one exception to "a test runs once" (ruling R111): the checks that draw in real GTK
/// windows on a hidden display, which fail when other builds saturate the machine.
const RETRIED: &str = "package(uraeda-app) & binary(tests) & test(/^outside::/)";

/// The problems of cargo-nextest's configuration: a retry anywhere but the exception.
fn retried(nextest: &str) -> Vec<String> {
    let document: DocumentMut = nextest.parse().expect("nextest.toml reads");
    let mut found = Vec::new();
    let Some(profiles) = document.get("profile").and_then(Item::as_table_like) else {
        return found;
    };
    for (name, profile) in profiles.iter() {
        let Some(profile) = profile.as_table_like() else {
            continue;
        };
        if profile.contains_key("retries") {
            found.push(format!("the profile `{name}` retries every test"));
        }
        let overrides = profile.get("overrides").and_then(Item::as_array_of_tables);
        for table in overrides.into_iter().flatten() {
            let filter = table
                .get("filter")
                .and_then(Item::as_str)
                .unwrap_or_default();
            if table.contains_key("retries") && filter != RETRIED {
                found.push(format!("the profile `{name}` retries `{filter}`"));
            }
        }
    }
    found
}

#[test]
fn no_test_is_retried_but_the_checks_that_draw_in_real_windows() {
    let profile = "[profile.default]\nretries = 2\n";
    assert_eq!(
        retried(profile),
        ["the profile `default` retries every test"]
    );
    let other = "[[profile.ci.overrides]]\nfilter = \"package(uraeda-server)\"\nretries = 1\n";
    assert_eq!(
        retried(other),
        ["the profile `ci` retries `package(uraeda-server)`"]
    );
    let comment = "# No profile sets retries = 2.\n[profile.default]\nfail-fast = false\n";
    assert_eq!(retried(comment), Vec::<String>::new());

    assert_eq!(retried(&read(".config/nextest.toml")), Vec::<String>::new());
    // Nor by a recipe, a script, or a workflow.
    let mut files = vec!["justfile".to_owned()];
    for folder in ["scripts", ".github/workflows", ".github/actions/setup"] {
        for entry in fs::read_dir(root().join(folder)).unwrap() {
            let name = entry.unwrap().file_name().into_string().unwrap();
            files.push(format!("{folder}/{name}"));
        }
    }
    for file in files.iter().filter(|file| root().join(file).is_file()) {
        let text = read(file);
        for retry in ["NEXTEST_RETRIES", "--retries"] {
            assert!(
                !text.contains(retry),
                "`{file}` retries tests, with `{retry}`"
            );
        }
    }
}

// cargo-nextest runs no doctest: one in a crate that does not turn them off would never run.
#[test]
fn every_library_crate_turns_its_doctests_off() {
    let mut libraries = 0;
    for entry in fs::read_dir(root().join("crates")).unwrap() {
        let folder = entry.unwrap().path();
        if !folder.join("src/lib.rs").is_file() {
            continue;
        }
        libraries += 1;
        let manifest = fs::read_to_string(folder.join("Cargo.toml")).unwrap();
        let manifest: DocumentMut = manifest.parse().expect("a manifest reads");
        let doctest = manifest.get("lib").and_then(|lib| lib.get("doctest"));
        assert_eq!(
            doctest.and_then(Item::as_bool),
            Some(false),
            "{} must set `doctest = false` under `[lib]`",
            folder.display()
        );
    }
    assert!(libraries >= 8, "the crates were not read: {libraries}");
}

/// Whether a recipe's line runs tests: the Rust tests, or the app's on Native Shell's runner.
fn runs_tests(line: &str) -> bool {
    let rust = ["cargo nextest", "cargo test", "cargo llvm-cov nextest"];
    rust.iter().any(|runner| line.contains(runner)) || line.contains("{{ nsh }} test")
}

// Ruling R356: a run that is not a person's use of the app has data, configuration, cache, and
// state folders of its own, and the heavy ones share the machine's two slots.
#[test]
fn every_recipe_that_runs_tests_is_isolated_and_the_heavy_ones_take_a_slot() {
    let recipes = recipes(&read("justfile"));
    let mut seen = 0;
    for (name, recipe) in &recipes {
        for line in recipe.lines.iter().filter(|line| runs_tests(line)) {
            seen += 1;
            let isolated = line.contains("{{ isolated }}") || line.contains("{{ heavy }}");
            assert!(
                isolated,
                "`{name}` runs tests outside `scripts/isolated.sh`: {line}"
            );
        }
    }
    assert!(seen >= 8, "the recipes' test lines were not read: {seen}");
    let heavy = [
        ("lint", "cargo clippy"),
        ("test", "cargo nextest"),
        ("task", "cargo nextest"),
        ("app-test", "{{ nsh }} test"),
    ];
    for (name, command) in heavy {
        let lines = &recipes[name].lines;
        let line = lines.iter().find(|line| line.contains(command));
        let line = line.unwrap_or_else(|| panic!("`{name}` runs no `{command}`"));
        assert!(
            line.contains("{{ heavy }}"),
            "`{name}` takes no heavy slot: {line}"
        );
    }
}
