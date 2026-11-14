//! US6: a feature's problems are only what stops the workflow; every other check error is a note.

mod common;

use std::fs;
use std::path::{Path, PathBuf};

use common::repo::TestRepo;
use uraeda_core::check;
use uraeda_core::workspace::Severity;

const FOLDER: &str = "2026-10-06-recurring-tasks";
const PLAN: &str = "specs/2026-10-06-recurring-tasks/plan.md";

fn example() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../skills/uraeda/assets/example/specs")
}

fn copy(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}

/// The skill's example on `main`, without its feature and its record, and the feature, valid, on
/// its branch, checked out, with `edit` applied to it before its commit.
fn feature(edit: impl FnOnce(&TestRepo)) -> TestRepo {
    let repo = TestRepo::new();
    copy(&example(), &repo.path().join("specs"));
    let folder = repo.path().join("specs").join(FOLDER);
    let held = repo.parent().join("feature");
    fs::rename(&folder, &held).unwrap();
    fs::remove_file(repo.path().join(format!("specs/done/{FOLDER}.md"))).unwrap();
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    fs::rename(&held, &folder).unwrap();
    edit(&repo);
    repo.commit(&format!("plan({FOLDER}): the plan"));
    repo
}

/// Removes the plan's `## Waves` section, up to the next level-2 heading.
fn drop_waves(repo: &TestRepo) {
    let text = fs::read_to_string(repo.path().join(PLAN)).unwrap();
    let start = text.find("## Waves\n").unwrap();
    let end = start + text[start..].find("\n## Task 1").unwrap() + 1;
    repo.write(PLAN, &format!("{}{}", &text[..start], &text[end..]));
}

/// US6 more 1: `ura check` still reports a note at its own severity.
#[test]
fn the_check_still_reports_a_note_as_an_error() {
    let repo = feature(drop_waves);
    let folder = repo.path().join("specs").join(FOLDER);

    let found = check::check(repo.path(), &folder).unwrap();

    assert!(
        found
            .iter()
            .any(|p| p.rule == "sections.missing" && p.severity == Severity::Error),
        "{found:?}"
    );
}
