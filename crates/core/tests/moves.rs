//! Where a file of `specs/` missing at a commit went, read from the commit's history.

mod common;

use common::repo::TestRepo;
use uraeda_core::git::Git;
use uraeda_core::moves::{History, Went};

/// Numbered lines `<word> 1` to `<word> <count>`, for texts git compares line by line.
fn lines(word: &str, count: usize) -> String {
    (1..=count).map(|n| format!("{word} {n}\n")).collect()
}

/// The first 7 characters of `HEAD`'s hash.
fn short_head(repo: &TestRepo) -> String {
    repo.git(&["rev-parse", "--short=7", "HEAD"])
        .trim()
        .to_string()
}

/// Commits that look like moves and are not, and moves that look like none: a rename beside a
/// deletion, an unrelated note added beside a deleted one with a subject holding `\x01`, a file
/// moved, deleted, and added again, and a note folder made a proposal folder, its main file
/// rewritten. Returns the deletion's commit and the note's.
fn commit_lookalikes(repo: &TestRepo) -> (String, String) {
    repo.write("specs/proposals/a.md", &lines("a", 10));
    repo.write("specs/proposals/c.md", &lines("c", 10));
    repo.write("specs/notes/old.md", &lines("old", 10));
    repo.write("specs/decisions/first.md", &lines("first", 10));
    repo.write("specs/notes/x/note.md", &lines("x", 10));
    repo.write("specs/notes/x/images/i.png", &lines("png", 10));
    repo.commit("chore: lookalikes");
    repo.git(&["mv", "specs/proposals/a.md", "specs/proposals/b.md"]);
    repo.remove("specs/proposals/c.md");
    repo.commit("chore: rename a, drop c");
    let dropped = short_head(repo);
    repo.remove("specs/notes/old.md");
    repo.write("specs/notes/new.md", &lines("new", 10));
    repo.commit("chore: notes \u{1} swap");
    let swapped = short_head(repo);
    repo.git(&[
        "mv",
        "specs/decisions/first.md",
        "specs/decisions/second.md",
    ]);
    repo.commit("decision: rename first");
    repo.remove("specs/decisions/second.md");
    repo.commit("decision: drop second");
    repo.write("specs/decisions/second.md", &lines("second", 10));
    repo.commit("decision: a new second");
    repo.remove("specs/notes/x/images/i.png");
    repo.write("specs/proposals/x/images/i.png", &lines("png", 10));
    repo.remove("specs/notes/x/note.md");
    repo.write("specs/proposals/x/proposal.md", &lines("proposal", 10));
    repo.commit("chore: make the note x a proposal");
    (dropped, swapped)
}

/// A missing path is followed through git's renames, a start's pairing, a change made a feature,
/// and a finish, to its end, and a path that never existed or still exists has nowhere to go. The
/// lookalikes read as what they are.
#[test]
fn a_missing_path_is_followed_to_where_it_went() {
    let repo = TestRepo::new();
    repo.write("specs/proposals/thing.md", &lines("idea", 30));
    repo.write("specs/decisions/old-name.md", &lines("rule", 10));
    repo.write(
        "specs/changes/2026-10-02-fix/proposal.md",
        &lines("fix", 10),
    );
    repo.write("specs/notes/back.md", &lines("note", 10));
    repo.write("specs/2026-10-03-dark-mode/proposal.md", &lines("dark", 10));
    repo.commit("chore: proposals");

    // The start keeps about a third of the proposal: below git's rename threshold.
    repo.remove("specs/proposals/thing.md");
    let started = format!("{}{}", lines("idea", 10), lines("plan", 20));
    repo.write("specs/2026-10-01-thing/proposal.md", &started);
    repo.commit("chore(thing): start Thing");
    repo.write("specs/2026-10-01-thing/spec.md", &lines("story", 10));
    repo.commit("spec(thing): write");
    repo.remove("specs/2026-10-01-thing/proposal.md");
    repo.remove("specs/2026-10-01-thing/spec.md");
    repo.write("specs/done/2026-10-01-thing.md", &lines("record", 10));
    repo.commit("finish(thing): Thing");

    repo.git(&[
        "mv",
        "specs/decisions/old-name.md",
        "specs/decisions/new-name.md",
    ]);
    repo.commit("decision: rename");
    repo.git(&["mv", "specs/changes/2026-10-02-fix", "specs/2026-10-02-fix"]);
    repo.commit("chore(fix): make the change a feature");
    repo.git(&["mv", "specs/notes/back.md", "specs/proposals/back.md"]);
    repo.commit("chore: make the note a proposal");
    repo.git(&["mv", "specs/proposals/back.md", "specs/notes/back.md"]);
    repo.commit("chore: undo");
    repo.remove("specs/2026-10-03-dark-mode/proposal.md");
    repo.commit("chore(dark-mode): drop Dark mode");
    let dropped = short_head(&repo);
    let (dropped_c, swapped) = commit_lookalikes(&repo);

    let git = Git::open(repo.path()).unwrap();
    let history = History::read(&git, git.head().unwrap()).unwrap();
    let record = Went::Record("specs/done/2026-10-01-thing.md".into());
    let moved = |path: &str| Went::Moved {
        path: path.into(),
        anchor: None,
    };
    for (path, went) in [
        ("specs/proposals/thing.md", Some(record.clone())),
        ("specs/2026-10-01-thing/proposal.md", Some(record.clone())),
        ("specs/2026-10-01-thing", Some(record.clone())),
        ("specs/2026-10-01-thing/", Some(record)),
        (
            "specs/decisions/old-name.md",
            Some(moved("specs/decisions/new-name.md")),
        ),
        (
            "specs/changes/2026-10-02-fix/proposal.md",
            Some(moved("specs/2026-10-02-fix/proposal.md")),
        ),
        (
            "specs/2026-10-03-dark-mode/proposal.md",
            Some(Went::Deleted {
                commit: dropped,
                subject: "chore(dark-mode): drop Dark mode".into(),
            }),
        ),
        (
            "specs/proposals/c.md",
            Some(Went::Deleted {
                commit: dropped_c,
                subject: "chore: rename a, drop c".into(),
            }),
        ),
        (
            "specs/notes/old.md",
            Some(Went::Deleted {
                commit: swapped,
                subject: "chore: notes \u{1} swap".into(),
            }),
        ),
        (
            "specs/decisions/first.md",
            Some(moved("specs/decisions/second.md")),
        ),
        ("specs/notes/x", Some(moved("specs/proposals/x"))),
        ("specs/proposals/gone.md", None),
        ("specs/notes/back.md", None),
    ] {
        assert_eq!(history.went(path), went, "{path}");
    }
}
