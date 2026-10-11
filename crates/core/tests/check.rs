mod common;

use std::fs;
use std::path::{Path, PathBuf};

use common::repository_file;
use tempfile::TempDir;
use uraeda_core::check;
use uraeda_core::workspace::Problem;

/// A copy of the skill's example `specs/` folder, valid as written.
struct Example {
    dir: TempDir,
}

const FEATURE: &str = "specs/2026-10-06-recurring-tasks";

impl Example {
    fn new() -> Example {
        let dir = TempDir::new().unwrap();
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../skills/uraeda/assets/example/specs");
        copy(&source, &dir.path().join("specs"));
        Example { dir }
    }

    fn root(&self) -> &Path {
        self.dir.path()
    }

    fn read(&self, path: &str) -> String {
        fs::read_to_string(self.root().join(path)).unwrap()
    }

    fn write(&self, path: &str, text: &str) {
        let file = self.root().join(path);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, text).unwrap();
    }

    fn edit(&self, path: &str, from: &str, to: &str) {
        let text = self.read(path);
        assert!(text.contains(from), "{path} has no {from:?}");
        self.write(path, &text.replacen(from, to, 1));
    }

    fn problems(&self) -> Vec<Problem> {
        check::check(self.root(), &self.root().join("specs")).unwrap()
    }
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

fn summary(problems: &[Problem]) -> Vec<String> {
    problems
        .iter()
        .map(|p| match p.line {
            Some(line) => format!("{}:{line}: {}", p.file, p.message),
            None => format!("{}: {}", p.file, p.message),
        })
        .collect()
}

#[test]
fn the_example_has_no_problems() {
    let example = Example::new();

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn this_repository_has_no_problems() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");

    let problems = check::check(&root, &root.join("specs")).unwrap();

    assert_eq!(summary(&problems), Vec::<String>::new());
}

/// One row per rule: how to break the example, and the problem expected.
#[test]
fn each_rule() {
    let clarifications = format!("{FEATURE}/clarifications-01.md");
    let spec = format!("{FEATURE}/spec.md");
    type Break = fn(&Example);
    let rows: Vec<(&str, Break, String)> = vec![
        (
            "unknown status",
            |e| e.edit(&format!("{FEATURE}/clarifications-01.md"), "status: answered", "status: done"),
            format!("{clarifications}:2: status \"done\" is not one of awaiting-human, answered"),
        ),
        (
            "blank answer",
            |e| {
                e.edit(
                    &format!("{FEATURE}/clarifications-01.md"),
                    "**Answer:** A, but if that date is already past, use the next one in the future.",
                    "**Answer:**",
                )
            },
            format!("{clarifications}:{}: Q3 has no answer", answer_line(3)),
        ),
        (
            "missing section",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "## Constitution check", "Constitution check"),
            format!("{spec}: missing section \"## Constitution check\""),
        ),
        (
            "missing heading",
            |e| {
                e.edit(
                    &format!("{FEATURE}/clarifications-01.md"),
                    "(discovery-01.md#next-due-date)",
                    "(discovery-01.md#git-backend)",
                )
            },
            format!("{clarifications}:{}: no heading \"git-backend\" in discovery-01.md", link_line("(discovery-01.md#next-due-date)")),
        ),
        (
            "missing file",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "(proposal.md)", "(missing.md)"),
            format!("{spec}:{}: no file missing.md", spec_line("(proposal.md)")),
        ),
        (
            "impossible date",
            |e| e.write("specs/2026-13-99-x/proposal.md", "# X\n"),
            "specs/2026-13-99-x: \"2026-13-99-x\" is not a feature folder: YYYY-MM-DD-<slug>, with a real date".into(),
        ),
        (
            "round with one digit",
            |e| {
                let text = e.read(&format!("{FEATURE}/discovery-01.md"));
                e.write(&format!("{FEATURE}/discovery-1.md"), &text);
            },
            format!("{FEATURE}/discovery-1.md: rounds have two digits: discovery-01.md"),
        ),
        (
            "waiting without a block",
            |e| {
                e.edit(&format!("{FEATURE}/spec.md"), "status: approved", "status: awaiting-human");
            },
            format!("{spec}: a file waiting for the human opens with a \"> [!IMPORTANT]\" block"),
        ),
        (
            "unknown field",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "risk-tier: high", "risk-tier: high\nowner: me"),
            format!("{spec}:6: unknown field \"owner\""),
        ),
        (
            "plan review without medium",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "risk-tier: high", "risk-tier: high\nplan-review: true"),
            format!("{spec}:6: plan-review is only for risk-tier: medium"),
        ),
        (
            "spec ahead of its rounds",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "clarifications: 1", "clarifications: 3"),
            format!("{spec}:4: clarifications is 3, but the last round is 01"),
        ),
        (
            "sections out of order",
            |e| {
                let text = e.read(&format!("{FEATURE}/spec.md"));
                let text = text.replace("## Edge cases", "## Swap").replace("## Success criteria", "## Edge cases").replace("## Swap", "## Success criteria");
                e.write(&format!("{FEATURE}/spec.md"), &text);
            },
            format!("{spec}:{}: \"## Edge cases\" must come before \"## Success criteria\", as in the template", spec_line("## Success criteria")),
        ),
        (
            "numbered heading without its colon",
            |e| e.edit(&format!("{FEATURE}/clarifications-01.md"), "## Q4: How", "## Q4 How"),
            format!("{clarifications}:{}: unknown section \"## Q4 How should the app store due dates?\"", link_line("## Q4: How")),
        ),
        (
            "unknown section",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "## Assumptions", "## Notes\n\nA note.\n\n## Assumptions"),
            format!("{spec}:{}: unknown section \"## Notes\"", spec_line("## Assumptions")),
        ),
        (
            "review without a comment",
            |e| e.write(&format!("{FEATURE}/spec-review.md"), "---\nverdict: changes-requested\ncommit: a1b2c3d\n---\n\n# Review: Spec, Recurring tasks\n"),
            format!("{FEATURE}/spec-review.md: a request for changes needs at least one comment"),
        ),
        (
            "line comment without its quote",
            |e| e.write(&format!("{FEATURE}/spec-review.md"), "---\nverdict: pending\ncommit: a1b2c3d\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line 3, under \"US1: Make a task repeat (P1)\"\n\nName it.\n"),
            format!("{FEATURE}/spec-review.md:8: C1 quotes no line"),
        ),
        (
            "priorities without a section",
            |e| e.edit("specs/PRIORITIES.md", "## Blocked", "## Elsewhere"),
            "specs/PRIORITIES.md: missing section \"## Blocked\"".into(),
        ),
    ];
    for (name, break_it, expected) in rows {
        let example = Example::new();
        break_it(&example);

        let problems = summary(&example.problems());

        assert!(
            problems.contains(&expected),
            "{name}: {expected}\nin {problems:#?}"
        );
    }
}

