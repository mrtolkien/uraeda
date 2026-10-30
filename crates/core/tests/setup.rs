mod common;

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::embedded;

const CONSTITUTION: &str = "specs/CONSTITUTION.md";

/// A file of a row's repository, by path.
type File = (&'static str, String);

/// An item as a row expects it, by key and state.
type Pair = (&'static str, &'static str);

/// The template's constitution with every placeholder written.
fn written() -> String {
    template()
        .replace("[Project]", "Todo")
        .replace("### I. [Principle name]", "### I. Users own their data")
        .replace("### II. [Principle name]", "### II. Offline first")
        .replace(
            "[Rule written with MUST, MUST NOT, or SHOULD]",
            "Data MUST stay local.",
        )
        .replace("[Rule]", "Sync SHOULD be optional.")
        .replace(
            "[why this principle exists, to help with cases the rules don't cover]",
            "trust.",
        )
        .replace("[why]", "networks fail.")
        .replace("[YYYY-MM-DD]", "2026-10-30")
}

fn template() -> String {
    embedded::template("CONSTITUTION.md").unwrap().to_string()
}

/// A repository with one commit, holding `files`.
fn repository(files: &[File]) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("README.md", "# Todo\n");
    for (path, text) in files {
        repo.write(path, text);
    }
    repo.commit("init");
    repo
}

fn decision(status: &str) -> String {
    format!("---\nstatus: {status}\n---\n\n# A decision\n")
}

/// SC-005: the setup's items for each state of a project, as `(key, state)` pairs, or none once it
/// is set up. Each row names the break it catches.
#[test]
fn setup_items() {
    let missing_decisions = [
        ("code-quality", "missing"),
        ("testing", "missing"),
        ("preview", "missing"),
    ];
    let template_left = |pairs: &[Pair]| {
        let mut all = vec![("constitution", "template")];
        all.extend_from_slice(pairs);
        all
    };
    let half_written = written().replace("### II. Offline first", "### II. [Principle name]");
    let dates_left =
        written().replacen("**Ratified**: 2026-10-30", "**Ratified**: [YYYY-MM-DD]", 1);
    let with_link = written().replace(
        "- Data MUST stay local.",
        "- Data MUST stay local, as [the guide](docs/x.md) says.",
    );
    let rule_left = written().replace("- Sync SHOULD be optional.", "- [Rule]");
    let other_brackets = written().replace(
        "- Data MUST stay local.",
        "- [x] Data MUST stay local, as [[storage]] and [the guide] say[^1].\n- Ranges are [0, 1).\n\n[the guide]: docs/x.md",
    );
    let rows: Vec<(&str, Vec<File>, Vec<Pair>)> = vec![
        // A view that skips the check without `specs/`.
        (
            "no_specs",
            vec![],
            [("specs", "missing"), ("constitution", "missing")]
                .into_iter()
                .chain(missing_decisions)
                .collect(),
        ),
        // A template read as written, or a missing `decisions/` read as an error.
        (
            "after_init",
            vec![(CONSTITUTION, template())],
            template_left(&missing_decisions),
        ),
        // A check of the title alone.
        (
            "half_written",
            vec![(CONSTITUTION, half_written)],
            template_left(&missing_decisions),
        ),
        (
            "dates_left",
            vec![(CONSTITUTION, dates_left)],
            template_left(&missing_decisions),
        ),
        // A check that skips the rules.
        (
            "rule_left",
            vec![(CONSTITUTION, rule_left)],
            template_left(&missing_decisions),
        ),
        // Any bracket read as a placeholder.
        (
            "link_in_rule",
            vec![(CONSTITUTION, with_link)],
            [("constitution", "written")]
                .into_iter()
                .chain(missing_decisions)
                .collect(),
        ),
        // A task box, a wikilink, a shortcut reference, a footnote, or an unclosed bracket read as
        // a placeholder.
        (
            "other_brackets",
            vec![(CONSTITUTION, other_brackets)],
            [("constitution", "written")]
                .into_iter()
                .chain(missing_decisions)
                .collect(),
        ),
        // A decision read from the wrong folder.
        (
            "one_left",
            vec![
                (CONSTITUTION, written()),
                ("specs/decisions/code-quality.md", decision("active")),
                ("specs/decisions/preview.md", decision("active")),
            ],
            vec![
                ("constitution", "written"),
                ("code-quality", "written"),
                ("testing", "missing"),
                ("preview", "written"),
            ],
        ),
        // An optional preview, or a `proposed` status, that keeps the pane.
        (
            "set_up",
            vec![
                (CONSTITUTION, written()),
                ("specs/decisions/code-quality.md", decision("proposed")),
                ("specs/decisions/testing.md", decision("proposed")),
            ],
            vec![],
        ),
    ];
    assert_rows(rows);
}

/// Asserts each row's items, as `(key, state)` pairs, read through the workspace's view.
fn assert_rows(rows: Vec<(&str, Vec<File>, Vec<Pair>)>) {
    for (row, files, expected) in rows {
        let repo = repository(&files);
        let setup = api::read_workspace(repo.path()).unwrap().setup;
        let pairs: Vec<_> = setup
            .iter()
            .map(|item| (item.key.as_str(), item.state.as_str()))
            .collect();
        assert_eq!(pairs, expected, "{row}");
        if row == "no_specs" {
            assert!(setup[0].required, "specs is required");
            assert!(!setup[4].required, "preview is optional");
        }
    }
}
