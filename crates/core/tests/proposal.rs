use uraeda_core::files::{frontmatter, proposal};

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
