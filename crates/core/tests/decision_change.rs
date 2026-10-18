mod common;

use common::repo::TestRepo;
use common::texts::spec;
use uraeda_core::api;
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
    case(
        "the strongest rule moved first",
        "# T\n\n## Rules\n\n- Lists SHOULD be shared.\n- Tasks MUST stay local.\n- Exports MAY be JSON.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Lists SHOULD be shared.\n- Exports MAY be JSON.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Rules", "kept", "=Lists SHOULD be shared."),
            ("Rules", "kept", "=Exports MAY be JSON."),
        ],
    ),
    case(
        "a code block changed",
        "# T\n\n## Rules\n\n- Run it.\n\n```sh\nls\n```\n",
        "# T\n\n## Rules\n\n- Run it.\n\n```sh\nls -l\n```\n",
        &[
            ("Rules", "kept", "=Run it."),
            ("Rules", "changed", "=ls +-l"),
        ],
    ),
    case(
        "a table cell changed",
        "# T\n\n## Rules\n\n| Tier | Wait |\n| --- | --- |\n| low | wait one full day |\n",
        "# T\n\n## Rules\n\n| Tier | Wait |\n| --- | --- |\n| low | wait two full days |\n",
        &[
            ("Rules", "kept", "=Tier | Wait"),
            ("Rules", "changed", "=low | wait -one +two =full -day +days"),
        ],
    ),
    case(
        "a quote changed",
        "# T\n\n> Users MUST wait one day.\n",
        "# T\n\n> Users MUST wait two days.\n",
        &[("", "changed", "=Users MUST wait -one day. +two days.")],
    ),
    case(
        "a nested item changed",
        "# T\n\n## Rules\n\n- Tasks MUST sync.\n  - Every minute while online.\n",
        "# T\n\n## Rules\n\n- Tasks MUST sync.\n  - Every hour while online.\n",
        &[
            ("Rules", "kept", "=Tasks MUST sync."),
            ("Rules", "changed", "=Every -minute +hour =while online."),
        ],
    ),
    case(
        "a section only the merge base has",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n\n## Why\n\nUsers switch devices.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Why", "removed", "-Users switch devices."),
        ],
    ),
    case(
        "a section only the branch has",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n\n## Why\n\nUsers switch devices.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Why", "added", "+Users switch devices."),
        ],
    ),
    case(
        "two rules swapped",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Lists SHOULD be shared.\n",
        "# T\n\n## Rules\n\n- Lists SHOULD be shared.\n- Tasks MUST stay local.\n",
        &[
            ("Rules", "kept", "=Lists SHOULD be shared."),
            ("Rules", "kept", "=Tasks MUST stay local."),
        ],
    ),
    case(
        "two rules reworded across each other",
        "# T\n\n## Rules\n\n- Tasks MUST sync every minute.\n- Lists MUST sync every hour.\n",
        "# T\n\n## Rules\n\n- Lists MUST sync every day.\n- Tasks MUST sync every second.\n",
        &[
            ("Rules", "changed", "=Lists MUST sync every -hour. +day."),
            (
                "Rules",
                "changed",
                "=Tasks MUST sync every -minute. +second.",
            ),
        ],
    ),
    case(
        "a duplicated rule",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Tasks MUST stay local.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Rules", "added", "+Tasks MUST stay local."),
        ],
    ),
    case(
        "a duplicated rule removed",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Tasks MUST stay local.\n",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n",
        &[
            ("Rules", "kept", "=Tasks MUST stay local."),
            ("Rules", "removed", "-Tasks MUST stay local."),
        ],
    ),
    case("no text on either side", "", "", &[]),
    case(
        "a decision emptied",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n",
        "# T\n",
        &[("Rules", "removed", "-Tasks MUST stay local.")],
    ),
    case(
        "a rule moved to the end",
        "# T\n\n## Rules\n\n- Tasks MUST stay local.\n- Lists SHOULD be shared.\n- Exports MAY be JSON.\n",
        "# T\n\n## Rules\n\n- Lists SHOULD be shared.\n- Exports MAY be JSON.\n- Tasks MUST stay local.\n",
        &[
            ("Rules", "kept", "=Lists SHOULD be shared."),
            ("Rules", "kept", "=Exports MAY be JSON."),
            ("Rules", "kept", "=Tasks MUST stay local."),
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

#[test]
fn a_rule_merged_into_the_one_before_shows_removed() {
    let merged = "---
status: active
---

# Task storage

Tasks live in the browser,
behind the store.

## Rules

- Data MUST NOT be sent to a server, and components SHOULD read through `src/store/`. Checked by
  review.
";
    let change = compare("task-storage", Some(STORAGE), Some(merged));

    let kinds: Vec<(String, String)> = parts(&change)
        .into_iter()
        .map(|(section, kind, _)| (section, kind))
        .collect();
    let expected = [("", "kept"), ("Rules", "changed"), ("Rules", "removed")];
    assert_eq!(
        kinds,
        expected.map(|(section, kind)| (section.to_string(), kind.to_string()))
    );
    let removed = &change.sections[1].parts[1];
    assert_eq!(removed.before, Some(LineRange { start: 13, end: 13 }));
}

const FOLDER: &str = "2026-10-11-web-ui";
const SPEC: &str = "specs/2026-10-11-web-ui/spec.md";

/// A decision titled after its name, with an intent and one rule.
fn decision(name: &str, intent: &str, rule: &str) -> String {
    format!(
        "---\nstatus: active\napproved-by: mrtolkien\n---\n\n# {name}\n\n{intent}\n\n## Rules\n\n- {rule} Checked by review.\n"
    )
}

fn path(name: &str) -> String {
    format!("specs/decisions/{name}.md")
}

/// A spec whose `## Decisions` lists these decisions as changed, in this order.
fn listing(names: &[&str]) -> String {
    let items: String = names
        .iter()
        .map(|name| format!("- **Changed: [{name}](../decisions/{name}.md)**. It changes.\n"))
        .collect();
    spec("awaiting-human", 1, 1).replace("Relied on:", &format!("{items}\nRelied on:"))
}

/// `main` with the decisions `a`, `b`, and `c`, and the feature's branch from it, its spec listing
/// `listed`, the checkout left on `main`.
fn repo(listed: &[&str]) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    for name in ["a", "b", "c"] {
        repo.write(
            &path(name),
            &decision(name, "Tasks stay local.", "Tasks MUST sync."),
        );
    }
    repo.commit("chore: specs");
    repo.switch_new(FOLDER);
    repo.write(SPEC, &listing(listed));
    repo.commit("spec");
    repo.switch("main");
    repo
}

/// Commits files on the feature's branch, `None` removing one, and comes back to `main`.
fn on_branch(repo: &TestRepo, files: &[(&str, Option<String>)]) {
    repo.switch(FOLDER);
    for (path, text) in files {
        match text {
            Some(text) => repo.write(path, text),
            None => repo.remove(path),
        }
    }
    repo.commit("work");
    repo.switch("main");
}

fn changes(repo: &TestRepo) -> Vec<DecisionChange> {
    api::read_file(repo.path(), FOLDER, "spec.md")
        .unwrap()
        .decision_changes
}

/// Each change's `(name, kind, listed)`.
fn kinds(changes: &[DecisionChange]) -> Vec<(&str, &str, bool)> {
    changes
        .iter()
        .map(|change| (change.name.as_str(), change.kind.as_str(), change.listed))
        .collect()
}

/// A change's parts, `(section, kind)`.
fn part_kinds(change: &DecisionChange) -> Vec<(String, String)> {
    parts(change)
        .into_iter()
        .map(|(section, kind, _)| (section, kind))
        .collect()
}

fn owned(parts: &[(&str, &str)]) -> Vec<(String, String)> {
    parts
        .iter()
        .map(|(section, kind)| (section.to_string(), kind.to_string()))
        .collect()
}

#[test]
fn a_branch_shows_its_new_changed_and_removed_decisions() {
    let repo = repo(&[]);
    on_branch(
        &repo,
        &[
            (
                &path("a"),
                Some(decision(
                    "a",
                    "Tasks stay local.",
                    "Tasks MUST sync hourly.",
                )),
            ),
            (&path("b"), None),
            (
                &path("d"),
                Some(decision("d", "Lists are shared.", "Lists MAY be shared.")),
            ),
        ],
    );

    let changes = changes(&repo);

    assert_eq!(
        kinds(&changes),
        [
            ("a", "changed", false),
            ("b", "removed", false),
            ("d", "new", false)
        ]
    );
    assert!(changes.iter().all(|change| change.compared));
}

#[test]
fn a_change_on_main_after_the_branch_started_is_not_the_branchs() {
    let repo = repo(&[]);
    on_branch(
        &repo,
        &[(
            &path("a"),
            Some(decision(
                "a",
                "Tasks stay local.",
                "Tasks MUST sync hourly.",
            )),
        )],
    );
    repo.write(
        &path("a"),
        &decision("a", "Tasks stay on the device.", "Tasks MUST sync."),
    );
    repo.write(
        &path("c"),
        &decision("c", "Tasks stay local.", "Tasks MUST NOT sync."),
    );
    repo.commit("main moves on");

    let changes = changes(&repo);

    assert_eq!(kinds(&changes), [("a", "changed", false)]);
    assert_eq!(
        part_kinds(&changes[0]),
        owned(&[("", "kept"), ("Rules", "changed")])
    );
}

#[test]
fn merging_main_in_moves_the_comparison() {
    let repo = repo(&[]);
    on_branch(
        &repo,
        &[(
            &path("a"),
            Some(decision(
                "a",
                "Tasks stay local.",
                "Tasks MUST sync hourly.",
            )),
        )],
    );
    repo.write(
        &path("a"),
        &decision("a", "Tasks stay on the device.", "Tasks MUST sync."),
    );
    repo.write(
        &path("c"),
        &decision("c", "Tasks stay local.", "Tasks MUST NOT sync."),
    );
    repo.commit("main moves on");
    assert_eq!(kinds(&changes(&repo)), [("a", "changed", false)]);

    repo.switch(FOLDER);
    repo.git(&["merge", "--quiet", "--no-verify", "--no-edit", "main"]);
    repo.switch("main");
    let changes = changes(&repo);

    assert_eq!(kinds(&changes), [("a", "changed", false)]);
    assert_eq!(
        part_kinds(&changes[0]),
        owned(&[("", "kept"), ("Rules", "changed")])
    );
}

#[test]
fn a_listed_decision_equal_to_main_shows_no_change() {
    let repo = repo(&["c"]);

    let changes = changes(&repo);

    assert_eq!(kinds(&changes), [("c", "changed", true)]);
    assert_eq!(
        part_kinds(&changes[0]),
        owned(&[("", "kept"), ("Rules", "kept")])
    );
}

#[test]
fn an_unlisted_change_is_not_listed() {
    let repo = repo(&["c", "a"]);
    on_branch(
        &repo,
        &[
            (
                &path("a"),
                Some(decision(
                    "a",
                    "Tasks stay local.",
                    "Tasks MUST sync hourly.",
                )),
            ),
            (
                &path("b"),
                Some(decision("b", "Tasks stay local.", "Tasks SHOULD sync.")),
            ),
            (
                &path("c"),
                Some(decision("c", "Tasks stay local.", "Tasks MAY sync.")),
            ),
        ],
    );

    assert_eq!(
        kinds(&changes(&repo)),
        [
            ("c", "changed", true),
            ("a", "changed", true),
            ("b", "changed", false)
        ]
    );
}

#[test]
fn a_rewrap_alone_is_no_change() {
    let repo = repo(&[]);
    let rewrapped = decision("a", "Tasks stay local.", "Tasks MUST sync.")
        .replace("Tasks stay local.", "Tasks stay\nlocal.");
    on_branch(&repo, &[(&path("a"), Some(rewrapped))]);

    assert_eq!(kinds(&changes(&repo)), []);
}

#[test]
fn a_renamed_decision_is_removed_and_new() {
    let repo = repo(&[]);
    repo.switch(FOLDER);
    repo.git(&["mv", &path("a"), &path("e")]);
    repo.commit("rename");
    repo.switch("main");

    let changes = changes(&repo);

    assert_eq!(
        kinds(&changes),
        [("a", "removed", false), ("e", "new", false)]
    );
    assert!(changes.iter().all(|change| change.compared));
}

#[test]
fn without_a_merge_base_the_branchs_text_shows_uncompared() {
    let repo = repo(&[]);
    repo.git(&["branch", "--quiet", "-D", FOLDER]);
    repo.git(&["switch", "--quiet", "--orphan", FOLDER]);
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        &path("a"),
        &decision("a", "Tasks stay local.", "Tasks MUST sync."),
    );
    repo.write(SPEC, &listing(&[]));
    repo.commit("an unrelated history");
    repo.switch("main");

    let changes = changes(&repo);

    assert_eq!(kinds(&changes), [("a", "new", false)]);
    assert!(!changes[0].compared);
    assert_eq!(
        part_kinds(&changes[0]),
        owned(&[("", "added"), ("Rules", "added")])
    );
}

