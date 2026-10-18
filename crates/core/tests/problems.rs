//! US6: a feature's problems are only what stops the workflow; every other check error is a note.

mod common;

use std::fs;
use std::path::{Path, PathBuf};

use common::repo::TestRepo;
use uraeda_core::api;
use uraeda_core::check;
use uraeda_core::view::{FeatureView, ProblemView};
use uraeda_core::workspace::Severity;

const FOLDER: &str = "2026-10-06-recurring-tasks";
const PLAN: &str = "specs/2026-10-06-recurring-tasks/plan.md";
const SPEC: &str = "specs/2026-10-06-recurring-tasks/spec.md";
const ROUND: &str = "specs/2026-10-06-recurring-tasks/clarifications-01.md";
const FIRST_ANSWER: &str = "**Answer:** B and C: we need to easily handle weekdays vs weekend as \
                            those come up often. B will be\nthe UI path, and C will only happen \
                            when editing the task's title (like todoist).\n";

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

fn replace(repo: &TestRepo, path: &str, from: &str, to: &str) {
    let text = fs::read_to_string(repo.path().join(path)).unwrap();
    assert!(text.contains(from), "{path} has no {from:?}");
    repo.write(path, &text.replacen(from, to, 1));
}

/// Removes the plan's `## Waves` section, up to the next level-2 heading.
fn drop_waves(repo: &TestRepo) {
    let text = fs::read_to_string(repo.path().join(PLAN)).unwrap();
    let start = text.find("## Waves\n").unwrap();
    let end = start + text[start..].find("\n## Task 1").unwrap() + 1;
    repo.write(PLAN, &format!("{}{}", &text[..start], &text[end..]));
}

/// A change to the feature before its commit.
type Edit = fn(&TestRepo);

fn rules(found: &[ProblemView]) -> Vec<&str> {
    found.iter().map(|problem| problem.rule.as_str()).collect()
}

fn read(repo: &TestRepo) -> FeatureView {
    api::read_feature(repo.path(), FOLDER).unwrap()
}

/// US6 1
#[test]
fn a_missing_section_is_a_note_not_a_problem() {
    let repo = feature(drop_waves);

    let view = read(&repo);

    assert!(view.problems.is_empty(), "{:?}", view.problems);
    assert_eq!(rules(&view.notes), ["sections.missing"], "{:?}", view.notes);
    assert_ne!(view.step.name, "none");
}

/// US6 2
#[test]
fn an_invalid_status_is_a_problem() {
    let repo = feature(|repo| replace(repo, SPEC, "status: approved", "status: aproved"));

    let view = read(&repo);

    assert_eq!(
        rules(&view.problems),
        ["frontmatter.status"],
        "{:?}",
        view.problems
    );
    assert_eq!(view.step.name, "none");
}

#[test]
fn a_blank_answer_in_an_answered_round_is_a_problem() {
    let repo = feature(|repo| replace(repo, ROUND, FIRST_ANSWER, "**Answer:**\n"));

    let view = read(&repo);

    assert_eq!(
        rules(&view.problems),
        ["answers.blank"],
        "{:?}",
        view.problems
    );
}

/// US6 more 1: `ura check` still reports a note at its own severity.
#[test]
fn the_check_still_reports_a_note_as_an_error() {
    let repo = feature(drop_waves);
    let folder = repo.path().join("specs").join(FOLDER);

    let found = check::check_files(repo.path(), &folder).unwrap();

    assert!(
        found
            .iter()
            .any(|p| p.rule == "sections.missing" && p.severity == Severity::Error),
        "{found:?}"
    );
}

/// A question whose `**Answer:**` line was deleted, in an answered round, misses its answer too.
#[test]
fn a_deleted_answer_line_in_an_answered_round_is_a_problem() {
    let repo = feature(|repo| replace(repo, ROUND, FIRST_ANSWER, ""));

    let view = read(&repo);

    assert_eq!(
        rules(&view.problems),
        ["answers.blank"],
        "{:?}",
        view.problems
    );
    assert_eq!(rules(&view.notes), ["answers.marker"], "{:?}", view.notes);
}

/// The workspace's own problems set the step to `none`: a feature at `none` always shows a
/// problem, whatever the check's `BLOCKING` lists, or it would vanish from Home and the sidebar.
#[test]
fn a_feature_whose_step_cannot_be_found_always_has_a_problem() {
    let broken: [(&str, Edit); 3] = [
        ("an unparsable frontmatter", |repo| {
            replace(repo, SPEC, "status: approved\n", "status: [approved\n");
        }),
        ("an invalid status", |repo| {
            replace(repo, SPEC, "status: approved", "status: aproved");
        }),
        ("a file not in UTF-8", |repo| {
            fs::write(
                repo.path().join(format!("specs/{FOLDER}/rulings.md")),
                b"\xff\xfe not UTF-8",
            )
            .unwrap();
        }),
    ];
    for (case, edit) in broken {
        let repo = feature(edit);

        let view = read(&repo);

        assert_eq!(view.step.name, "none", "{case}");
        assert!(!view.problems.is_empty(), "{case}: {:?}", view.notes);
    }
    let repo = feature(|repo| {
        fs::remove_dir_all(repo.path().join("specs").join(FOLDER)).unwrap();
        let record = fs::read_to_string(example().join(format!("done/{FOLDER}.md"))).unwrap();
        repo.write(
            &format!("specs/done/{FOLDER}.md"),
            &record.replacen("kind: feature", "kind: chore", 1),
        );
    });

    let view = read(&repo);

    assert_eq!(view.step.name, "none", "a record's unknown kind");
    assert!(!view.problems.is_empty(), "{:?}", view.notes);
}
