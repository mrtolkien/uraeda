//! `ura check`'s rules, and the problems decision: a feature's problem is only what stops the
//! workflow, every other result is a note, and the check keeps every result at its own severity.

use uraeda_core::api;
use uraeda_core::check;
use uraeda_core::view::ProblemView;
use uraeda_core::workspace::{Problem, Severity};

use crate::common::repo::TestRepo;
use crate::support::{Example, FEATURE, FOLDER, feature_repo, replace};

const SPEC: &str = "specs/2026-10-06-recurring-tasks/spec.md";
const PLAN: &str = "specs/2026-10-06-recurring-tasks/plan.md";
const ROUND: &str = "specs/2026-10-06-recurring-tasks/clarifications-01.md";
const PROPOSAL: &str = "specs/2026-10-06-recurring-tasks/proposal.md";
const FIRST_ANSWER: &str = "**Answer:** B and C: we need to easily handle weekdays vs weekend as \
                            those come up often. B will be\nthe UI path, and C will only happen \
                            when editing the task's title (like todoist).\n";

fn rules(problems: &[Problem]) -> Vec<&str> {
    problems
        .iter()
        .map(|problem| problem.rule.as_str())
        .collect()
}

fn view_rules(views: &[ProblemView]) -> Vec<&str> {
    views.iter().map(|problem| problem.rule.as_str()).collect()
}

/// Removes the plan's `## Waves` section, up to its first task.
fn drop_waves(repo: &TestRepo) {
    let text = repo.read(PLAN);
    let start = text.find("## Waves\n").unwrap();
    let end = start + text[start..].find("\n## Task 1").unwrap() + 1;
    repo.write(PLAN, &format!("{}{}", &text[..start], &text[end..]));
}

fn read(repo: &TestRepo) -> uraeda_core::view::FeatureView {
    api::read_feature(repo.path(), FOLDER).unwrap()
}

#[test]
fn the_skills_example_passes_its_own_rules() {
    let example = Example::new();

    let problems = check::check(example.root(), &example.root().join("specs")).unwrap();

    assert_eq!(rules(&problems), Vec::<&str>::new(), "{problems:?}");
}

#[test]
fn each_slip_is_reported_by_its_rule() {
    type Slip = fn(&Example);
    let rows: [(&str, Slip, &str); 13] = [
        (
            "an invalid status",
            |e| e.edit(SPEC, "status: approved", "status: aproved"),
            "frontmatter.status",
        ),
        (
            "an unparsable frontmatter",
            |e| e.edit(SPEC, "status: approved\n", "status: [approved\n"),
            "frontmatter.parse",
        ),
        (
            "an unknown section",
            |e| e.edit(SPEC, "## Risk tier", "## Details\n\nOld.\n\n## Risk tier"),
            "sections.unknown",
        ),
        (
            "a section out of order",
            |e| {
                let text = e.read(SPEC);
                let start = text.find("## Decisions\n").unwrap();
                let end = text[start + 5..]
                    .find("\n## ")
                    .map_or(text.len(), |at| start + 5 + at + 1);
                let section = text[start..end].to_string();
                let rest = format!("{}{}", &text[..start], &text[end..]);
                let at = rest.find("## Architecture\n").unwrap();
                e.write(SPEC, &format!("{}{section}{}", &rest[..at], &rest[at..]));
            },
            "sections.order",
        ),
        (
            "a link to a missing file",
            |e| e.edit(PROPOSAL, "\n", "\n\nSee [it](nothing.md).\n\n"),
            "links.file",
        ),
        (
            "an image that is not there",
            |e| {
                let text = e.read(PROPOSAL);
                e.write(PROPOSAL, &format!("{text}\n![Gone](images/gone.webp)\n"));
            },
            "links.file",
        ),
        (
            "a decision with an unknown status",
            |e| {
                e.edit(
                    "specs/decisions/task-storage.md",
                    "status: active",
                    "status: maybe",
                )
            },
            "frontmatter.status",
        ),
        (
            "a record finished on no date",
            |e| {
                e.edit(
                    "specs/done/2026-10-06-recurring-tasks.md",
                    "finished: 2026-10-13",
                    "finished: soon",
                )
            },
            "frontmatter.finished",
        ),
        (
            "a plan of no revision",
            |e| e.edit(PLAN, "spec-revision: 2", "spec-revision: two"),
            "frontmatter.spec-revision",
        ),
        (
            "the priorities without a section",
            |e| e.edit("specs/PRIORITIES.md", "## Blocked", "## Parked"),
            "sections.missing",
        ),
        (
            "a blank answer",
            |e| e.edit(ROUND, FIRST_ANSWER, "**Answer:**\n"),
            "answers.blank",
        ),
        (
            "a deleted answer line",
            |e| e.edit(ROUND, FIRST_ANSWER, ""),
            "answers.marker",
        ),
        (
            "a missing section",
            |e| e.edit(PLAN, "## Waves\n", "## Wave\n"),
            "sections.unknown",
        ),
    ];
    for (name, slip, rule) in rows {
        let example = Example::new();
        slip(&example);

        let problems = check::check(example.root(), &example.root().join("specs")).unwrap();

        assert!(rules(&problems).contains(&rule), "{name}: {problems:?}");
    }
}

