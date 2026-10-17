use uraeda_core::decisions::{DecisionChange, PartChange, Strength, compare, strength};
use uraeda_core::files::document::LineRange;

/// A before text, an after text, and the parts expected, each `(section, kind, runs)` with the
/// runs written `=kept +added -removed`.
struct Case {
    name: &'static str,
    before: &'static str,
    after: &'static str,
    parts: &'static [(&'static str, &'static str, &'static str)],
}

const fn case(
    name: &'static str,
    before: &'static str,
    after: &'static str,
    parts: &'static [(&'static str, &'static str, &'static str)],
) -> Case {
    Case {
        name,
        before,
        after,
        parts,
    }
}

const CASES: &[Case] = &[
    case(
        "a reworded rule",
        "# T\n\n## Rules\n\n- Saving MUST keep the previous version. Checked by the store's tests.\n",
        "# T\n\n## Rules\n\n- Saving MUST keep every earlier version. Checked by the store's tests.\n",
        &[(
            "Rules",
            "changed",
            "=Saving MUST keep -the previous +every earlier =version. Checked by the store's tests.",
        )],
    ),
    case(
        "a rewrapped paragraph",
        "# T\n\nTasks are kept\nin the browser.\n",
        "# T\n\nTasks are kept in\nthe browser.\n",
        &[("", "kept", "=Tasks are kept in the browser.")],
    ),
    case(
        "a rule rewritten from scratch",
        "# T\n\n## Rules\n\n- Tasks MUST sync every minute.\n",
        "# T\n\n## Rules\n\n- Exports MUST be plain JSON files.\n",
        &[
            ("Rules", "added", "+Exports MUST be plain JSON files."),
            ("Rules", "removed", "-Tasks MUST sync every minute."),
        ],
    ),
    case(
        "60% of the shorter kept",
        "# T\n\n## Rules\n\n- Tasks MUST sync every minute.\n",
        "# T\n\n## Rules\n\n- Tasks MUST sync with the server each hour.\n",
        &[(
            "Rules",
            "changed",
            "=Tasks MUST sync -every minute. +with the server each hour.",
        )],
    ),
    case(
        "under 60% kept",
        "# T\n\n## Rules\n\n- Tasks MUST sync every minute.\n",
        "# T\n\n## Rules\n\n- Tasks MUST be plain files.\n",
        &[
            ("Rules", "added", "+Tasks MUST be plain files."),
            ("Rules", "removed", "-Tasks MUST sync every minute."),
        ],
    ),
    case(
        "the same text in another section",
        "# T\n\n## Rules\n\n- Tasks MUST sync every minute.\n\n## Why\n\nUsers switch devices.\n",
        "# T\n\n## Rules\n\n## Why\n\n- Tasks MUST sync every minute.\n\nUsers switch devices.\n",
        &[
            ("Rules", "removed", "-Tasks MUST sync every minute."),
            ("Why", "added", "+Tasks MUST sync every minute."),
            ("Why", "kept", "=Users switch devices."),
        ],
    ),
    case(
        "a frontmatter change only",
        "---\nstatus: proposed\n---\n\n# T\n\nTasks stay local.\n\n## Rules\n\n- Tasks MUST stay local.\n",
        "---\nstatus: active\n---\n\n# T\n\nTasks stay local.\n\n## Rules\n\n- Tasks MUST stay local.\n",
        &[
            ("", "kept", "=Tasks stay local."),
            ("Rules", "kept", "=Tasks MUST stay local."),
        ],
    ),
    case(
        "a new rule among kept ones",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Lists MAY be shared.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Exports MUST be plain JSON files.\n- Lists MAY be shared.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Rules", "added", "+Exports MUST be plain JSON files."),
            ("Rules", "kept", "=Lists MAY be shared."),
        ],
    ),
];

