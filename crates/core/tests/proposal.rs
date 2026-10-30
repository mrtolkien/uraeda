mod common;

use common::repo::TestRepo;
use common::texts::proposal as feature_proposal;
use uraeda_core::api;
use uraeda_core::files::items::{TierChoice, items};
use uraeda_core::files::{document, frontmatter, proposal, spec};

/// US6: the plan never waits by default; the spec's own value holds while the tier stays the one it
/// proposes.
#[test]
fn the_plan_review_is_off_unless_the_spec_says_otherwise() {
    assert_eq!(spec::risk_tiers(), ["low", "medium", "high"]);
    for (proposed, current, chosen, expected) in [
        (Some("low"), None, Some("low"), false),
        (Some("medium"), Some(false), Some("high"), false), // US6.1, US6.2
        (Some("high"), None, Some("high"), false),
        (None, None, Some("high"), false),
        (Some("medium"), Some(true), Some("medium"), true), // US6.3
        (Some("low"), Some(true), Some("high"), false),
        (Some("low"), Some(true), Some("medium"), false),
        (Some("high"), Some(false), Some("high"), false),
    ] {
        assert_eq!(
            spec::plan_review_default(proposed, current, chosen),
            expected,
            "{proposed:?} {current:?} {chosen:?}"
        );
    }
}

#[test]
fn a_spec_lists_its_tiers_with_their_plan_review() {
    let text = "---\nstatus: awaiting-human\nrisk-tier: low\nplan-review: true\n---\n\n# Spec: X\n";
    let tiers = items("spec.md", text, &document::parse(text, "specs/x"))
        .spec
        .unwrap()
        .tiers;

    let choice = |value: &str, plan_review| TierChoice {
        value: value.to_string(),
        plan_review,
    };
    assert_eq!(
        tiers,
        [
            choice("low", true),
            choice("medium", false),
            choice("high", false)
        ]
    );
}

#[test]
fn setting_a_field_without_frontmatter_adds_one_then_a_blank_line() {
    assert_eq!(
        frontmatter::set("# X\n", "discovery", "low"),
        "---\ndiscovery: low\n---\n\n# X\n"
    );
    assert_eq!(
        frontmatter::set("---\n---\n# X\n", "discovery", "low"),
        "---\ndiscovery: low\n---\n# X\n"
    );
}

#[test]
fn a_proposal_asks_for_high_discovery_unless_it_names_a_level() {
    for (text, level) in [
        ("# X\n", "high"),
        ("---\nother: 1\n---\n# X\n", "high"),
        ("---\ndiscovery: deep\n---\n# X\n", "high"),
        ("---\ndiscovery: low # a comment\n---\n# X\n", "low"),
        ("---\ndiscovery: \"medium\"\n---\n# X\n", "medium"),
    ] {
        assert_eq!(proposal::discovery(text), level, "{text:?}");
    }
    assert_eq!(proposal::discovery_levels(), ["low", "medium", "high"]);
}

#[test]
fn setting_the_discovery_keeps_the_rest_and_refuses_other_levels() {
    assert_eq!(
        proposal::set_discovery("---\ndiscovery: high # how far\n---\n\n# X\n", "medium").unwrap(),
        "---\ndiscovery: medium # how far\n---\n\n# X\n"
    );
    assert_eq!(
        proposal::set_discovery("---\nother: 1\n---\n# X\n", "low").unwrap(),
        "---\nother: 1\ndiscovery: low\n---\n# X\n"
    );
    assert_eq!(
        proposal::set_discovery("# X\n", "deep").unwrap_err(),
        "discovery \"deep\" is not one of low, medium, high"
    );
}