#[test]
fn the_broken_fixtures_are_reported_by_the_rule_each_breaks() {
    let rows = [
        ("clarifications-01.md", "frontmatter.parse"),
        ("clarifications-03.md", "frontmatter.missing"),
        ("clarifications-05.md", "frontmatter.status"),
        ("spec.md", "frontmatter.missing"),
    ];
    for (name, rule) in rows {
        let file = crate::common::repository_path("fixtures/broken").join(name);

        let problems = check::check(&crate::common::repository_path("."), &file).unwrap();

        let found = rules(&problems);
        assert!(found.contains(&rule), "{name}: {found:?}");
        assert!(
            found.contains(&"sections.missing") && found.contains(&"sections.title"),
            "{name}: {found:?}"
        );
    }
}

#[test]
fn a_missing_section_is_a_note_not_a_problem() {
    let repo = feature_repo(drop_waves);

    let view = read(&repo);

    assert!(view.problems.is_empty(), "{:?}", view.problems);
    assert_eq!(view_rules(&view.notes), ["sections.missing"]);
    assert_ne!(view.step.name, "none", "the workflow goes on");
}

#[test]
fn what_stops_the_workflow_is_a_problem_and_loses_the_step() {
    type Slip = (&'static str, fn(&TestRepo), &'static str);
    let slips: [Slip; 3] = [
        (
            "an invalid status",
            |r| replace(r, SPEC, "status: approved", "status: aproved"),
            "frontmatter.status",
        ),
        (
            "an unparsable frontmatter",
            |r| replace(r, SPEC, "status: approved\n", "status: [approved\n"),
            "frontmatter.parse",
        ),
        (
            "a blank answer in an answered round",
            |r| replace(r, ROUND, FIRST_ANSWER, "**Answer:**\n"),
            "answers.blank",
        ),
    ];
    for (name, slip, rule) in slips {
        let repo = feature_repo(slip);

        let view = read(&repo);

        assert!(
            view_rules(&view.problems).contains(&rule),
            "{name}: {:?}",
            view.problems
        );
    }
    let repo = feature_repo(|r| {
        std::fs::write(
            r.path().join(format!("{FEATURE}/rulings.md")),
            b"\xff\xfe not UTF-8",
        )
        .unwrap();
    });
    let view = read(&repo);
    assert_eq!(view.step.name, "none", "a file that is not UTF-8");
    assert!(!view.problems.is_empty());
}

#[test]
fn the_check_keeps_a_note_at_its_own_severity() {
    let repo = feature_repo(drop_waves);

    let found = check::check_files(repo.path(), &repo.path().join(FEATURE)).unwrap();

    let missing = found.iter().find(|p| p.rule == "sections.missing").unwrap();
    assert_eq!(
        missing.severity,
        Severity::Error,
        "the note is the UI's reading of an error"
    );
    assert!(!missing.blocks());
}

#[test]
fn a_record_that_links_an_image_of_its_deleted_folder_is_a_problem() {
    let example = Example::new();
    let record = "specs/done/2026-10-06-recurring-tasks.md";
    let text = example.read(record);
    example.write(
        record,
        &format!("{text}\n![Screen](../2026-10-06-recurring-tasks/images/screen.webp)\n"),
    );

    let problems = check::check(example.root(), &example.root().join("specs")).unwrap();

    assert!(rules(&problems).contains(&"links.file"), "{problems:?}");
}
