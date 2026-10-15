use uraeda_core::slug;

#[test]
fn slugs_from_text() {
    let cases = [
        ("Git listener process", "git-listener-process"),
        (
            "Ping user when input is needed",
            "ping-user-when-input-is-needed",
        ),
        ("?Slack integration?", "slack-integration"),
        ("CLI auto-expand in fish", "cli-auto-expand-in-fish"),
        (
            "Basic web UI for _viewing_ the workflow files -> React + Astryx + Fate stack",
            "basic-web-ui-for-viewing-the-workflow-files-react",
        ),
        ("Été à Paris", "été-à-paris"),
    ];
    for (text, expected) in cases {
        assert_eq!(slug::from_text(text), expected, "{text}");
    }
}

#[test]
fn short_slugs_keep_two_words_that_name_something() {
    let cases = [
        ("git-listener-process", "git-listener"),
        ("slack-integration", "slack-integration"),
        ("run-the-web-ui-with-npx", "run-web"),
        ("add-a-bugfixing-low-impact-change-flow", "add-bugfixing"),
        ("benchmarks", "benchmarks"),
        ("to-the", "to-the"),
    ];
    for (slug, expected) in cases {
        assert_eq!(slug::short(slug), expected, "{slug}");
    }
}

/// R1: a typed change's slug, proposed from its title as `ura start` does from a draft's name.
#[test]
fn a_title_proposes_the_short_slug_of_its_words() {
    let cases = [
        ("Centre the x in failure circles", "centre-x"),
        ("The header's logo", "header-s"),
        ("A home logo in the header", "home-logo"),
        ("  ", ""),
    ];
    for (title, expected) in cases {
        assert_eq!(slug::propose(title), expected, "{title}");
    }
}