#[test]
fn a_proposal_is_written_once_more_than_its_title_and_what_hold_text() {
    let template =
        "---\ndiscovery: high\n---\n\n# X\n\n## What\n\nA thing.\n\n## Why\n\n## Notes\n";
    assert!(!proposal::is_written(template));
    assert_eq!(proposal::empty_sections(template), ["Why", "Notes"]);

    let why = template.replace("## Why\n", "## Why\n\nBecause.\n");
    assert!(proposal::is_written(&why));
    assert_eq!(proposal::empty_sections(&why), ["Notes"]);

    // Text before the first section counts, and a heading in a code block is text.
    assert!(proposal::is_written("# X\n\nIntro.\n\n## What\n"));
    let fenced = "# X\n\n## What\n\n## Why\n\n```\n## Not a heading\n```\n";
    assert!(proposal::is_written(fenced));
    assert_eq!(proposal::empty_sections(fenced), ["What"]);
}

/// A `###` heading is part of the `## What` section: a note goes after its subsection, and is taken
/// back out of it. The section ends at the next `#` or `##` heading outside fenced code.
#[test]
fn the_what_section_holds_its_subsections() {
    let proposal_file = "# Dark mode\n\n## What\n\nA theme.\n\n### Details\n\nColors.\n\n```\n## not a heading\n```\n\n## Why\n\nEyes.\n";
    let note = ["- Night too".to_string()];

    let added = proposal::append_to_what(proposal_file, &note).unwrap();

    assert_eq!(
        added,
        "# Dark mode\n\n## What\n\nA theme.\n\n### Details\n\nColors.\n\n```\n## not a heading\n```\n\n- Night too\n\n## Why\n\nEyes.\n"
    );
    assert_eq!(
        proposal::without_item(&added, "Night too\n").as_deref(),
        Some(proposal_file)
    );
    let after_why = proposal_file.replace("Eyes.\n", "Eyes.\n\n- Night too\n");
    assert_eq!(proposal::without_item(&after_why, "Night too\n"), None);
}

/// US4 1: the New page's title, its line, its file, and its text, written in one call. A started
/// proposal stays above the new line, and one not started goes below it.
#[test]
fn a_drafted_proposal_writes_its_line_and_its_file_in_one_call() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write(
        "specs/PRIORITIES.md",
        "# Priorities\n\n## Now\n\n- [Web UI](/specs/2026-10-11-web-ui/proposal.md)\n- An idea\n",
    );
    repo.commit("chore: specs");
    repo.switch_new("2026-10-11-web-ui");
    repo.write("specs/2026-10-11-web-ui/proposal.md", &feature_proposal());
    repo.commit("discovery(web-ui): web UI");
    repo.switch("main");

    let file = api::draft_proposal(
        repo.path(),
        "now",
        "Performance pass",
        "Every page within 100 ms.",
    )
    .unwrap();

    assert_eq!(file.title, "Performance pass");
    assert!(
        file.text.trim_end().ends_with("Every page within 100 ms."),
        "{}",
        file.text
    );
    assert_eq!(repo.read(&file.path), file.text);
    let read = api::read_priorities(repo.path()).unwrap();
    let now: Vec<_> = read.sections[0]
        .proposals
        .iter()
        .map(|proposal| {
            (
                proposal.text.as_str(),
                proposal.file.as_ref().map(|f| &f.path),
            )
        })
        .collect();
    assert_eq!(now[1].1, Some(&file.path));
    assert!(now[1].0.contains("Performance pass"), "{}", now[1].0);
    assert_eq!(now[2].0, "An idea");
    assert_eq!(file.proposal.as_ref().map(|p| p.id.as_str()), Some("now-2"));
}

/// A refused draft takes its line back out, and leaves the file in its way as it was.
#[test]
fn a_refused_draft_leaves_the_priorities_and_the_folder_as_they_were() {
    let repo = TestRepo::new();
    let priorities = "# Priorities\n\n## Now\n\n- An idea\n";
    repo.write("specs/PRIORITIES.md", priorities);
    repo.write("specs/proposals/performance-pass.md", "# Mine\n");
    repo.commit("chore: specs");

    let refused = api::draft_proposal(repo.path(), "now", "Performance pass", "Fast.");

    assert_eq!(refused.unwrap_err().code, "refused");
    assert_eq!(repo.read("specs/PRIORITIES.md"), priorities);
    assert_eq!(repo.read("specs/proposals/performance-pass.md"), "# Mine\n");
}
