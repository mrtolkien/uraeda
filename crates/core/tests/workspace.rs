mod common;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, record};
use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::steps::{StepName, WaitsOn};
use uraeda_core::workspace::{Feature, Kind, Source, Workspace};

const FOLDER: &str = "2026-10-11-web-ui";

fn repo() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n\n## Next\n\n- [Note](drafts/note.md)\n- Git listener process\n",
    );
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write("specs/2026-10-11-web-ui/proposal.md", &proposal());
    repo.write(
        "specs/2026-10-11-web-ui/clarifications-01.md",
        &clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
    );
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");
    repo
}

fn workspace(repo: &TestRepo) -> Workspace {
    Workspace::read(&Git::discover(repo.path()).unwrap()).unwrap()
}

#[test]
fn a_feature_checked_out_in_a_worktree_is_read_from_its_disk() {
    let repo = repo();
    let place = place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();
    let round = place
        .root
        .join("specs/2026-10-11-web-ui/clarifications-01.md");
    let text = std::fs::read_to_string(&round)
        .unwrap()
        .replace("**Answer:**\n", "**Answer:** A\n");
    std::fs::write(&round, text).unwrap();

    let workspace = workspace(&repo);

    let feature = workspace.feature(FOLDER).unwrap();
    assert_eq!(
        feature.worktree.as_deref(),
        Some(".worktrees/2026-10-11-web-ui")
    );
    assert_eq!(feature.source, Source::WorkingTree);
    assert!(feature.uncommitted);
    assert!(
        feature
            .text("clarifications-01.md")
            .unwrap()
            .contains("**Answer:** A\n")
    );
}

#[test]
fn the_current_branchs_feature_is_in_this_checkout() {
    let repo = repo();
    repo.switch(FOLDER);

    let workspace = workspace(&repo);

    assert_eq!(
        workspace.feature(FOLDER).unwrap().worktree.as_deref(),
        Some(".")
    );
}

#[test]
fn priority_entries_name_their_draft() {
    let repo = repo();

    let workspace = workspace(&repo);

    let drafts: Vec<Option<&str>> = workspace
        .priorities
        .iter()
        .map(|entry| entry.draft.as_deref())
        .collect();
    assert_eq!(drafts, [None, Some("specs/drafts/note.md"), None]);
}

/// The edge case of the spec: a merged feature whose branch still exists is done, once.
#[test]
fn a_merged_feature_with_its_branch_is_done() {
    let repo = repo();
    repo.git(&["merge", "--quiet", "--no-edit", FOLDER]);

    let workspace = workspace(&repo);

    let matching: Vec<_> = workspace
        .features
        .iter()
        .filter(|f| f.folder == FOLDER)
        .collect();
    assert_eq!(matching.len(), 1);
    assert_eq!(matching[0].step.name, StepName::Done);
    assert_eq!(matching[0].step.waits_on, WaitsOn::Nobody);
    assert_eq!(matching[0].source, Source::DefaultBranch);
    assert_eq!(matching[0].branch, None);
}

/// A line jotted down from a feature branch's checkout shows before it is committed.
#[test]
fn priorities_are_read_from_the_default_branchs_worktree() {
    let repo = repo();
    repo.switch(FOLDER);
    let place = place::reach(&Git::discover(repo.path()).unwrap(), "main").unwrap();
    let path = place.root.join("specs/PRIORITIES.md");
    let text = std::fs::read_to_string(&path).unwrap();
    std::fs::write(&path, format!("{text}- An idea\n")).unwrap();

    let workspace = workspace(&repo);

    assert_eq!(workspace.priorities.last().unwrap().text, "An idea");
}

const BUG: &str = "2026-10-14-completed-tasks-reappear";
const BUG_BRANCH: &str = "fix/2026-10-14-completed-tasks-reappear";

/// On `branch`, replaces the folder `dir` with the record of `folder`, and commits.
fn finish(repo: &TestRepo, branch: &str, dir: &str, folder: &str, kind: &str) {
    repo.switch(branch);
    repo.git(&["rm", "-r", "--quiet", dir]);
    repo.write(&format!("specs/done/{folder}.md"), &record(kind, "Web UI"));
    repo.commit(&format!("finish: {folder}"));
    repo.switch("main");
}

fn merge(repo: &TestRepo, branch: &str) {
    repo.git(&["merge", "--quiet", "--no-ff", "--no-edit", branch]);
}

fn finished_and_merged() -> TestRepo {
    let repo = repo();
    finish(&repo, FOLDER, "specs/2026-10-11-web-ui", FOLDER, "feature");
    merge(&repo, FOLDER);
    repo
}

fn feature(repo: &TestRepo, folder: &str) -> Feature {
    workspace(repo).feature(folder).cloned().unwrap()
}

/// US2.1
#[test]
fn a_record_on_the_default_branch_is_a_merged_feature() {
    let repo = finished_and_merged();
    repo.delete_branch(FOLDER);

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.step.name, StepName::Done);
    assert!(feature.is_finished());
    let names: Vec<&str> = feature.files.iter().map(|f| f.name.as_str()).collect();
    assert_eq!(names, ["2026-10-11-web-ui.md"]);
    assert_eq!(feature.source, Source::DefaultBranch);
    assert_eq!((feature.left_branch, feature.left_worktree), (None, None));
}

/// US2.2
#[test]
fn a_merged_feature_names_its_branch_and_worktree_left() {
    let repo = finished_and_merged();
    place::reach(&Git::discover(repo.path()).unwrap(), FOLDER).unwrap();

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.left_branch.as_deref(), Some(FOLDER));
    assert_eq!(
        feature.left_worktree.as_deref(),
        Some(".worktrees/2026-10-11-web-ui")
    );
}

