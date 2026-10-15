mod common;

use std::fs;
use std::path::{Path, PathBuf};

use common::repository_file;
use common::texts::record;
use tempfile::TempDir;
use uraeda_core::check;
use uraeda_core::files::markdown::{Document, slug};
use uraeda_core::workspace::Problem;

/// A copy of the skill's example `specs/` folder, valid as written.
struct Example {
    dir: TempDir,
}

const FEATURE: &str = "specs/2026-10-06-recurring-tasks";
const RECORD: &str = "specs/done/2026-10-06-recurring-tasks.md";

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

/// US2.2: a spec in the old layout, with Data, Components, Error handling, and Testing under
/// `## Design`, says which sections to move.
#[test]
fn a_spec_in_the_old_layout_reports_its_moved_sections() {
    let example = Example::new();
    let spec = format!("{FEATURE}/spec.md");
    let text = example.read(&spec);
    let (text, details) = text.split_once("## Details\n\n").unwrap();
    let old = text
        .replace("## Architecture", "## Design")
        .replace("## Assumptions", &format!("{details}\n## Assumptions"));
    example.write(&spec, &old);

    let problems = summary(&example.problems());

    let line = |needle: &str| old.lines().position(|l| l == needle).unwrap() + 1;
    for expected in [
        format!("{spec}: missing section \"## Details\""),
        format!(
            "{spec}:{}: unknown section \"## Design\"",
            line("## Design")
        ),
        format!(
            "{spec}:{}: \"## Assumptions\" must come before \"### Testing\", as in the template",
            line("## Assumptions")
        ),
    ] {
        assert!(problems.contains(&expected), "{expected}\nin {problems:#?}");
    }
}

