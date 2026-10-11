mod common;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal};
use uraeda_core::actions::place;
use uraeda_core::git::Git;
use uraeda_core::steps::{StepName, WaitsOn};
use uraeda_core::workspace::{Source, Workspace};

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
