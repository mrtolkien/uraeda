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
/// untracked file; two whose folder was deleted; and a locked one whose folder was deleted.
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
    for name in ["coherence-before", "busy", "gone", "gone-too", "held"] {
        let path = format!(".worktrees/{name}");
        repo.git(&["worktree", "add", "--quiet", "-b", name, &path]);
    }
    repo.write(".worktrees/busy/notes.txt", "mine\n");
    repo.git(&["worktree", "lock", ".worktrees/held"]);
    for name in ["gone", "gone-too", "held"] {
        fs::remove_dir_all(repo.path().join(".worktrees").join(name)).unwrap();
    }
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
/// worktree with changes; a commit's failure mapped as any git error, which drops the hook's output;
/// the view's path of a worktree outside the main checkout made absolute, which removal never finds.
#[test]
fn the_page_writes_only_what_it_lists() {
    let repo = worktrees();
    let at = repo.path();
    let readme = repo.read("README.md");

    let save = api::save_conflict_file(at, "README.md", "mine\n", &hash(&readme));
    assert_eq!(refused(save), "README.md has no conflict.");
    assert_eq!(repo.read("README.md"), readme);
    fs::write(repo.parent().join("x"), "outside\n").unwrap();
    let save = api::save_conflict_file(at, "../x", "mine\n", &hash("outside\n"));
    assert_eq!(refused(save), "../x is not in this checkout.");
    assert_eq!(
        fs::read_to_string(repo.parent().join("x")).unwrap(),
        "outside\n"
    );

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
    assert!(listed(&repo, ".worktrees/gone-too"));
    let removed = api::git_remove_worktree(at, ".worktrees/held");
    assert_eq!(
        refused(removed),
        ".worktrees/held is locked: unlock it first."
    );
    assert!(listed(&repo, ".worktrees/held"));

    // Final review I3: a worktree outside the main checkout is removed at the path the page shows.
    repo.git(&["worktree", "add", "--quiet", "-b", "spike", "../repo-spike"]);
    let page = api::git_page(at).unwrap();
    let spike = page
        .worktrees
        .iter()
        .find(|worktree| worktree.branch.as_deref() == Some("spike"));
    let spike = spike.unwrap().path.clone();
    assert_eq!(spike, "../repo-spike");
    api::git_remove_worktree(at, &spike).unwrap();
    assert!(!repo.parent().join("repo-spike").exists());

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
    // Final review M1: the blank lines around a typed message are no empty subject.
    repo.set_hook("exit 0");
    let committed = api::git_commit_staged(at, None, "\n  \ndocs: readme\n\nWhy.\n\n", |_| {});
    assert_eq!(committed.unwrap().subject, "docs: readme");
    let head = repo.git(&["cat-file", "commit", "HEAD"]);
    assert!(head.ends_with("\n\ndocs: readme\n\nWhy.\n"), "{head}");

    let merge = api::git_merge(at, "HEAD~1", |_| {});
    assert_eq!(refused(merge), "HEAD~1 is not a branch to merge.");
    api::git_merge(at, "coherence-before", |_| {}).unwrap();

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

    // A conflicted file gone from disk is no empty text to save over; a link is not followed.
    repo.remove(PRIORITIES);
    let save = api::save_conflict_file(at, PRIORITIES, "# Mine\n", &hash(""));
    assert!(refused(save).starts_with("cannot read specs/PRIORITIES.md"));
    assert!(!repo.exists(PRIORITIES));
    std::os::unix::fs::symlink(repo.parent().join("x"), repo.path().join(PRIORITIES)).unwrap();
    let read = api::conflict_file(at, PRIORITIES);
    assert_eq!(
        refused(read),
        "specs/PRIORITIES.md is not in this checkout."
    );
}

/// The fetcher's fetch runs every 5 minutes: a slow `origin` holds no other write of the
/// repository behind it. Break caught: `git_fetch` under the write lock, which holds the stage
/// until the fetch ends.
#[test]
fn a_slow_fetch_holds_no_other_write() {
    let repo = TestRepo::with_origin();
    repo.git(&[
        "config",
        "remote.origin.uploadpack",
        "sleep 3; git-upload-pack",
    ]);
    let at = repo.path().to_path_buf();
    let fetch = std::thread::spawn(move || api::git_fetch(&at, |_| {}));
    std::thread::sleep(std::time::Duration::from_millis(300));

    repo.write("README.md", "# Changed\n");
    let started = std::time::Instant::now();
    api::git_stage(repo.path(), None, &["README.md".to_string()]).unwrap();

    assert!(started.elapsed() < std::time::Duration::from_secs(2));
    assert_eq!(repo.staged(), ["README.md"]);
    fetch.join().unwrap().unwrap();
}