/// One row per rule: how to break the example, and the problem expected.
#[test]
#[expect(
    clippy::too_many_lines,
    reason = "over the limit before the code quality decision: split the rows by file checked"
)]
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
            "unknown discovery effort",
            |e| e.edit(&format!("{FEATURE}/proposal.md"), "discovery: high", "discovery: deep"),
            format!("{FEATURE}/proposal.md:2: discovery \"deep\" is not one of low, medium, high"),
        ),
        (
            "unknown proposal field",
            |e| e.edit(&format!("{FEATURE}/proposal.md"), "discovery: high", "effort: high"),
            format!("{FEATURE}/proposal.md:2: unknown field \"effort\""),
        ),
        (
            "plan review not a boolean",
            |e| e.edit(&format!("{FEATURE}/spec.md"), "plan-review: true", "plan-review: often"),
            format!("{spec}:6: plan-review \"often\" is not true or false"),
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
            "record without kind",
            |e| e.edit(RECORD, "kind: feature\n", ""),
            format!("{RECORD}: no \"kind\" field"),
        ),
        (
            "record kind",
            |e| e.edit(RECORD, "kind: feature", "kind: chore"),
            format!("{RECORD}:2: kind \"chore\" is not one of feature, change"),
        ),
        (
            "record finished date",
            |e| e.edit(RECORD, "finished: 2026-10-13", "finished: 2026-13-01"),
            format!("{RECORD}:3: finished \"2026-13-01\" is not a date: YYYY-MM-DD"),
        ),
        (
            "record numbering",
            |e| e.edit(RECORD, "#### Q2: When does", "#### Q3: When does"),
            format!("{RECORD}:{}: Q3 should be Q2", record_line("#### Q2: When does")),
        ),
        (
            "record title",
            |e| e.edit(RECORD, "# Record: ", "# Done: "),
            format!("{RECORD}:{}: the title starts with \"Record: \"", record_line("# Record: ")),
        ),
        (
            "record name",
            |e| e.write("specs/done/web-ui.md", &e.read(RECORD)),
            "specs/done/web-ui.md: \"web-ui.md\" is not a record's name: YYYY-MM-DD-<slug>.md".into(),
        ),
        (
            "record without its note",
            |e| e.edit(RECORD, "> [!NOTE]", "> [!TIP]"),
            format!("{RECORD}: a record opens with a \"> [!NOTE]\" block"),
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

#[test]
fn plan_review_on_any_tier() {
    let example = Example::new();
    example.edit(
        &format!("{FEATURE}/spec.md"),
        "risk-tier: high",
        "risk-tier: low",
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn a_proposal_needs_no_frontmatter() {
    let example = Example::new();
    example.edit(
        &format!("{FEATURE}/proposal.md"),
        "---\ndiscovery: high\n---\n\n",
        "",
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
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

fn record_line(needle: &str) -> usize {
    line_of(RECORD, needle)
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

/// US1.2
#[test]
fn a_record_keeps_the_anchors_of_its_questions() {
    let example = Example::new();
    let record = Document::parse(&example.read(RECORD)).anchors();
    let questions: Vec<String> =
        Document::parse(&example.read(&format!("{FEATURE}/clarifications-01.md")))
            .headings
            .iter()
            .filter(|h| h.level == 2 && h.text.starts_with('Q'))
            .map(|h| slug(&h.text))
            .collect();

    assert_eq!(questions.len(), 7);
    for anchor in questions {
        assert!(record.contains(&anchor), "{anchor}");
    }
}

#[test]
fn a_change_record_needs_no_questions() {
    let example = Example::new();
    example.write(
        "specs/done/2026-10-14-tasks-reappear.md",
        &record("change", "Completed tasks reappear"),
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn a_missing_image_into_specs_is_a_problem() {
    let example = Example::new();
    let proposal = format!("{FEATURE}/proposal.md");
    example.write(&format!("{FEATURE}/images/login.webp"), "RIFF");
    let text = example.read(&proposal);
    let line = text.lines().count() + 4;
    example.write(
        &proposal,
        &format!("{text}\n![Login](images/login.webp)\n\n![Gone](images/gone.webp)\n"),
    );

    assert_eq!(
        summary(&example.problems()),
        [format!("{proposal}:{line}: no file images/gone.webp")]
    );
}

#[test]
fn embeds_web_images_and_images_outside_specs_are_not_checked() {
    let example = Example::new();
    let proposal = format!("{FEATURE}/proposal.md");
    let text = example.read(&proposal);
    example.write(
        &proposal,
        &format!(
            "{text}\n![[gone.png]]\n\n![u](https://e.com/x.png)\n\n![o](/docs/missing.png)\n\n![d](data:image/png;base64,AAAA)\n"
        ),
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn a_percent_encoded_image_is_found() {
    let example = Example::new();
    let proposal = format!("{FEATURE}/proposal.md");
    example.write(&format!("{FEATURE}/images/my shot.webp"), "RIFF");
    let text = example.read(&proposal);
    example.write(
        &proposal,
        &format!("{text}\n![Shot](images/my%20shot.webp)\n"),
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// Review focus 1
#[test]
fn files_of_done_that_are_not_markdown_are_ignored() {
    let example = Example::new();
    example.write("specs/done/.gitkeep", "");
    example.write("specs/done/notes.txt", "notes");

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn a_text_is_checked_in_place_of_its_file() {
    let example = Example::new();
    let spec_path = example.root().join(FEATURE).join("spec.md");
    let on_disk = example.read(&format!("{FEATURE}/spec.md"));
    let edited = on_disk.replace("risk-tier: high", "risk-tier: extreme");

    let problems = check::check_text(example.root(), &spec_path, &edited);

    assert_eq!(
        summary(&problems),
        [format!(
            "{FEATURE}/spec.md:5: risk-tier \"extreme\" is not one of low, medium, high"
        )]
    );
    assert_eq!(problems[0].line, Some(5));
    assert_eq!(example.read(&format!("{FEATURE}/spec.md")), on_disk);
}

#[test]
fn a_checked_text_sees_the_rest_of_its_folder_on_disk() {
    let example = Example::new();
    let spec_path = example.root().join(FEATURE).join("spec.md");
    let edited = example
        .read(&format!("{FEATURE}/spec.md"))
        .replace("clarifications: 1", "clarifications: 2");

    let problems = check::check_text(example.root(), &spec_path, &edited);

    assert_eq!(
        summary(&problems),
        [format!(
            "{FEATURE}/spec.md:4: clarifications is 2, but the last round is 01"
        )]
    );
}

#[test]
fn an_unchanged_text_has_the_problems_of_its_file() {
    let example = Example::new();
    let spec_path = example.root().join(FEATURE).join("spec.md");
    example.edit(
        &format!("{FEATURE}/spec.md"),
        "risk-tier: high",
        "risk-tier: x",
    );
    let text = example.read(&format!("{FEATURE}/spec.md"));

    assert_eq!(
        check::check_text(example.root(), &spec_path, &text),
        check::check(example.root(), &spec_path).unwrap()
    );
}

/// Review focus 5: a CRLF text's problems are on the lines a CRLF editor shows.
#[test]
fn a_crlf_text_reports_the_same_lines() {
    let example = Example::new();
    let spec_path = example.root().join(FEATURE).join("spec.md");
    let edited = example
        .read(&format!("{FEATURE}/spec.md"))
        .replace("risk-tier: high", "risk-tier: extreme")
        .replace('\n', "\r\n");

    let problems = check::check_text(example.root(), &spec_path, &edited);

    assert_eq!(
        summary(&problems),
        [format!(
            "{FEATURE}/spec.md:5: risk-tier \"extreme\" is not one of low, medium, high"
        )]
    );
}

const CHANGE: &str = "specs/changes/2026-10-14-tasks-reappear";

/// A change's folder holds its proposal, rounds, rulings, images, and screenshots, and nothing of a
/// feature's or of the old bug flow.
#[test]
fn a_changes_folder_holds_only_its_files() {
    for (path, allowed) in [
        ("proposal.md", true),
        ("clarifications-01.md", true),
        ("rulings.md", true),
        ("images/a.webp", true),
        ("screenshots/page.webp", true),
        ("spec.md", false),
        ("plan.md", false),
        ("discovery-01.md", false),
        ("report.md", false),
        ("assessment.md", false),
        ("notes/a.md", false),
    ] {
        let example = Example::new();
        if path != "proposal.md" {
            example.write(&format!("{CHANGE}/{path}"), "x\n");
        }

        let flagged: Vec<String> = example
            .problems()
            .into_iter()
            .filter(|p| p.rule == "names.change-file")
            .map(|p| format!("{}: {}", p.file, p.message))
            .collect();

        let name = path.split('/').next().unwrap();
        let expected = if allowed {
            vec![]
        } else {
            vec![format!(
                "{CHANGE}/{name}: \"{name}\" has no place in a change: its folder holds proposal.md, clarifications-NN.md, rulings.md, images/, and screenshots/."
            )]
        };
        assert_eq!(flagged, expected, "{path}");
    }
}

/// Edge case: a project with a `specs/bugs/` folder from an older `ura init`.
#[test]
fn an_old_bugs_folder_says_how_to_move_it() {
    let example = Example::new();
    example.write("specs/bugs/.gitkeep", "");

    assert_eq!(
        summary(&example.problems()),
        vec![
            "specs/bugs: specs/bugs/ is no longer used: bugs are changes. Move its folders to specs/changes/, and delete it if empty."
        ]
    );
}