/// A part's runs, written `=kept +added -removed`.
fn runs(part: &PartChange) -> String {
    part.runs
        .iter()
        .map(|run| {
            let sign = match run.kind.as_str() {
                "kept" => "=",
                "added" => "+",
                "removed" => "-",
                other => panic!("a run of kind {other}"),
            };
            format!("{sign}{}", run.text)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Every part of a change, `(section, kind, runs)`, in order.
fn parts(change: &DecisionChange) -> Vec<(String, String, String)> {
    change
        .sections
        .iter()
        .flat_map(|section| {
            section
                .parts
                .iter()
                .map(|part| (section.title.clone(), part.kind.clone(), runs(part)))
        })
        .collect()
}

#[test]
fn each_case_compares_as_expected() {
    for case in CASES {
        let change = compare("t", Some(case.before), Some(case.after));

        let expected: Vec<(String, String, String)> = case
            .parts
            .iter()
            .map(|(section, kind, runs)| (section.to_string(), kind.to_string(), runs.to_string()))
            .collect();
        assert_eq!(parts(&change), expected, "{}", case.name);
        assert_eq!(change.kind, "changed", "{}", case.name);
    }
}

const STORAGE: &str = "---
status: active
---

# Task storage

Tasks live in the browser,
behind the store.

## Rules

- Data MUST NOT be sent to a server. Checked by review.
- Components SHOULD read through `src/store/`.
";

#[test]
fn a_new_decision_has_every_part_added() {
    let change = compare("task-storage", None, Some(STORAGE));

    assert_eq!(change.name, "task-storage");
    assert_eq!(change.title, "Task storage");
    assert_eq!(change.kind, "new");
    assert!(!change.listed);
    assert!(change.compared);
    let all: Vec<&PartChange> = change.sections.iter().flat_map(|s| &s.parts).collect();
    assert_eq!(all.len(), 3);
    assert!(
        all.iter()
            .all(|part| part.kind == "added" && part.before.is_none())
    );
}

#[test]
fn a_removed_decision_has_every_part_removed_with_its_old_lines() {
    let change = compare("task-storage", Some(STORAGE), None);

    assert_eq!(change.kind, "removed");
    assert_eq!(change.title, "Task storage");
    let all: Vec<&PartChange> = change.sections.iter().flat_map(|s| &s.parts).collect();
    assert_eq!(all.len(), 3);
    assert!(
        all.iter()
            .all(|part| part.kind == "removed" && part.after.is_none() && part.before.is_some())
    );
}

#[test]
fn a_renamed_decision_is_one_removed_and_one_new() {
    let removed = compare("task-storage", Some(STORAGE), None);
    let new = compare("local-storage", None, Some(STORAGE));

    assert_eq!(
        (removed.kind.as_str(), new.kind.as_str()),
        ("removed", "new")
    );
    assert!(removed.compared && new.compared);
}

#[test]
fn a_part_counts_its_lines_from_the_first_line_of_the_file() {
    let change = compare("task-storage", Some(STORAGE), Some(STORAGE));

    let intent = &change.sections[0];
    assert_eq!(intent.title, "");
    assert_eq!(intent.parts[0].after, Some(LineRange { start: 7, end: 8 }));
    assert_eq!(intent.parts[0].before, intent.parts[0].after);
    let rules = &change.sections[1];
    assert_eq!(rules.title, "Rules");
    assert_eq!(rules.parts[1].after, Some(LineRange { start: 13, end: 13 }));
}

#[test]
fn a_rule_has_its_strength_and_the_intent_none() {
    let change = compare("task-storage", None, Some(STORAGE));

    let strengths: Vec<Option<&str>> = change
        .sections
        .iter()
        .flat_map(|s| &s.parts)
        .map(|part| part.strength.as_deref())
        .collect();
    assert_eq!(strengths, [None, Some("must-not"), Some("should")]);
}

#[test]
fn a_rules_strength_is_its_first_keyword() {
    let cases = [
        ("Data MUST NOT be sent.", Some(Strength::MustNot)),
        (
            "Data MUST be kept, and MAY be copied.",
            Some(Strength::Must),
        ),
        (
            "Lists MAY be shared, and MUST be named.",
            Some(Strength::May),
        ),
        ("A test SHOULD NOT sleep.", Some(Strength::ShouldNot)),
        ("A test SHOULD run (SHOULD).", Some(Strength::Should)),
        ("Mustard must be yellow, MUSTARD.", None),
        ("It MUST, NOT always.", Some(Strength::Must)),
    ];
    for (text, expected) in cases {
        assert_eq!(strength(text), expected, "{text}");
    }
}

#[test]
fn a_strength_has_its_rank_and_name() {
    let all = [
        (Strength::Must, 0, "must"),
        (Strength::MustNot, 0, "must-not"),
        (Strength::Should, 1, "should"),
        (Strength::ShouldNot, 1, "should-not"),
        (Strength::May, 2, "may"),
    ];
    for (strength, rank, name) in all {
        assert_eq!((strength.rank(), strength.as_str()), (rank, name));
    }
}
