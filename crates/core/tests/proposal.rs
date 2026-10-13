use uraeda_core::files::items::{TierChoice, items};
use uraeda_core::files::{document, frontmatter, proposal, spec};

/// US3.4: the plan waits for a review by default at a high tier, and the spec's own value holds
/// while the tier stays the one it proposes.
#[test]
fn the_plan_review_follows_the_tier_unless_the_spec_says_otherwise() {
    assert_eq!(spec::risk_tiers(), ["low", "medium", "high"]);
    for (proposed, current, chosen, expected) in [
        (Some("low"), None, Some("low"), false),
        (Some("low"), None, Some("high"), true),
        (Some("high"), None, Some("high"), true),
        (Some("low"), Some(true), Some("low"), true),
        (Some("low"), Some(true), Some("medium"), false),
        (Some("high"), Some(false), Some("high"), false),
        (None, None, Some("high"), true),
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
            choice("high", true)
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
