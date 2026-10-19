//! What the UI reads: a feature's files as items, the review a revision answers, a checkout's
//! preview, and the slugs offered for new items.

use uraeda_core::api;
use uraeda_core::files::preview::Preview;
use uraeda_core::slug;

use crate::common::repo::TestRepo;
use crate::common::texts::spec;
use crate::support::{FOLDER, feature_repo};

#[test]
fn the_skills_example_reads_as_the_items_its_pages_show() {
    let repo = feature_repo(|_| {});

    let read = |name: &str| {
        api::read_file(repo.path(), FOLDER, name)
            .unwrap()
            .current
            .items
    };
    let round = read("clarifications-01.md")
        .clarifications
        .expect("a round");
    let spec = read("spec.md").spec.expect("a spec");
    let plan = read("plan.md").plan.expect("a plan");

    assert!(!round.questions.is_empty());
    assert!(round.questions.iter().all(|q| !q.options.is_empty()));
    assert!(!spec.stories.is_empty() && !spec.criteria.is_empty() && !spec.decisions.is_empty());
    assert!(!plan.tasks.is_empty() && plan.tasks.iter().all(|t| t.total > 0 && t.done <= t.total));
    assert!(
        read("rulings.md")
            .rulings
            .is_some_and(|rulings| !rulings.is_empty())
    );
    let feature = api::read_feature(repo.path(), FOLDER).unwrap();
    assert!(feature.files.len() >= 4, "the feature lists its files");
}

// A spec's revision keeps the comments of the review it answers, whatever its review file holds now.

const BRANCH: &str = "2026-10-10-feature";
const SPEC: &str = "specs/2026-10-10-feature/spec.md";
const REVIEW: &str = "specs/2026-10-10-feature/spec-review.md";

fn review(verdict: &str, comment: &str) -> String {
    format!(
        "---\nverdict: {verdict}\ncommit: a1b2c3d\n---\n\n# Review: Spec, Feature\n\n## C1: Line 13, under \"Spec: Feature\"\n\n> A feature.\n\n{comment}\n"
    )
}

fn answered(repo: &TestRepo) -> Option<Vec<String>> {
    repo.switch("main");
    api::read_file(repo.path(), BRANCH, "spec.md")
        .unwrap()
        .answered
        .map(|review| review.comments.into_iter().map(|c| c.text).collect())
}

#[test]
fn a_revision_keeps_the_review_it_answers_while_a_first_version_answers_none() {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.commit("chore: specs");
    repo.switch_new(BRANCH);
    repo.write(SPEC, &spec("awaiting-human", 1, 0));
    repo.write(REVIEW, &review("changes-requested", "Too vague."));
    repo.commit("docs(feature): the first spec and its review");
    assert_eq!(answered(&repo), None, "revision 1 answers no review");

    repo.switch(BRANCH);
    repo.write(SPEC, &spec("awaiting-human", 2, 0));
    repo.commit("docs(feature): revise the spec");
    repo.write(REVIEW, &review("pending", "On the revision."));
    repo.commit("docs(feature): review the revision");

    assert_eq!(answered(&repo), Some(vec!["Too vague.".to_string()]));
}

// A checkout has a preview only from its active decision, and each checkout has its own.

const PREVIEW: &str = "specs/decisions/preview.md";

fn preview_decision(status: &str, command: &str) -> String {
    format!(
        "---\nstatus: {status}\napproved-by: me\npreview-folder: packages/web\npreview-command: {command}\n---\n\n# Preview\n"
    )
}

#[test]
fn a_checkout_has_a_preview_only_from_its_active_decision_and_reads_its_own_copy() {
    let command = "pnpm exec storybook dev --port {port}";
    let rows: [(&str, Option<String>, Option<&str>); 4] = [
        (
            "active",
            Some(preview_decision("active", command)),
            Some(command),
        ),
        (
            "proposed",
            Some(preview_decision("proposed", command)),
            None,
        ),
        (
            "no {port}",
            Some(preview_decision("active", "pnpm exec storybook dev")),
            None,
        ),
        ("no file", None, None),
    ];
    for (case, text, expected) in rows {
        let repo = TestRepo::new();
        if let Some(text) = text {
            repo.write(PREVIEW, &text);
        }

        let found = api::preview(repo.path()).unwrap();

        let expected = expected.map(|command| Preview {
            folder: "packages/web".into(),
            command: command.into(),
        });
        assert_eq!(found, expected, "{case}");
    }

    let repo = TestRepo::new();
    repo.branch("2026-10-20-x");
    repo.add_on_branch(
        "2026-10-20-x",
        PREVIEW,
        &preview_decision("active", "x --port {port}"),
    );
    let worktree = repo.path().join(".worktrees/2026-10-20-x");
    repo.git(&[
        "worktree",
        "add",
        "--quiet",
        worktree.to_str().unwrap(),
        "2026-10-20-x",
    ]);
    assert!(api::preview(&worktree).unwrap().is_some());
    assert!(api::preview(repo.path()).unwrap().is_none());
    let before = api::checkout_commit(&worktree).unwrap();
    repo.git(&[
        "-C",
        worktree.to_str().unwrap(),
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "chore: a commit",
    ]);
    assert_ne!(
        api::checkout_commit(&worktree).unwrap(),
        before,
        "a commit moves the checkout's commit"
    );
}

#[test]
fn slugs_are_made_of_the_words_that_name_something() {
    let rows = [
        (
            "Git listener process",
            "git-listener-process",
            "git-listener",
        ),
        (
            "Run the web UI with npx",
            "run-the-web-ui-with-npx",
            "run-web",
        ),
        ("Été à Paris", "été-à-paris", "été-à"),
        (
            "?Slack integration?",
            "slack-integration",
            "slack-integration",
        ),
    ];
    for (text, slug_of, short) in rows {
        assert_eq!(slug::from_text(text), slug_of, "{text}");
        assert_eq!(slug::short(slug_of), short, "{text}");
    }
    assert_eq!(slug::propose("  "), "");
}
