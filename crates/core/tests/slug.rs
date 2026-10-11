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
