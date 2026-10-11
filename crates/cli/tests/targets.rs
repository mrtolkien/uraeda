mod common;

use common::*;

fn two_features() -> TestRepo {
    let repo = TestRepo::new();
    specs(
        &repo,
        "# Priorities\n\n## Now\n\n## Next\n\n## Later\n\n## Blocked\n",
    );
    for folder in ["2026-10-10-web-ui", "2026-10-12-web-editing"] {
        feature(
            &repo,
            folder,
            &[
                ("proposal.md", proposal()),
                (
                    "clarifications-01.md",
                    clarifications("awaiting-human", "1 question, about 3 minutes.", &[""]),
                ),
            ],
        );
    }
    repo
}

#[test]
fn a_path_from_a_subfolder() {
    let repo = two_features();
    repo.write("crates/a.txt", "a\n");
    repo.commit("crates");

    let output = ura_in(
        &repo.path().join("crates"),
        &["next", "../specs/2026-10-10-web-ui"],
        &[],
    );

    assert!(
        output.stdout.starts_with("2026-10-10-web-ui: "),
        "{}",
        output.stderr
    );
}

#[test]
fn a_name_matching_two_items() {
    let repo = two_features();

    let output = ura(&repo, &["next", "web"]);

    assert_eq!(
        output.stderr,
        "ura: web matches 2 items: 2026-10-10-web-ui, 2026-10-12-web-editing\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn slug_and_folder_name_are_equivalent() {
    let repo = two_features();

    let by_slug = ura(&repo, &["next", "web-ui"]);
    let by_folder = ura(&repo, &["next", "2026-10-10-web-ui"]);

    assert_eq!(by_slug.stdout, by_folder.stdout);
}

#[test]
fn no_target_uses_the_current_branch() {
    let repo = two_features();
    repo.switch("2026-10-12-web-editing");

    let output = ura(&repo, &["answer", "Q1", "A"]);

    assert!(
        output
            .stdout
            .starts_with("Q1 answered in specs/2026-10-12-web-editing/"),
        "{}",
        output.stderr
    );
}

#[test]
fn no_target_with_two_waiting() {
    let repo = two_features();

    let output = ura(&repo, &["answer", "--submit"]);

    assert_eq!(
        output.stderr,
        "ura: several items wait: name one of 2026-10-10-web-ui, 2026-10-12-web-editing\n"
    );
    assert_eq!(output.code, 1);
}

#[test]
fn unknown_name() {
    let repo = two_features();

    let output = ura(&repo, &["next", "nothing"]);

    assert_eq!(output.stderr, "ura: no feature or draft named nothing\n");
}

#[test]
fn check_takes_a_name() {
    let repo = two_features();
    repo.switch("2026-10-10-web-ui");

    let output = ura(&repo, &["check", "web-ui"]);

    assert!(
        output.stdout.starts_with("specs/2026-10-10-web-ui"),
        "{}",
        output.stdout
    );
}
