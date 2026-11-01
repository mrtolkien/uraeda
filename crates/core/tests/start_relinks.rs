//! A start relinks every file of `specs/` that linked the proposal file it moves: in the start
//! commit, put back on a hook's refusal, and rewritten in place but left out of the commit when the
//! file had uncommitted edits.

mod common;

use common::repo::TestRepo;
use uraeda_core::actions::start::{self, StartError};
use uraeda_core::api;
use uraeda_core::git::Git;
use uraeda_core::today::Date;
use uraeda_core::workspace::{Kind, Workspace};

const PROPOSAL_FILE: &str = "specs/proposals/cli-tuis.md";
const PROPOSAL: &str = "# CLI TUIs\n\n## What\n\nTUIs.\n";
const RECORD: &str = "specs/done/2026-10-10-cli-core.md";
const LINKED: &str = "# CLI core\n\nNext, [the draft](../proposals/cli-tuis.md).\n";
const RELINKED: &str = "# CLI core\n\nNext, [the draft](../2026-11-10-cli-tuis/proposal.md).\n";
const PRIORITIES: &str = "# Priorities\n\n## Now\n\n## Next\n\n- [CLI TUIs](proposals/cli-tuis.md)\n\n## Later\n\n## Blocked\n";

/// `main` with the proposal file, its line in Next, and a record linking it, commits deferred so a
/// refused start puts its files back.
fn with_record() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", PRIORITIES);
    repo.write(PROPOSAL_FILE, PROPOSAL);
    repo.write(RECORD, LINKED);
    repo.commit("chore: expand CLI TUIs");
    api::defer_commits(repo.path(), true);
    repo
}

/// Whether a start of the proposal file as `2026-11-10-cli-tuis` succeeded, or the API's error.
fn start(repo: &TestRepo) -> Result<(), api::ApiError> {
    api::start_planned(
        repo.path(),
        PROPOSAL_FILE,
        Some("cli-tuis"),
        Kind::Feature,
        "2026-11-10",
        &|_| {},
    )
    .map(drop)
}

// Breaks: a record left behind; a refused start leaving a rewritten record; the human's edit
// committed with the start; a file git ignores staged with the start.
/// US1 1, 2, 3, and SC-002 for the start; edge cases: a hook's refusal, a file no commit has.
#[test]
fn a_start_relinks_the_record() {
    let repo = with_record();

    start(&repo).unwrap();

    assert_eq!(repo.git(&["show", &format!("main:{RECORD}")]), RELINKED);
    assert!(repo.changed_in("main").contains(&RECORD.to_string()));
    assert_eq!(repo.porcelain(), "");

    let refusing = with_record();
    refusing.set_hook("exit 1");

    let refused = start(&refusing).unwrap_err();

    assert_eq!(refused.code, "hook", "{}", refused.message);
    assert_eq!(refusing.read(RECORD), LINKED);
    assert_eq!(refusing.read(PROPOSAL_FILE), PROPOSAL);
    assert_eq!(refusing.porcelain(), "");

    let left_written = with_record();
    left_written.set_hook("exit 1");
    let git = Git::discover(left_written.path()).unwrap();
    let workspace = Workspace::read(&git).unwrap();
    let today = Date::parse("2026-11-10").unwrap();

    let failed = start::run(
        &git,
        &workspace,
        PROPOSAL_FILE,
        None,
        Kind::Feature,
        today,
        false,
    );

    let Err(StartError::Partial { left, .. }) = failed else {
        panic!("a partial start");
    };
    assert_eq!(
        left[0],
        format!(
            "commit specs/PRIORITIES.md, the removal of {PROPOSAL_FILE}, {RECORD}, and \
             specs/2026-11-10-cli-tuis/ on main as \"chore(cli-tuis): start CLI TUIs\""
        )
    );
    assert_eq!(left_written.read(RECORD), RELINKED);

    let edited = with_record();
    edited.write(RECORD, &format!("{LINKED}\nEdited.\n"));

    start(&edited).unwrap();

    assert_eq!(edited.read(RECORD), format!("{RELINKED}\nEdited.\n"));
    assert!(!edited.changed_in("main").contains(&RECORD.to_string()));
    assert_eq!(edited.git(&["show", &format!("main:{RECORD}")]), LINKED);

    let ignored = with_record();
    ignored.write(".gitignore", "specs/local.md\n");
    ignored.write("specs/local.md", "[draft](proposals/cli-tuis.md)\n");

    start(&ignored).unwrap();

    assert_eq!(
        ignored.read("specs/local.md"),
        "[draft](2026-11-10-cli-tuis/proposal.md)\n"
    );
    assert!(
        !ignored
            .changed_in("main")
            .contains(&"specs/local.md".to_string())
    );

    let postponed = TestRepo::new();
    postponed.write("specs/README.md", "# Specs\n");
    postponed.write(
        "specs/PRIORITIES.md",
        &PRIORITIES.replace("cli-tuis.md", "cli-tuis/proposal.md"),
    );
    postponed.write(
        "specs/proposals/cli-tuis/proposal.md",
        "# CLI TUIs\n\n## What\n\n[Here](/specs/proposals/cli-tuis/), [here](../cli-tuis/).\n",
    );
    postponed.commit("chore: postpone CLI TUIs");

    api::start_planned(
        postponed.path(),
        "specs/proposals/cli-tuis/proposal.md",
        Some("cli-tuis"),
        Kind::Feature,
        "2026-11-10",
        &|_| {},
    )
    .unwrap();

    assert_eq!(
        postponed.read("specs/2026-11-10-cli-tuis/proposal.md"),
        "# CLI TUIs\n\n## What\n\n[Here](/specs/2026-11-10-cli-tuis/), [here](./).\n"
    );
}