/// US2.4
#[test]
fn a_record_only_on_origin_is_merged() {
    let repo = repo();
    finish(&repo, FOLDER, "specs/2026-10-11-web-ui", FOLDER, "feature");
    repo.push("main");
    repo.push(FOLDER);
    let clone = repo.parent().join("clone");
    let origin = repo.parent().join("origin.git");
    let git = |args: &[&str]| {
        let status = std::process::Command::new("git")
            .args(args)
            .current_dir(&clone)
            .status()
            .unwrap();
        assert!(status.success(), "git {args:?}");
    };
    std::process::Command::new("git")
        .args([
            "clone",
            "--branch",
            "main",
            "--quiet",
            origin.to_str().unwrap(),
            clone.to_str().unwrap(),
        ])
        .status()
        .unwrap();
    git(&[
        "-c",
        "user.name=T",
        "-c",
        "user.email=t@example.com",
        "merge",
        "--quiet",
        "--no-ff",
        "--no-edit",
        "origin/2026-10-11-web-ui",
    ]);
    git(&["push", "--quiet", "origin", "main"]);
    repo.git(&["fetch", "--quiet", "origin"]);

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.step.name, StepName::Done);
    assert_eq!(feature.left_branch.as_deref(), Some(FOLDER));
}

/// US2.5
#[test]
fn a_merged_folder_is_still_done() {
    let repo = repo();
    merge(&repo, FOLDER);

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.step.name, StepName::Done);
    assert!(!feature.is_finished());
}

/// Edge case: both a folder and a record on the default branch.
#[test]
fn the_record_wins_over_the_folder() {
    let repo = repo();
    merge(&repo, FOLDER);
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        &record("feature", "Web UI"),
    );
    repo.commit("finish: web UI");

    let workspace = workspace(&repo);

    let matching: Vec<&Feature> = workspace
        .features
        .iter()
        .filter(|f| f.folder == FOLDER)
        .collect();
    assert_eq!(matching.len(), 1);
    assert!(matching[0].is_finished());
}

/// Review focus 1
#[test]
fn files_of_done_that_are_not_markdown_are_not_features() {
    let repo = repo();
    repo.write("specs/done/.gitkeep", "");
    repo.write("specs/done/notes.txt", "notes");
    repo.commit("chore: done");

    assert_eq!(workspace(&repo).features.len(), 1);
}

/// Review focus 2
#[test]
fn new_commits_after_the_merge_leave_the_feature_done() {
    let repo = finished_and_merged();
    repo.switch(FOLDER);
    repo.git(&["revert", "--no-edit", "HEAD"]);
    repo.switch("main");

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.step.name, StepName::Done);
    assert!(feature.is_finished());
    assert_eq!(feature.left_branch.as_deref(), Some(FOLDER));
}

/// Review focus 3
#[test]
fn a_merged_bugs_worktree_is_one_folder_deeper() {
    let repo = repo();
    repo.switch_new(BUG_BRANCH);
    repo.write(
        &format!("specs/bugs/{BUG}/report.md"),
        "# Completed tasks reappear\n",
    );
    repo.commit("chore: report");
    repo.switch("main");
    finish(&repo, BUG_BRANCH, &format!("specs/bugs/{BUG}"), BUG, "bug");
    merge(&repo, BUG_BRANCH);
    place::reach(&Git::discover(repo.path()).unwrap(), BUG_BRANCH).unwrap();

    let bug = feature(&repo, BUG);

    assert_eq!(bug.kind, Kind::Bug);
    assert_eq!(bug.left_branch.as_deref(), Some(BUG_BRANCH));
    assert_eq!(
        bug.left_worktree.as_deref(),
        Some(".worktrees/fix/2026-10-14-completed-tasks-reappear")
    );
}

#[test]
fn a_finished_branch_is_read_from_its_record() {
    let repo = repo();
    finish(&repo, FOLDER, "specs/2026-10-11-web-ui", FOLDER, "feature");

    let feature = feature(&repo, FOLDER);

    assert!(feature.is_finished());
    assert_eq!(feature.branch.as_deref(), Some(FOLDER));
    assert_eq!(
        feature.owns("specs/done/2026-10-11-web-ui.md"),
        Some("2026-10-11-web-ui.md")
    );
    assert_eq!(feature.owns("specs/done/2026-10-10-cli-core.md"), None);
}

#[test]
fn a_finished_checkout_is_read_from_its_record() {
    let repo = repo();
    finish(&repo, FOLDER, "specs/2026-10-11-web-ui", FOLDER, "feature");
    repo.switch(FOLDER);

    let feature = feature(&repo, FOLDER);

    assert!(feature.is_finished());
    assert_eq!(feature.worktree.as_deref(), Some("."));
}

/// Final review: a record whose frontmatter is broken shows as a problem.
#[test]
fn a_broken_record_is_a_problem() {
    let repo = repo();
    repo.switch(FOLDER);
    repo.git(&["rm", "-r", "--quiet", "specs/2026-10-11-web-ui"]);
    repo.write(
        "specs/done/2026-10-11-web-ui.md",
        &record("feature", "Web UI").replace("kind: feature", "kind: [feature"),
    );
    repo.commit("finish: web UI");
    repo.switch("main");
    merge(&repo, FOLDER);

    let feature = feature(&repo, FOLDER);

    assert_eq!(feature.problems[0].rule, "frontmatter.parse");
    assert_eq!(feature.problems[0].file, "specs/done/2026-10-11-web-ui.md");
}
