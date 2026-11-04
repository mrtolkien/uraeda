//! The Git page's writes, as the web reaches them: each writes only a file or a worktree the page
//! lists, and none forces.

mod common;

use std::fs;

use common::repo::TestRepo;
use common::texts::{proposal, record};
use uraeda_core::actions::place;
use uraeda_core::api::{self, ApiError};
use uraeda_core::files::document::hash;
use uraeda_core::git::Git;

const FOLDER: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";
const PRIORITIES: &str = "specs/PRIORITIES.md";

/// A merged feature whose branch stays checked out in its worktree, as `ura clean` finds it; a
/// hand-made worktree, `.worktrees/coherence-before`, on a branch of its own; one with an
/// untracked file; and one whose folder was deleted.
fn worktrees() -> TestRepo {
    let repo = TestRepo::new();
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.commit("chore: proposal");
    repo.git(&["rm", "-r", "--quiet", "specs/2026-10-11-web-ui"]);
    repo.write(
        &format!("specs/done/{FOLDER}.md"),
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    repo.git(&["merge", "--quiet", "--ff-only", FOLDER]);
    place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    for name in ["coherence-before", "busy", "gone"] {
        let path = format!(".worktrees/{name}");
        repo.git(&["worktree", "add", "--quiet", "-b", name, &path]);
    }
    repo.write(".worktrees/busy/notes.txt", "mine\n");
    fs::remove_dir_all(repo.path().join(".worktrees/gone")).unwrap();
    repo
}

fn refused<T: std::fmt::Debug>(result: Result<T, ApiError>) -> String {
    match result {
        Err(error) if error.code == "refused" => error.message,
        other => panic!("not refused: {other:?}"),
    }
}

fn listed(repo: &TestRepo, path: &str) -> bool {
    repo.git(&["worktree", "list", "--porcelain"])
        .lines()
        .any(|line| line.ends_with(&format!("/{path}")))
}

/// US6 1, 2; SC-003 (removal); Review focus 1; US3 more 6, a hook's refusal keeps its output; a
/// conflicted file saves over the hash it was read at. Breaks: `save_conflict_file` writing any
/// path, which writes the file that is not conflicted; `--force` on removal, which removes the
/// worktree with changes; a commit's failure mapped as any git error, which drops the hook's output.
#[test]
fn the_page_writes_only_what_it_lists() {
    let repo = worktrees();
    let at = repo.path();
    let readme = repo.read("README.md");

    let save = api::save_conflict_file(at, "README.md", "mine\n", &hash(&readme));
    assert_eq!(refused(save), "README.md has no conflict.");
    assert_eq!(repo.read("README.md"), readme);
    let save = api::save_conflict_file(at, "../x", "mine\n", &hash(""));
    assert_eq!(refused(save), "../x is not in this checkout.");
    assert!(!repo.parent().join("x").exists());

    let stage = api::git_stage(at, None, &["/etc/passwd".to_string()]);
    assert_eq!(refused(stage), "/etc/passwd is not in this checkout.");
    let stage = api::git_stage(at, Some("2026-01-01-nothing"), &["README.md".to_string()]);
    assert_eq!(refused(stage), "no feature 2026-01-01-nothing");

    let main = at.to_string_lossy().into_owned();
    for path in [".", "", main.as_str(), "specs", "../repo"] {
        let removed = api::git_remove_worktree(at, path);
        assert_eq!(refused(removed), format!("{path} is not a worktree."));
    }
    let removed = api::git_remove_worktree(at, ".worktrees/busy");
    assert_eq!(
        refused(removed),
        ".worktrees/busy has changes: commit or discard them first."
    );
    assert!(repo.exists(".worktrees/busy/notes.txt"));

    api::git_remove_worktree(at, ".worktrees/coherence-before").unwrap();
    assert!(!repo.exists(".worktrees/coherence-before"));
    assert!(!listed(&repo, ".worktrees/coherence-before"));
    assert!(repo.try_git(&["rev-parse", "--verify", "--quiet", "coherence-before"]));

    assert!(listed(&repo, ".worktrees/gone"));
    api::git_remove_worktree(at, ".worktrees/gone").unwrap();
    assert!(!listed(&repo, ".worktrees/gone"));

    api::clean_feature(at, FOLDER).unwrap();
    assert!(!repo.exists(WORKTREE));
    assert!(!repo.try_git(&["rev-parse", "--verify", "--quiet", FOLDER]));

    repo.set_hook("echo 'lint: README.md is wrong'\nexit 1");
    repo.write("README.md", "# Changed\n");
    api::git_stage(at, None, &["README.md".to_string()]).unwrap();
    let error = api::git_commit_staged(at, None, "docs: readme", |_| {}).unwrap_err();
    assert_eq!(error.code, "hook");
    assert!(error.output.unwrap().contains("lint: README.md is wrong"));
    assert_eq!(repo.staged(), ["README.md"]);
    repo.commit("docs: readme");

    repo.stopped_merge();
    let text = repo.read(PRIORITIES);
    let stale = api::save_conflict_file(at, PRIORITIES, "# Mine\n", &hash("other"));
    assert_eq!(stale.unwrap_err().code, "conflict");
    assert_eq!(repo.read(PRIORITIES), text);
    let saved = api::save_conflict_file(at, PRIORITIES, "# Mine\n", &hash(&text)).unwrap();
    assert_eq!(
        (saved.text.as_str(), saved.hash),
        ("# Mine\n", hash("# Mine\n"))
    );
    assert_eq!(repo.read(PRIORITIES), "# Mine\n");
}