#[test]
fn a_decision_unreadable_at_the_merge_base_shows_uncompared() {
    let repo = repo(&[]);
    std::fs::write(repo.path().join(path("b")), b"# b\n\nNot UTF-8: \xff\n").unwrap();
    repo.commit("an unreadable decision");
    repo.git(&["branch", "--quiet", "--force", FOLDER, "main"]);
    repo.switch(FOLDER);
    repo.write(SPEC, &listing(&[]));
    repo.write(
        &path("b"),
        &decision("b", "Tasks stay local.", "Tasks MUST sync."),
    );
    repo.commit("spec");
    repo.switch("main");

    let changes = changes(&repo);

    assert_eq!(kinds(&changes), [("b", "new", false)]);
    assert!(!changes[0].compared);
    assert_eq!(
        part_kinds(&changes[0]),
        owned(&[("", "added"), ("Rules", "added")])
    );
}

#[test]
fn the_branch_is_read_from_its_checkout() {
    let repo = repo(&[]);
    repo.switch(FOLDER);
    repo.write(
        &path("a"),
        &decision("a", "Tasks stay local.", "Tasks MUST sync hourly."),
    );

    assert_eq!(kinds(&changes(&repo)), [("a", "changed", false)]);
}

#[test]
fn only_a_spec_has_decision_changes() {
    let repo = repo(&[]);
    on_branch(
        &repo,
        &[(
            &path("a"),
            Some(decision(
                "a",
                "Tasks stay local.",
                "Tasks MUST sync hourly.",
            )),
        )],
    );

    repo.add_on_branch(
        FOLDER,
        "specs/2026-10-11-web-ui/proposal.md",
        "# Proposal\n",
    );
    let view = api::read_file(repo.path(), FOLDER, "proposal.md").unwrap();
    assert!(view.decision_changes.is_empty());
}