fn line_of(file: &str, needle: &str) -> usize {
    let text = repository_file(&format!("skills/uraeda/assets/example/{file}"));
    text.lines().position(|line| line.contains(needle)).unwrap() + 1
}

fn answer_line(question: usize) -> usize {
    let text = repository_file(&format!(
        "skills/uraeda/assets/example/{FEATURE}/clarifications-01.md"
    ));
    let heading = text
        .lines()
        .position(|line| line.starts_with(&format!("## Q{question}:")))
        .unwrap();
    heading
        + text
            .lines()
            .skip(heading)
            .position(|line| line.starts_with("**Answer:**"))
            .unwrap()
        + 1
}

fn link_line(needle: &str) -> usize {
    line_of(&format!("{FEATURE}/clarifications-01.md"), needle)
}

fn spec_line(needle: &str) -> usize {
    line_of(&format!("{FEATURE}/spec.md"), needle)
}

#[test]
fn unclear_follow_up() {
    let example = Example::new();
    example.edit(
        &format!("{FEATURE}/clarifications-01.md"),
        "**Answer:** C, we want a simple feature.",
        "**Answer:** We'll see.",
    );

    let problems = summary(&example.problems());

    assert!(
        problems
            .iter()
            .any(|p| p.ends_with("Q2.B has no answer (may not apply: answer \"-\" if so)")),
        "{problems:#?}"
    );
}

#[test]
fn a_file_outside_specs() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let rows = [
        ("clarifications-01.md", "no frontmatter"),
        (
            "clarifications-02.md",
            "frontmatter is not valid YAML: line 1 column 9: unclosed bracket '['",
        ),
        ("clarifications-03.md", "no \"status\" field"),
        (
            "clarifications-04.md",
            "status 3 is not one of awaiting-human, answered",
        ),
        (
            "clarifications-05.md",
            "status \"approved\" is not one of awaiting-human, answered",
        ),
        (
            "clarifications-06.md",
            "status \"Approved\" is not one of awaiting-human, answered",
        ),
        ("clarifications-07.md", "not UTF-8"),
        ("spec.md", "missing section \"## User stories\""),
    ];
    for (file, expected) in rows {
        let problems = check::check(&root, &root.join("fixtures/broken").join(file)).unwrap();

        assert!(
            problems.iter().any(|p| p.message == expected),
            "{file}: {expected}\nin {:#?}",
            summary(&problems)
        );
    }
}
