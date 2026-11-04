//! A file's diff, from `HEAD` to the working tree or across a commit, and a commit's files.

mod common;

use common::repo::TestRepo;
use uraeda_core::git::{DIFF_CAP, DiffOf, Git};

fn lines(range: std::ops::Range<u32>) -> String {
    range.map(|n| format!("line {n}\n")).collect()
}

/// A PNG-like file of `size` bytes: its signature holds a NUL, as git looks for.
fn png(size: usize) -> Vec<u8> {
    let mut bytes = vec![
        0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n', 0, 0, 0, 13,
    ];
    bytes.resize(size, 7);
    bytes
}

/// US2 1, more 1, and more 2: a text file's diff is unified, a binary file's gives its sizes, and
/// one over the cap gives its counts alone until the whole is asked for. Breaks: counting the
/// context as changed lines; diffing a binary file as text; capping on the file's lines rather
/// than the diff's.
#[test]
fn a_diff_is_unified_binary_or_capped() {
    let repo = TestRepo::new();
    let path = "crates/core/src/git.rs";
    repo.write(path, &lines(0..20));
    repo.write_bytes("logo.png", &png(12_288));
    repo.commit("chore: files");
    let edited = format!("{}{}{}", lines(0..9), lines(100..104), lines(10..20));
    repo.write(path, &edited);
    repo.write_bytes("logo.png", &png(14_336));
    repo.write("big.txt", &lines(0..3_000));
    let git = Git::discover(repo.path()).unwrap();

    let text = git.file_diff(DiffOf::Worktree, path, false).unwrap();
    assert_eq!((text.added, text.removed, text.binary), (4, 1, None));
    let unified = text.text.unwrap();
    assert!(unified.starts_with(&format!("--- a/{path}\n+++ b/{path}\n@@ -7,7 +7,10 @@\n")));
    assert_eq!(unified.matches("\n@@ ").count(), 1, "{unified}");
    assert!(unified.contains("\n-line 9\n+line 100\n"), "{unified}");

    let binary = git.file_diff(DiffOf::Worktree, "logo.png", false).unwrap();
    assert_eq!((binary.binary, binary.text), (Some((12_288, 14_336)), None));

    let capped = git.file_diff(DiffOf::Worktree, "big.txt", false).unwrap();
    assert!(capped.is_capped && capped.text.is_none());
    assert_eq!((capped.added, capped.removed), (3_000, 0));
    let whole = git.file_diff(DiffOf::Worktree, "big.txt", true).unwrap();
    assert!(!whole.is_capped);
    assert!(whole.text.unwrap().lines().count() > DIFF_CAP);
}

/// US2 3: a commit lists the files it changed, each with its counts, and its diff is from its
/// parent. Break: diffing against `HEAD` rather than the commit's first parent.
#[test]
fn a_commit_lists_its_files_with_their_counts() {
    let repo = TestRepo::new();
    repo.write("docs/web-ui.md", &lines(0..5));
    repo.commit("docs: web ui");
    repo.write("docs/web-ui.md", &format!("{}line 9\n", lines(0..4)));
    repo.write("specs/INBOX.md", "# Inbox\n\n- note\n");
    repo.commit("feat(vim-mode): selected text stays visible in visual mode\n\nThe body.");
    let id = Git::discover(repo.path()).unwrap().head().unwrap();
    repo.write("docs/web-ui.md", "later\n");
    repo.commit("docs: later");
    let git = Git::discover(repo.path()).unwrap();

    let commit = git.commit_files(id).unwrap();

    assert_eq!(
        commit.subject,
        "feat(vim-mode): selected text stays visible in visual mode"
    );
    assert_eq!(commit.body, "The body.");
    let counts: Vec<_> = commit
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.added, file.removed))
        .collect();
    assert_eq!(
        counts,
        [
            ("docs/web-ui.md", Some(1), Some(1)),
            ("specs/INBOX.md", Some(3), Some(0))
        ]
    );
    let diff = git
        .file_diff(DiffOf::Commit(id), "docs/web-ui.md", false)
        .unwrap();
    assert!(diff.text.unwrap().contains("\n-line 4\n+line 9\n"));
}