#[test]
fn a_decision_reads_as_the_branch_has_it() {
    let repo = repo(&["a"]);
    on_branch(
        &repo,
        &[
            (
                &path("a"),
                Some(decision(
                    "a",
                    "Tasks stay local.",
                    "Tasks MUST sync hourly.",
                )),
            ),
            (&path("b"), None),
        ],
    );

    let read = api::read_decision(repo.path(), FOLDER, "a").unwrap();

    assert_eq!((read.name.as_str(), read.folder.as_str()), ("a", FOLDER));
    assert_eq!(
        (
            read.change.kind.as_str(),
            read.change.listed,
            read.change.compared
        ),
        ("changed", true, true)
    );
    assert_eq!(
        part_kinds(&read.change),
        owned(&[("", "kept"), ("Rules", "changed")])
    );
    let rule = read.document.blocks.last().unwrap();
    assert_eq!(rule.start_line, 12);
    let unchanged = api::read_decision(repo.path(), FOLDER, "c").unwrap();
    assert_eq!(
        part_kinds(&unchanged.change),
        owned(&[("", "kept"), ("Rules", "kept")])
    );
    let error = api::read_decision(repo.path(), FOLDER, "b").unwrap_err();
    assert_eq!(error.message, format!("{FOLDER} has no decision b"));
    let error = api::read_decision(repo.path(), FOLDER, "../decisions/a").unwrap_err();
    assert_eq!(error.code, "refused");
}
