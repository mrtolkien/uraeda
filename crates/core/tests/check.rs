mod common;

use std::fs;
use std::path::{Path, PathBuf};

use common::repository_file;
use common::texts::record;
use tempfile::TempDir;
use uraeda_core::check;
use uraeda_core::files::markdown::{Document, slug};
use uraeda_core::workspace::{Problem, Severity};

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

    /// Moves the level-2 section headed `heading`, up to the next level-2 heading, to just before
    /// the heading `before`.
    fn move_section(&self, path: &str, heading: &str, before: &str) {
        let text = self.read(path);
        let start = text.find(&format!("{heading}\n")).unwrap();
        let end = text[start + heading.len()..]
            .find("\n## ")
            .map_or(text.len(), |at| start + heading.len() + at + 1);
        let section = &text[start..end];
        let rest = format!("{}{}", &text[..start], &text[end..]);
        let at = rest.find(&format!("{before}\n")).unwrap();
        self.write(path, &format!("{}{section}{}", &rest[..at], &rest[at..]));
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

/// The problems as `ura check` prints them, a warning's prefixed `warning: `.
fn summary(problems: &[Problem]) -> Vec<String> {
    problems
        .iter()
        .map(|p| {
            let prefix = match p.severity {
                Severity::Error => "",
                Severity::Warning => "warning: ",
            };
            match p.line {
                Some(line) => format!("{prefix}{}:{line}: {}", p.file, p.message),
                None => format!("{prefix}{}: {}", p.file, p.message),
            }
        })
        .collect()
}

#[test]
fn the_example_has_no_problems() {
    let example = Example::new();

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// US1 1: a spec whose `## Decisions` comes after its stories, as the old format had it, reports
/// the order.
#[test]
fn decisions_after_the_stories_are_out_of_order() {
    let example = Example::new();
    let spec = format!("{FEATURE}/spec.md");
    example.move_section(&spec, "## Decisions", "## Architecture");

    let problems = summary(&example.problems());

    let line = example
        .read(&spec)
        .lines()
        .position(|l| l == "## Decisions")
        .unwrap()
        + 1;
    let expected = format!(
        "{spec}:{line}: \"## Decisions\" must come before \"## User stories\", as in the template"
    );
    assert!(problems.contains(&expected), "{expected}\nin {problems:#?}");
}

/// US1 more 1: the old format's `## Details` and `## Mockups` are unknown sections.
#[test]
fn a_spec_with_details_or_mockups_has_an_unknown_section() {
    for section in ["Details", "Mockups"] {
        let example = Example::new();
        let spec = format!("{FEATURE}/spec.md");
        example.edit(
            &spec,
            "## Risk tier",
            &format!("## {section}\n\nThe old format.\n\n## Risk tier"),
        );

        let problems = example.problems();

        let unknown = problems
            .iter()
            .find(|p| p.rule == "sections.unknown")
            .map(|p| p.message.as_str());
        assert_eq!(
            unknown,
            Some(format!("unknown section \"## {section}\"").as_str())
        );
    }
}

/// A `####` heading in a round's Context or settled section is dropped from its page, so it is an
/// unknown section; one in a quote is the quote's.
#[test]
fn a_deeper_heading_in_a_round_is_an_unknown_section() {
    let rows = [
        ("Goal", "#### Detail\n\nA detail.\n\n", true),
        ("Goal", "> #### Quoted\n\n", false),
        ("Behaviour", "#### Detail\n\nA detail.\n\n", true),
    ];
    for (after, heading, reported) in rows {
        let example = Example::new();
        example.edit(
            ROUND,
            &format!("### {after}\n\n"),
            &format!("### {after}\n\n{heading}"),
        );

        let unknown: Vec<String> = example
            .problems()
            .into_iter()
            .filter(|p| p.rule == "sections.unknown")
            .map(|p| p.message)
            .collect();

        assert_eq!(
            unknown,
            if reported {
                vec!["unknown section \"#### Detail\"".to_string()]
            } else {
                vec![]
            },
            "{heading}"
        );
    }
}

/// US6 4: a decision's change is made in place, so a `## Proposed change` section is unknown.
#[test]
fn a_proposed_change_section_is_unknown_in_a_decision() {
    let example = Example::new();
    let decision = "specs/decisions/task-storage.md";
    let text = example.read(decision);
    example.write(
        decision,
        &format!("{text}\n## Proposed change (2026-10-06-recurring-tasks)\n\nA change.\n"),
    );

    let problems = summary(&example.problems());

    let line = text.lines().count() + 2;
    let expected = format!(
        "{decision}:{line}: unknown section \"## Proposed change (2026-10-06-recurring-tasks)\""
    );
    assert!(problems.contains(&expected), "{expected}\nin {problems:#?}");
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
            "decision comment without its quote",
            |e| e.write(&format!("{FEATURE}/spec-review.md"), "---\nverdict: pending\ncommit: a1b2c3d\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Decision task-storage, lines 15–16 removed, under \"Rules\"\n\nKeep it.\n"),
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
        (
            "edge case importance",
            |e| e.edit(SPEC, "| Normal     | A repeating task is deleted", "| Urgent     | A repeating task is deleted"),
            format!("{spec}:{}: importance is high, normal, or niche", spec_line("| Normal     | A repeating task is deleted")),
        ),
        (
            "spec length",
            |e| {
                e.waiting(SPEC);
                e.append_words(SPEC, "## Architecture", 3_100 - check::reviewed_words(&e.read(SPEC)));
            },
            format!("warning: {spec}: the spec's reviewed part is 3,100 words: aim at 2,000"),
        ),
        (
            "spec block items",
            |e| {
                e.waiting(SPEC);
                e.edit(SPEC, "> - Risk tier `high`", "> - One more point.\n> - Another point.\n> - Risk tier `high`");
            },
            format!("warning: {spec}:{}: the block has 8 items: keep at most 7", spec_line("> - Risk tier `high`") + 2),
        ),
        (
            "decision rules",
            |e| with_rules(e, &rules(12)),
            format!("warning: {DECISION}:{}: 12 rules: keep at most 10, or split the topic", line_of(DECISION, "## Rules")),
        ),
        (
            "decision order",
            |e| with_rules(e, "- A rule SHOULD hold.\n- A rule MUST hold.\n"),
            format!("warning: {DECISION}:{}: a MUST rule after a SHOULD one: put the strongest first", line_of(DECISION, "## Rules") + 3),
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

/// SC-003: a story link is a plain markdown link, and a spec holding one checks without problem.
#[test]
fn a_spec_with_a_story_link_has_no_problem() {
    let example = Example::new();
    example.edit(
        &format!("{FEATURE}/spec.md"),
        "### US1: Make a task repeat (P1)\n",
        "### US1: Make a task repeat (P1)\n\n[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)\n",
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// US6.4, the preview decision's fields: one row per field value.
#[test]
fn the_preview_decisions_fields() {
    const PREVIEW: &str = "specs/decisions/preview.md";
    let decision = |fields: &str| {
        format!(
            "---\nstatus: active\napproved-by: me\n{fields}---\n\n# Preview\n\n## Rules\n\n- A rule.\n\n\
             ## Why\n\nWhy.\n\n## Alternatives considered\n\n- None.\n\n## Consequences\n\n- None.\n\n\
             ## Applies to\n\n- `src/`\n"
        )
    };
    let rows: &[(&str, String, Option<String>)] = &[
        (
            "both fields",
            decision(
                "preview-folder: packages/web\npreview-command: pnpm exec storybook dev --port {port}\n",
            ),
            None,
        ),
        ("neither field", decision(""), None),
        (
            "the root",
            decision("preview-folder: .\npreview-command: npx storybook dev -p {port}\n"),
            None,
        ),
        (
            "no {port}",
            decision("preview-folder: packages/web\npreview-command: npx storybook dev\n"),
            Some(format!("{PREVIEW}: \"preview-command\" has no {{port}}")),
        ),
        (
            "no command",
            decision("preview-folder: packages/web\n"),
            Some(format!("{PREVIEW}: no \"preview-command\" field")),
        ),
        (
            "no folder",
            decision("preview-command: x --port {port}\n"),
            Some(format!("{PREVIEW}: no \"preview-folder\" field")),
        ),
        (
            "a folder outside",
            decision("preview-folder: ../web\npreview-command: x {port}\n"),
            Some(format!(
                "{PREVIEW}: \"preview-folder\" \"../web\" is not a folder of the repository"
            )),
        ),
        (
            "an absolute folder",
            decision("preview-folder: /web\npreview-command: x {port}\n"),
            Some(format!(
                "{PREVIEW}: \"preview-folder\" \"/web\" is not a folder of the repository"
            )),
        ),
    ];
    for (case, text, expected) in rows {
        let example = Example::new();
        example.write(PREVIEW, text);

        let problems: Vec<String> = summary(&example.problems())
            .into_iter()
            .filter(|p| p.starts_with(PREVIEW))
            .collect();

        assert_eq!(
            problems,
            expected.iter().cloned().collect::<Vec<_>>(),
            "{case}"
        );
    }
}

/// The preview fields anywhere but the preview decision are unknown fields.
#[test]
fn preview_fields_belong_to_the_preview_decision() {
    let example = Example::new();
    example.edit(
        "specs/decisions/due-dates.md",
        "approved-by: mrtolkien\n",
        "approved-by: mrtolkien\npreview-folder: web\n",
    );

    assert_eq!(
        summary(&example.problems()),
        ["specs/decisions/due-dates.md:4: unknown field \"preview-folder\""]
    );
}

/// C8: a decision may name its icon, the preview decision too; another field is still unknown.
#[test]
fn a_decision_may_have_an_icon() {
    let decision = |title: &str, fields: &str| {
        format!(
            "---\nstatus: active\napproved-by: me\n{fields}---\n\n# {title}\n\n## Rules\n\n- A rule.\n\n\
             ## Why\n\nWhy.\n\n## Consequences\n\n- None.\n\n## Applies to\n\n- `src/`\n"
        )
    };
    let example = Example::new();
    example.write(
        "specs/decisions/topic.md",
        &decision("Topic", "icon: git-branch\n"),
    );
    example.write(
        "specs/decisions/preview.md",
        &decision("Preview", "icon: eye\n"),
    );
    assert_eq!(summary(&example.problems()), Vec::<String>::new());

    example.write(
        "specs/decisions/topic.md",
        &decision("Topic", "icon: git-branch\ncolour: blue\n"),
    );
    assert_eq!(
        summary(&example.problems()),
        ["specs/decisions/topic.md:5: unknown field \"colour\""]
    );
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
fn a_follow_up_of_a_comment_alone_needs_no_answer() {
    let example = Example::new();
    example.edit(
        &format!("{FEATURE}/clarifications-01.md"),
        "**Answer:** C, we want a simple feature.",
        "**Answer:** keep it simple",
    );

    let problems = summary(&example.problems());

    assert_eq!(problems, Vec::<String>::new());
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

/// A change's folder holds its proposal, rounds, rulings, images, mockups, and screenshots, and
/// nothing of a feature's or of the old bug flow.
#[test]
fn a_changes_folder_holds_only_its_files() {
    for (path, allowed) in [
        ("proposal.md", true),
        ("clarifications-01.md", true),
        ("rulings.md", true),
        ("images/a.webp", true),
        ("mockups/InvoiceList.stories.tsx", true),
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
                "{CHANGE}/{name}: \"{name}\" has no place in a change: its folder holds proposal.md, clarifications-NN.md, rulings.md, images/, mockups/, and screenshots/."
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

/// A file of a change's folder that the folder does not hold is reported when the file alone is
/// checked, on disk or as a text, as the editor checks it, and not for the files it holds.
#[test]
fn a_change_file_alone_is_checked_against_its_folder() {
    for (name, allowed) in [
        ("notes.md", false),
        ("spec.md", false),
        ("proposal.md", true),
        ("clarifications-01.md", true),
    ] {
        let example = Example::new();
        let file = format!("{CHANGE}/{name}");
        if name != "proposal.md" {
            example.write(&file, "x\n");
        }
        let path = example.root().join(&file);
        let expected: Vec<String> = if allowed {
            vec![]
        } else {
            vec![format!(
                "{file}: \"{name}\" has no place in a change: its folder holds proposal.md, clarifications-NN.md, rulings.md, images/, mockups/, and screenshots/."
            )]
        };
        let flagged = |problems: Vec<Problem>| -> Vec<String> {
            let named: Vec<Problem> = problems
                .into_iter()
                .filter(|p| p.rule == "names.change-file")
                .collect();
            summary(&named)
        };

        let on_disk = check::check(example.root(), &path).unwrap();
        let as_text = check::check_text(example.root(), &path, &example.read(&file));

        assert_eq!(flagged(on_disk), expected, "{name} on disk");
        assert_eq!(flagged(as_text), expected, "{name} as a text");
    }
}

const INBOX: &str = "specs/INBOX.md";
const TRIAGE: &str = "specs/INBOX-TRIAGE.md";

/// Review focus 6: a repeated category is reported on its second heading.
#[test]
fn a_repeated_category_is_reported_on_its_second_heading() {
    let example = Example::new();
    example.write(
        INBOX,
        "# Inbox\n\n## UI\n\n- a\n\n## CLI\n\n- b\n\n## UI\n\n- c\n",
    );

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:11: the category \"UI\" is repeated")]
    );
}

#[test]
fn the_inbox_is_titled_inbox() {
    let example = Example::new();
    example.edit(INBOX, "# Inbox\n", "# Notes\n");

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:1: the title is \"# Inbox\"")]
    );
    let rules: Vec<String> = example.problems().into_iter().map(|p| p.rule).collect();
    assert_eq!(rules, vec!["inbox.title"]);
}

/// A project set up before the inbox has none, and is asked for none.
#[test]
fn a_missing_inbox_is_no_problem() {
    let example = Example::new();
    fs::remove_file(example.root().join(INBOX)).unwrap();

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// The inbox links started features like the priorities do: their files live on their branches.
#[test]
fn the_inbox_may_link_a_started_feature() {
    let example = Example::new();
    example.write(
        INBOX,
        "# Inbox\n\n- [Run UI](2026-10-20-run-ui/spec.md)\n- [Gone](drafts/gone.md)\n",
    );

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:4: no file drafts/gone.md")]
    );
}

/// A note may link a started change's proposal: its files live on its branch, as a feature's do.
#[test]
fn the_inbox_may_link_a_started_change() {
    let example = Example::new();
    example.write(
        INBOX,
        "# Inbox\n\n- [Login banner](changes/2026-10-20-login-banner/proposal.md)\n- [Gone](changes/gone/proposal.md)\n",
    );

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:4: no file changes/gone/proposal.md")]
    );
}

/// An `INBOX.md` or `INBOX-TRIAGE.md` in a change's folder is no inbox: the folder has no place
/// for it.
#[test]
fn an_inbox_in_a_changes_folder_is_reported_as_out_of_place() {
    for name in ["INBOX.md", "INBOX-TRIAGE.md"] {
        let example = Example::new();
        example.write(&format!("{CHANGE}/{name}"), "# Notes\n");

        let rules: Vec<String> = example.problems().into_iter().map(|p| p.rule).collect();

        assert_eq!(rules, vec!["names.change-file"], "{name}");
    }
}

fn triage() -> String {
    repository_file("fixtures/INBOX-TRIAGE.md")
}

#[test]
fn an_awaiting_triage_has_no_problems() {
    let example = Example::new();
    example.write(TRIAGE, &triage());

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// The triage is checked as a round of questions, not as a free file.
#[test]
fn a_triage_is_checked_like_a_round() {
    let answered = triage()
        .replace("status: awaiting-human", "status: answered")
        .replacen("**Answer:**\n", "**Answer:** A\n", 1);
    let blank_line = answered
        .lines()
        .position(|line| line == "**Answer:**")
        .unwrap()
        + 1;
    let rows: Vec<(&str, String, String)> = vec![
        (
            "a blank answer",
            answered,
            format!("{TRIAGE}:{blank_line}: Q2 has no answer"),
        ),
        (
            "an unknown status",
            triage().replace("status: awaiting-human", "status: approved"),
            format!("{TRIAGE}:2: status \"approved\" is not one of awaiting-human, answered"),
        ),
        (
            "another title",
            triage().replace("# Inbox triage", "# Triage"),
            format!("{TRIAGE}:5: the title starts with \"Inbox triage\""),
        ),
        (
            "no block while awaiting",
            triage().replace("> [!IMPORTANT]", "> [!NOTE]"),
            format!("{TRIAGE}: a file waiting for the human opens with a \"> [!IMPORTANT]\" block"),
        ),
        (
            "a question without its answer line",
            triage().replacen("**Answer:**\n\n## Q2", "## Q2", 1),
            format!("{TRIAGE}:19: Q1 has no **Answer:** line"),
        ),
        (
            "an unknown section",
            triage().replace("## Context", "## Background"),
            format!("{TRIAGE}:14: unknown section \"## Background\""),
        ),
    ];
    for (name, text, expected) in rows {
        let example = Example::new();
        example.write(TRIAGE, &text);

        let problems = summary(&example.problems());

        assert!(
            problems.contains(&expected),
            "{name}: {expected}\nin {problems:#?}"
        );
    }
}

/// A closing `##` is not part of the name: `## UI ##` repeats `## UI`.
#[test]
fn closing_hashes_repeat_a_category() {
    let example = Example::new();
    example.write(INBOX, "# Inbox\n\n## UI\n\n- a\n\n## UI ##\n\n- b\n");

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:7: the category \"UI\" is repeated")]
    );
}

/// An empty heading names no category, so two of them repeat nothing.
#[test]
fn empty_headings_are_not_repeated_categories() {
    let example = Example::new();
    example.write(INBOX, "# Inbox\n\n## \n\n- a\n\n##\n\n- b\n");

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// Only `specs/INBOX.md` and `specs/INBOX-TRIAGE.md` are the inbox and its triage: a file of the
/// same name elsewhere is the human's.
#[test]
fn an_inbox_outside_the_top_of_specs_is_not_checked() {
    let example = Example::new();
    for path in [
        format!("{FEATURE}/INBOX.md"),
        "specs/drafts/INBOX.md".to_string(),
        format!("{FEATURE}/INBOX-TRIAGE.md"),
        "docs/INBOX.md".to_string(),
    ] {
        example.write(&path, "# Foo\n\n## A\n\n## A\n");
    }
    example.edit(INBOX, "# Inbox\n", "# Foo\n");

    assert_eq!(
        summary(&example.problems()),
        vec![format!("{INBOX}:1: the title is \"# Inbox\"")]
    );
    let docs = check::check(example.root(), &example.root().join("docs/INBOX.md")).unwrap();
    assert_eq!(summary(&docs), Vec::<String>::new());
}

/// The triage's `answered` is the human's Submit, as a round's is.
#[test]
fn the_triages_answered_status_submits() {
    let example = Example::new();
    let path = example.root().join(TRIAGE);

    let fields = check::fields(example.root(), &path, &triage());

    let status = fields.iter().find(|f| f.name == "status").unwrap();
    assert_eq!(status.value.as_deref(), Some("awaiting-human"));
    let actions: Vec<(&str, Option<check::Action>)> = status
        .values
        .iter()
        .map(|c| (c.value.as_str(), c.action))
        .collect();
    assert_eq!(
        actions,
        [
            ("awaiting-human", None),
            ("answered", Some(check::Action::Submit))
        ]
    );
}

const ROUND: &str = "specs/2026-10-06-recurring-tasks/clarifications-01.md";

/// The line of the first line of `text` that is `needle`, from 1.
fn line_in(text: &str, needle: &str) -> usize {
    text.lines().position(|line| line == needle).unwrap() + 1
}

/// US1.1: the template's skeleton, its placeholders left as text and its topic links pointed at the
/// example's discovery, has no problems. The links of other files to the example's questions are
/// left out.
#[test]
fn the_rounds_template_has_no_problems() {
    let example = Example::new();
    let template = repository_file(
        "skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md",
    )
    .replace("#topic", "#next-due-date");
    example.write(ROUND, &template);

    let problems: Vec<Problem> = example
        .problems()
        .into_iter()
        .filter(|p| p.file == ROUND)
        .collect();

    assert_eq!(summary(&problems), Vec::<String>::new());
}

/// US1.2, US1.3, and the edge case on `###` headings: one row per break of the example round,
/// with every problem it causes.
#[test]
fn the_rounds_parts() {
    type Break = fn(&str) -> String;
    type Expected = fn(&str) -> Vec<String>;
    let rows: Vec<(&str, Break, Expected)> = vec![
        (
            "no Sources",
            |text| text.replacen("### Sources\n\n", "", 1),
            |_| vec![format!("{ROUND}: missing section \"### Sources\"")],
        ),
        (
            "a point outside a group",
            |text| {
                text.replacen(
                    "## Settled without the human\n\n",
                    "## Settled without the human\n\n- **A loose point** settled.\n\n",
                    1,
                )
            },
            |text| {
                vec![format!(
                    "{ROUND}:{}: a settled point outside a group: put it under \"### Check these\", \"### Behaviour\", or \"### Under the hood\"",
                    line_in(text, "- **A loose point** settled.")
                )]
            },
        ),
        (
            "an unknown part of the Context",
            |text| text.replacen("### Sources\n", "### Risks\n\nNone.\n\n### Sources\n", 1),
            |text| {
                vec![format!(
                    "{ROUND}:{}: unknown section \"### Risks\"",
                    line_in(text, "### Risks")
                )]
            },
        ),
        (
            "an unknown group of settled points",
            |text| {
                text.replacen(
                    "**Notes:**",
                    "### Risks\n\n- **A risk** none.\n\n**Notes:**",
                    1,
                )
            },
            |text| {
                vec![format!(
                    "{ROUND}:{}: unknown section \"### Risks\"",
                    line_in(text, "### Risks")
                )]
            },
        ),
        (
            "a quoted heading in the Context and in a settled point's source",
            |text| {
                text.replacen(
                    "### Sources\n",
                    "> ### Risks\n>\n> A quoted source.\n\n### Sources\n",
                    1,
                )
                .replacen(
                    "### Behaviour\n\n",
                    "### Behaviour\n\n> ### Risks\n>\n> A quoted source.\n\n",
                    1,
                )
            },
            |_| vec![],
        ),
    ];
    for (name, break_it, expected) in rows {
        let example = Example::new();
        let text = break_it(&example.read(ROUND));
        example.write(ROUND, &text);

        assert_eq!(summary(&example.problems()), expected(&text), "{name}");
    }
}

/// `settled.group` reads the settled section's top-level list items before its first group, up to
/// the notes in either form: one row per round, with the lines of the problems it causes.
#[test]
fn settled_points_outside_a_group() {
    type Edit = fn(&str) -> String;
    type Expected = fn(&str) -> Vec<usize>;
    fn settled(text: &str, section: &str) -> String {
        let start = text.find("## Settled without the human").unwrap();
        format!("{}{section}", &text[..start])
    }
    let rows: Vec<(&str, Edit, Expected)> = vec![
        (
            "notes in the other form after a group",
            |text| text.replacen("**Notes:**", "**Notes**:", 1),
            |_| vec![],
        ),
        (
            "notes in the other form and no group",
            |text| {
                settled(
                    text,
                    "## Settled without the human\n\n**Notes**:\n\n- A note.\n- **Another**: one.\n",
                )
            },
            |_| vec![],
        ),
        (
            "a tilde fence before the first group",
            |text| {
                text.replacen(
                    "## Settled without the human\n\n",
                    "## Settled without the human\n\n~~~\n- not a point\n~~~\n\n",
                    1,
                )
            },
            |_| vec![],
        ),
        (
            "an ordered item before the first group",
            |text| {
                text.replacen(
                    "## Settled without the human\n\n",
                    "## Settled without the human\n\n1. **A loose point** settled.\n\n",
                    1,
                )
            },
            |text| vec![line_in(text, "1. **A loose point** settled.")],
        ),
    ];
    for (name, edit, expected) in rows {
        let example = Example::new();
        let text = edit(&example.read(ROUND));
        example.write(ROUND, &text);

        let lines: Vec<usize> = example
            .problems()
            .into_iter()
            .filter(|p| p.rule == "settled.group")
            .filter_map(|p| p.line)
            .collect();

        assert_eq!(lines, expected(&text), "{name}");
    }
}

/// A round after the first opens its Context with what happened since the last round.
#[test]
fn a_later_round_says_what_happened_since_the_last() {
    let later = format!("{FEATURE}/clarifications-02.md");
    let since = "### Since the last round\n\nRound 01 was answered.\n\n";
    type Edit = fn(&str, &str) -> String;
    type Expected = fn(&str) -> Vec<String>;
    let rows: Vec<(&str, Edit, Expected)> = vec![
        (
            "without it",
            |text, _| text.to_string(),
            |_| vec!["missing section \"### Since the last round\"".to_string()],
        ),
        (
            "first",
            |text, since| text.replacen("### Goal\n", &format!("{since}### Goal\n"), 1),
            |_| vec![],
        ),
        (
            "after the goal",
            |text, since| text.replacen("### Today\n", &format!("{since}### Today\n"), 1),
            |text| {
                vec![format!(
                    "{}: \"### Since the last round\" must come before \"### Goal\", as in the template",
                    line_in(text, "### Since the last round")
                )]
            },
        ),
    ];
    for (name, edit, expected) in rows {
        let example = Example::new();
        let text = edit(&example.read(ROUND), since);
        example.write(&later, &text);

        let problems: Vec<String> = example
            .problems()
            .into_iter()
            .filter(|p| p.file == later)
            .map(|p| match p.line {
                Some(line) => format!("{line}: {}", p.message),
                None => p.message,
            })
            .collect();

        assert_eq!(problems, expected(&text), "{name}");
    }
}

/// The triage keeps a free Context, sub-headings included, and has no settled points.
#[test]
fn a_triages_context_is_free() {
    let example = Example::new();
    example.write(
        TRIAGE,
        &triage().replacen(
            "## Q1:",
            "### What I read\n\nThe code and the drafts.\n\n## Q1:",
            1,
        ),
    );

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// R4: a round recorded at finish keeps its parts as `#####` headings, under `#### Context` and
/// `#### Settled without the human`.
#[test]
fn a_record_keeps_a_rounds_parts() {
    let example = Example::new();
    let text = record("feature", "Recurring tasks").replacen(
        "### Round 01\n\n",
        "### Round 01\n\n#### Context\n\n##### Goal\n\nA goal.\n\n##### Sources\n\n- The code.\n\n\
         #### Settled without the human\n\n##### Behaviour\n\n- **A point** settled.\n\n",
        1,
    );
    example.write("specs/done/2026-10-20-recurring-tasks.md", &text);

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

/// A waiting round of `questions` questions, the first with `follow_ups` follow-ups, each with
/// options A and B, whose block opens with `first_line`.
fn waiting_round(first_line: &str, questions: usize, follow_ups: usize) -> String {
    let answers = vec![""; questions];
    let mut text = common::texts::clarifications("awaiting-human", first_line, &answers);
    let follow_up = |letter: char| {
        format!(
            "\n### Q1.{letter}: Then what?\n\nOnly if you picked {letter} in Q1.\n\n\
             - **A (recommended). Yes.**\n  - [pro] p\n- **B. No.**\n  - [con] c\n\n**Answer:**\n"
        )
    };
    let added: String = ['A', 'B', 'C'][..follow_ups]
        .iter()
        .map(|l| follow_up(*l))
        .collect();
    if let Some(at) = text.find("\n## Q2:").or_else(|| text.find("\n## Settled")) {
        text.insert_str(at, &added);
    }
    text
}

/// The problems of the round at `ROUND`, in the example, when it holds `text`.
fn round_problems(text: &str) -> Vec<Problem> {
    let example = Example::new();
    example.write(ROUND, text);
    example
        .problems()
        .into_iter()
        .filter(|p| p.file == ROUND)
        .collect()
}

/// A sentence of `n` words, with its full stop.
fn sentence(n: usize) -> String {
    let words: Vec<String> = (1..=n).map(|i| format!("word{i}")).collect();
    format!("{}.", words.join(" "))
}

/// US1.4 and R3: the block's counts against the round's, a warning that does not fail the check.
#[test]
fn the_blocks_counts_are_the_rounds() {
    let rows = [
        (
            "3 questions and 1 follow-up, about 15 minutes.",
            vec!["the block says 1 follow-up, the round has 2"],
        ),
        ("3 questions and 2 follow-ups, about 15 minutes.", vec![]),
        (
            "2 questions and 2 follow-ups, about 15 minutes.",
            vec!["the block says 2 questions, the round has 3"],
        ),
        (
            "3 questions, about 15 minutes.",
            vec!["the block says 0 follow-ups, the round has 2"],
        ),
        ("Three questions, about 15 minutes.", vec![]),
        // A round sent back for blank answers names them, and counts only those.
        ("2 questions still need an answer: Q1 and Q3.", vec![]),
    ];
    for (first_line, expected) in rows {
        let text = waiting_round(first_line, 3, 2);
        let line = line_in(&text, &format!("> {first_line}"));
        let expected: Vec<String> = expected
            .iter()
            .map(|message| format!("warning: {ROUND}:{line}: {message}"))
            .collect();

        let problems = round_problems(&text);

        assert_eq!(summary(&problems), expected, "{first_line}");
        assert!(
            problems.iter().all(|p| p.rule == "block.count"),
            "{problems:?}"
        );
    }
}

/// US1.5, R2, and review focus 4: a sentence over 25 words, on its own line, outside quotes,
/// tables, code, links' text, and the answers.
#[test]
fn a_long_sentence_is_reported_on_its_line() {
    // Each row replaces a text of the round, `LONG` standing for the sentence of 31 words, and
    // gives the start of the line the warning is on, or none.
    let rows: [(&str, &str, &str, Option<&str>); 13] = [
        (
            "an option",
            "**A (recommended). One.**",
            "**A (recommended). LONG**",
            Some("- **A (recommended). "),
        ),
        (
            "a nested item, second in its list",
            "  - [pro] p\n",
            "  - [pro] p\n  - [con] LONG\n",
            Some("  - [con] word1"),
        ),
        (
            "the second line of a paragraph",
            "A goal.\n",
            "A goal. Short.\nLONG\n",
            Some("word1 "),
        ),
        (
            "a line after a sentence holding the first word",
            "A goal.\n",
            "Short word1 here.\nLONG\n",
            Some("word1 "),
        ),
        (
            "a line after code holding the first word in a longer one",
            "A goal.\n",
            "Short here. `password1s`\nLONG\n",
            Some("word1 "),
        ),
        (
            "the block",
            "> - A point.\n",
            "> - A point. LONG\n",
            Some("> - A point. "),
        ),
        (
            "a settled point",
            "- **A point** settled.",
            "- **A point** settled. LONG",
            Some("- **A point** "),
        ),
        ("a quote", "Why.\n", "Why.\n\n> LONG\n", None),
        (
            "a table",
            "Why.\n",
            "Why.\n\n| A |\n| - |\n| LONG |\n",
            None,
        ),
        ("code", "Why.\n", "Why.\n\n```\nLONG\n```\n", None),
        (
            "a link's text",
            "Why.\n",
            "Why it matters: [LONG](proposal.md).\n",
            None,
        ),
        ("an answer", "**Answer:**\n", "**Answer:** LONG\n", None),
        ("the notes", "**Notes:**\n", "**Notes:** LONG\n", None),
    ];
    for (name, from, to, line_start) in rows {
        let text = waiting_round("2 questions, about 10 minutes.", 2, 0).replacen(
            from,
            &to.replace("LONG", &sentence(31)),
            1,
        );
        let expected: Vec<String> = line_start
            .map(|start| {
                let line = text.lines().position(|l| l.starts_with(start)).unwrap() + 1;
                format!("warning: {ROUND}:{line}: a sentence of 31 words: split it at 25")
            })
            .into_iter()
            .collect();

        let problems = round_problems(&text);

        assert_eq!(summary(&problems), expected, "{name}");
        assert!(
            problems.iter().all(|p| p.rule == "writing.sentence"),
            "{name}: {problems:?}"
        );
    }
}

/// A sentence of 25 words is at the limit, and is not reported.
#[test]
fn a_sentence_of_25_words_is_kept() {
    let text = waiting_round("1 question, about 5 minutes.", 1, 0).replacen(
        "A goal.\n",
        &format!("{}\n", sentence(25)),
        1,
    );

    assert_eq!(summary(&round_problems(&text)), Vec::<String>::new());
}

/// US1.6: a block of 8 items, reported on the eighth.
#[test]
fn a_block_of_more_than_7_items_is_reported() {
    let items: String = (2..=8).map(|i| format!("> - Point {i}.\n")).collect();
    let text = waiting_round("1 question, about 5 minutes.", 1, 0).replacen(
        "> - A point.\n",
        &format!("> - A point.\n{items}"),
        1,
    );
    let line = line_in(&text, "> - Point 8.");

    let problems = round_problems(&text);

    assert_eq!(
        summary(&problems),
        [format!(
            "warning: {ROUND}:{line}: the block has 8 items: keep at most 7"
        )]
    );
    assert_eq!(problems[0].rule, "block.items");
    let seven = text.replacen("> - Point 8.\n", "", 1);
    assert_eq!(summary(&round_problems(&seven)), Vec::<String>::new());
}

/// The warnings run on waiting rounds only.
#[test]
fn an_answered_round_has_no_warning() {
    let items: String = (2..=8).map(|i| format!("> - Point {i}.\n")).collect();
    let text = common::texts::clarifications("answered", "Answered on 2026-10-18.", &["A"])
        .replacen(
            "> - A point.\n",
            &format!("> - A point. {}\n{items}", sentence(31)),
            1,
        )
        .replacen("A goal.", &sentence(40), 1);

    assert_eq!(summary(&round_problems(&text)), Vec::<String>::new());
}

/// The triage is measured as a round is.
#[test]
fn a_waiting_triage_is_measured() {
    let example = Example::new();
    let text = triage().replacen("## Q1:", &format!("{}\n\n## Q1:", sentence(30)), 1);
    example.write(TRIAGE, &text);
    let line = line_in(&text, &sentence(30));

    assert_eq!(
        summary(&example.problems()),
        [format!(
            "warning: {TRIAGE}:{line}: a sentence of 30 words: split it at 25"
        )]
    );
}

/// The fixture rounds checked by `every_fixture_round_passes`, from the repository's top level.
/// The repository-branch copies of the example, under `fixtures/repo/branches/`, are checked in
/// place, where their fixture repository lacks the discovery, the priorities, and the
/// constitution they link to: for them only, `links.file` problems are left out. The rounds of
/// `fixtures/specs/` are stubs for the workspace's tests, and `fixtures/broken/` is broken on
/// purpose: neither is listed.
const FIXTURE_ROUNDS: [&str; 7] = [
    "fixtures/round-mockup/clarifications-01.md",
    "fixtures/settled-comments/clarifications-01.md",
    "fixtures/preview/feature/specs/2026-10-20-sidebar-resize/clarifications-01.md",
    "fixtures/repo/branches/2026-10-06-recurring-tasks/specs/2026-10-06-recurring-tasks/clarifications-01.md",
    "fixtures/repo/branches/2026-10-11-web-ui/specs/2026-10-11-web-ui/clarifications-01.md",
    "fixtures/repo/branches/2026-10-12-cli-tuis/specs/2026-10-12-cli-tuis/clarifications-01.md",
    "fixtures/repo/branches/2026-10-13-plan-review/specs/2026-10-13-plan-review/clarifications-01.md",
];

/// US1.8 and SC-002: the example round, the templates, and every fixture round report neither a
/// problem nor a warning. The template and the triages are checked in the example, as the
/// template's own test does; the fixture rounds in place, as `FIXTURE_ROUNDS` says.
#[test]
fn every_fixture_round_passes() {
    let repository = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    for path in FIXTURE_ROUNDS {
        let in_branch = path.starts_with("fixtures/repo/branches/");
        let problems: Vec<Problem> = check::check(&repository, &repository.join(path))
            .unwrap()
            .into_iter()
            .filter(|p| !(in_branch && p.rule == "links.file"))
            .collect();

        assert_eq!(summary(&problems), Vec::<String>::new(), "{path}");
    }
    let example = Example::new();
    let template = repository_file(
        "skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md",
    )
    .replace("#topic", "#next-due-date");
    example.write(ROUND, &template);
    let template_problems: Vec<Problem> = example
        .problems()
        .into_iter()
        .filter(|p| p.file == ROUND)
        .collect();
    assert_eq!(
        summary(&template_problems),
        Vec::<String>::new(),
        "template"
    );
    for triage in [
        "fixtures/INBOX-TRIAGE.md",
        "skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md",
    ] {
        let example = Example::new();
        example.write(TRIAGE, &repository_file(triage));

        assert_eq!(
            summary(&example.problems()),
            Vec::<String>::new(),
            "{triage}"
        );
    }
    assert_eq!(summary(&Example::new().problems()), Vec::<String>::new());
}

/// SC-005: the example round, measured as if it waited, has no sentence over 25 words and at most
/// 7 block items.
#[test]
fn the_example_round_holds_to_the_writing_limits() {
    let example = Example::new();
    let text = example
        .read(ROUND)
        .replacen("status: answered", "status: awaiting-human", 1)
        .replacen("> [!NOTE]", "> [!IMPORTANT]", 1);

    assert_eq!(summary(&round_problems(&text)), Vec::<String>::new());
}

/// US1.8, for a change: the example change's round waits for the human, and reports neither a
/// problem nor a warning. A change has no discovery file, so its Sources link none.
#[test]
fn the_example_change_round_passes() {
    let example = Example::new();
    let path = format!("{CHANGE}/clarifications-01.md");
    let text = example.read(&path);
    let problems: Vec<Problem> = example
        .problems()
        .into_iter()
        .filter(|p| p.file == path)
        .collect();

    assert_eq!(summary(&problems), Vec::<String>::new());
    assert!(text.contains("status: awaiting-human"));
    assert!(text.contains("> [!IMPORTANT]"));
    assert!(!text.contains("discovery-0"), "a change has no discovery");
}

const SPEC: &str = "specs/2026-10-06-recurring-tasks/spec.md";

impl Example {
    /// Sets the example spec waiting for the human, its block an `> [!IMPORTANT]` one.
    fn waiting(&self, path: &str) {
        self.edit(path, "status: approved", "status: awaiting-human");
        self.edit(path, "> [!NOTE]", "> [!IMPORTANT]");
        self.edit(path, "> Approved on 2026-10-09.", "> About 10 minutes.");
    }

    /// Adds a paragraph of `count` words at the end of the level-2 section `heading`.
    fn append_words(&self, path: &str, heading: &str, count: usize) {
        let text = self.read(path);
        let start = text.find(&format!("\n{heading}\n")).unwrap() + 1;
        let end = text[start..]
            .find("\n## ")
            .map_or(text.len(), |at| start + at + 1);
        let words = vec!["word"; count].join(" ");
        let text = format!("{}{words}\n\n{}", &text[..end], &text[end..]);
        self.write(path, &text);
    }

    fn warnings(&self) -> Vec<String> {
        let warnings: Vec<Problem> = self
            .problems()
            .into_iter()
            .filter(|p| p.severity == Severity::Warning)
            .collect();
        summary(&warnings)
    }
}

/// US1 2: a waiting spec whose reviewed part runs past 2,500 words warns, with the count.
#[test]
fn a_long_waiting_spec_is_reported() {
    let example = Example::new();
    example.waiting(SPEC);
    let words = check::reviewed_words(&example.read(SPEC));
    example.append_words(SPEC, "## Architecture", 3_100 - words);

    let problems = example.problems();

    assert_eq!(check::reviewed_words(&example.read(SPEC)), 3_100);
    assert_eq!(
        summary(&problems),
        [format!(
            "warning: {SPEC}: the spec's reviewed part is 3,100 words: aim at 2,000"
        )]
    );
    assert_eq!(problems[0].rule, "spec.length");
}

/// A spec at the limit, or an answered one past it, does not warn.
#[test]
fn a_spec_at_the_limit_or_approved_is_not_reported() {
    let at_limit = Example::new();
    at_limit.waiting(SPEC);
    let words = check::reviewed_words(&at_limit.read(SPEC));
    at_limit.append_words(SPEC, "## Architecture", check::SPEC_WORDS - words);
    let approved = Example::new();
    approved.append_words(SPEC, "## Architecture", 3_000);

    assert_eq!(at_limit.warnings(), Vec::<String>::new());
    assert_eq!(approved.warnings(), Vec::<String>::new());
}

/// US1: the reviewed part leaves out the "More scenarios" lists and `## History`.
#[test]
fn more_scenarios_and_history_are_not_reviewed() {
    let example = Example::new();
    let before = check::reviewed_words(&example.read(SPEC));
    let more = format!("\n2. {}\n", vec!["word"; 600].join(" "));
    example.edit(
        SPEC,
        "\n1. **Given** a repeating task, **When** the user picks \"never\", **Then** it stops repeating, keeps\n   its due date, and loses the icon.\n",
        &format!("\n1. **Given** a repeating task, **When** the user picks \"never\", **Then** it stops repeating, keeps\n   its due date, and loses the icon.{more}"),
    );
    example.append_words(SPEC, "## History", 600);

    assert_eq!(check::reviewed_words(&example.read(SPEC)), before);
    example.append_words(SPEC, "## Risk tier", 600);
    assert_eq!(check::reviewed_words(&example.read(SPEC)), before + 600);
}

/// US1 more 2: a waiting spec's block of 8 items warns on the eighth, and its first line is no
/// round's count.
#[test]
fn a_spec_block_of_8_items() {
    let example = Example::new();
    example.waiting(SPEC);
    example.edit(
        SPEC,
        "> - Risk tier `high`",
        "> - One more point.\n> - Another point.\n> - Risk tier `high`",
    );
    example.edit(
        SPEC,
        "> About 10 minutes.",
        "> About 10 minutes, 3 questions.",
    );
    let line = example
        .read(SPEC)
        .lines()
        .position(|l| l.starts_with("> - Risk tier `high`"))
        .unwrap()
        + 1;

    let problems = example.problems();

    assert_eq!(
        summary(&problems),
        [format!(
            "warning: {SPEC}:{line}: the block has 8 items: keep at most 7"
        )]
    );
    assert_eq!(problems[0].rule, "block.items");
}

/// US8 more 1: an edge case's importance is high, normal, or niche, whatever its case.
#[test]
fn an_edge_case_of_unknown_importance() {
    let example = Example::new();
    example.edit(
        SPEC,
        "| Normal     | A repeating task is deleted",
        "| Urgent     | A repeating task is deleted",
    );
    let line = example
        .read(SPEC)
        .lines()
        .position(|l| l.starts_with("| Urgent"))
        .unwrap()
        + 1;

    let problems = example.problems();

    assert_eq!(
        summary(&problems),
        [format!(
            "{SPEC}:{line}: importance is high, normal, or niche"
        )]
    );
    assert_eq!(problems[0].rule, "edges.importance");
    assert_eq!(problems[0].severity, Severity::Error);
}

const DECISION: &str = "specs/decisions/task-storage.md";

/// `count` rules, each a MUST, one with a nested item.
fn rules(count: usize) -> String {
    (1..=count)
        .map(|n| format!("- Rule {n} MUST hold. Checked by review.\n"))
        .collect::<String>()
        .replacen(
            "- Rule 1 MUST hold. Checked by review.\n",
            "- Rule 1 MUST hold. Checked by review.\n  - A nested point.\n  - Another.\n",
            1,
        )
}

fn with_rules(example: &Example, rules: &str) {
    let text = example.read(DECISION);
    let start = text.find("## Rules\n\n").unwrap() + "## Rules\n\n".len();
    let end = text.find("\n## Why").unwrap();
    example.write(
        DECISION,
        &format!("{}{rules}{}", &text[..start], &text[end..]),
    );
}

/// US6 1: a decision of 12 rules warns on its `## Rules` heading; nested items are no rules.
#[test]
fn a_decision_of_12_rules() {
    let example = Example::new();
    with_rules(&example, &rules(12));
    let line = line_in(&example.read(DECISION), "## Rules");

    let problems = example.problems();

    assert_eq!(
        summary(&problems),
        [format!(
            "warning: {DECISION}:{line}: 12 rules: keep at most 10, or split the topic"
        )]
    );
    assert_eq!(problems[0].rule, "decision.rules");
    let ten = Example::new();
    with_rules(&ten, &rules(check::DECISION_RULES));
    assert_eq!(ten.warnings(), Vec::<String>::new());
}

/// US2 more 2: a rule stronger than the one before it warns, on its line, naming both keywords.
#[test]
fn a_must_after_a_should() {
    let cases = [
        ("SHOULD", "MUST", "a MUST rule after a SHOULD one"),
        (
            "SHOULD NOT",
            "MUST NOT",
            "a MUST NOT rule after a SHOULD NOT one",
        ),
        ("MAY", "SHOULD", "a SHOULD rule after a MAY one"),
    ];
    for (weaker, stronger, message) in cases {
        let example = Example::new();
        with_rules(
            &example,
            &format!(
                "- The first rule MUST hold.\n- A rule {weaker} hold.\n- A rule {stronger} hold.\n- A rule MAY hold.\n"
            ),
        );
        let line = line_in(
            &example.read(DECISION),
            &format!("- A rule {stronger} hold."),
        );

        assert_eq!(
            example.warnings(),
            [format!(
                "warning: {DECISION}:{line}: {message}: put the strongest first"
            )],
            "{weaker} then {stronger}"
        );
    }
    let ordered = Example::new();
    with_rules(
        &ordered,
        "- A MUST NOT.\n- A MUST.\n- A MUST NOT.\n- A SHOULD.\n- A SHOULD NOT.\n- No keyword.\n- A SHOULD.\n- A MAY.\n",
    );
    assert_eq!(ordered.warnings(), Vec::<String>::new());
}

/// US1 3: the example spec and its data model report neither a problem nor a warning, the spec
/// measured as if it waited too.
#[test]
fn the_example_and_its_data_model_have_no_problem_nor_warning() {
    let example = Example::new();
    let data_model = format!("{FEATURE}/data-model.md");
    assert!(example.root().join(&data_model).is_file());
    let mine = |problems: Vec<Problem>| -> Vec<String> {
        let mine: Vec<Problem> = problems
            .into_iter()
            .filter(|p| p.file == SPEC || p.file == data_model)
            .collect();
        summary(&mine)
    };

    assert_eq!(mine(example.problems()), Vec::<String>::new());
    let waiting = Example::new();
    waiting.waiting(SPEC);
    assert_eq!(mine(waiting.problems()), Vec::<String>::new());
}

/// SC-001: the example spec's reviewed part is at most 2,000 words.
#[test]
fn the_example_spec_is_at_most_2000_words() {
    let text = repository_file(&format!("skills/uraeda/assets/example/{SPEC}"));

    let words = check::reviewed_words(&text);

    assert!(words <= 2_000, "{words} words");
}

/// The 18 decisions the specs redesign rewrote, listed in its spec, now in its record.
const REWRITTEN: [&str; 18] = [
    "agents",
    "attachments",
    "cli",
    "code-quality",
    "distribution",
    "git",
    "notifications",
    "preview",
    "repositories",
    "settings",
    "sign-in",
    "stack",
    "toolchain",
    "tui",
    "ui-behaviour",
    "ui-checks",
    "ui-components",
    "ui-layout",
];

/// SC-002: no decision of the repository holds more than 10 rules, and the decisions the specs
/// redesign rewrote hold at most 9,400 words together, their frontmatter aside.
#[test]
fn every_decision_of_the_repository_holds_at_most_10_rules() {
    let repository = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let decisions = repository.join("specs/decisions");

    let problems = check::check(&repository, &decisions).unwrap();

    let over: Vec<&Problem> = problems
        .iter()
        .filter(|p| p.rule == "decision.rules")
        .collect();
    assert!(over.is_empty(), "{over:#?}");
    let words: usize = REWRITTEN
        .iter()
        .map(|name| {
            let text = repository_file(&format!("specs/decisions/{name}.md"));
            let body = text.splitn(3, "---\n").nth(2).unwrap();
            body.split_whitespace().count()
        })
        .sum();
    assert!(words <= 9_400, "{words} words");
}
