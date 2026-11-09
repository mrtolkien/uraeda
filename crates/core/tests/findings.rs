mod common;

use common::repo::TestRepo;
use common::texts::{clarifications, proposal, spec};
use uraeda_core::api::{self, Findings, FindingsSection};
use uraeda_core::check;

const FOLDER: &str = "2026-10-11-web-ui";
const WORKTREE: &str = ".worktrees/2026-10-11-web-ui";

/// A feature on its branch, checked out in its worktree, with the findings of its first wave.
fn feature() -> TestRepo {
    let repo = TestRepo::new();
    repo.write("specs/README.md", "# Specs\n");
    repo.write("specs/PRIORITIES.md", "# Priorities\n\n## Now\n");
    repo.git(&["add", "specs"]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "chore: specs"]);
    repo.switch_new(FOLDER);
    let folder = format!("specs/{FOLDER}");
    repo.write(&format!("{folder}/proposal.md"), &proposal());
    repo.write(
        &format!("{folder}/clarifications-01.md"),
        &clarifications("answered", "Answered.", &["A"]),
    );
    repo.write(&format!("{folder}/spec.md"), &spec("approved", 1, 1));
    repo.write(
        &format!("{folder}/findings-01.md"),
        "---\nreviewed: wave 1\ncommits: 111..222\n---\n\n# Findings: Feature, wave 1\n\n\
         ## Claude Code · Opus\n\n- Nothing found.\n",
    );
    repo.write("src/app.ts", "export const app = 1;\n");
    repo.git(&["add", "."]);
    repo.git(&["commit", "--quiet", "--no-verify", "-m", "feature"]);
    repo.switch("main");
    repo.git(&["worktree", "add", "--quiet", WORKTREE, FOLDER]);
    repo
}

/// Review focus 8: the findings are numbered after the highest round, and their commit takes only
/// their file, whatever else the feature's worktree holds.
#[test]
fn writes_and_commits_only_the_findings() {
    let repo = feature();
    repo.write(&format!("{WORKTREE}/src/app.ts"), "export const app = 2;\n");
    let findings = Findings {
        reviewed: "wave 2".into(),
        commits: "abc..def".into(),
        sections: vec![
            FindingsSection {
                reviewer: "Claude Code · Opus".into(),
                text: "- **Important**: the undo is lost after a reload.\n".into(),
            },
            FindingsSection {
                reviewer: "Codex · GPT-6.1-Sol".into(),
                // A reviewer's own headings stay inside its section.
                text:
                    "- **Minor**: a name reads oddly.\n\n## Summary\n\n# Verdict\n\n#### Kept\n\n\
                       ```md\n## In a fence\n```"
                        .into(),
            },
        ],
    };

    let path = api::write_findings(repo.path(), FOLDER, &findings).unwrap();

    let expected = format!("specs/{FOLDER}/findings-02.md");
    assert_eq!(path, expected);
    assert_eq!(
        repo.read(&format!("{WORKTREE}/{expected}")),
        "---\nreviewed: wave 2\ncommits: abc..def\n---\n\n# Findings: Feature, wave 2\n\n\
         ## Claude Code · Opus\n\n- **Important**: the undo is lost after a reload.\n\n\
         ## Codex · GPT-6.1-Sol\n\n- **Minor**: a name reads oddly.\n\n### Summary\n\n### Verdict\n\n\
         #### Kept\n\n```md\n## In a fence\n```\n"
    );
    assert_eq!(repo.subjects(FOLDER)[0], "review(web-ui): findings 02");
    assert_eq!(repo.changed_in(FOLDER), [expected.as_str()]);
    let status = repo.git(&["-C", WORKTREE, "status", "--porcelain"]);
    assert_eq!(status, " M src/app.ts\n");
    let worktree = repo.path().join(WORKTREE);
    let problems = check::check(&worktree, &worktree.join(&expected)).unwrap();
    assert_eq!(problems, [], "{problems:?}");

    // With the first round removed, the next is numbered after the highest round, not the count.
    repo.git(&[
        "-C",
        WORKTREE,
        "rm",
        "--quiet",
        &format!("specs/{FOLDER}/findings-01.md"),
    ]);
    repo.git(&[
        "-C",
        WORKTREE,
        "commit",
        "--quiet",
        "--no-verify",
        "-m",
        "remove",
    ]);
    let branch = Findings {
        reviewed: "branch".into(),
        ..findings
    };

    let path = api::write_findings(repo.path(), FOLDER, &branch).unwrap();

    assert_eq!(path, format!("specs/{FOLDER}/findings-03.md"));
    let text = repo.read(&format!("{WORKTREE}/{path}"));
    assert!(text.contains("# Findings: Feature, the branch\n"), "{text}");
}

#[test]
fn refuses_findings_with_a_wrong_frontmatter() {
    let repo = feature();
    let wrong_part = "a review's findings review the branch or a wave, like wave 2";
    let wrong_commits = "a review's findings name their commits on one line, like abc..def";
    let rows: [(&str, &str, &str); 6] = [
        ("wave", "abc..def", wrong_part),
        ("wave two", "abc..def", wrong_part),
        ("the branch", "abc..def", wrong_part),
        ("wave 2", " ", wrong_commits),
        ("wave 2", "abc..def\nstatus: approved", wrong_commits),
        ("branch", "a: b", wrong_commits),
    ];
    for (reviewed, commits, message) in rows {
        let findings = Findings {
            reviewed: reviewed.into(),
            commits: commits.into(),
            sections: vec![FindingsSection {
                reviewer: "Claude Code · Opus".into(),
                text: "- Nothing found.".into(),
            }],
        };

        let error = api::write_findings(repo.path(), FOLDER, &findings).unwrap_err();

        assert_eq!(
            (error.code, error.message.as_str()),
            ("refused", message),
            "for {reviewed:?} and {commits:?}"
        );
    }
    assert_eq!(repo.subjects(FOLDER)[0], "feature");
}

/// Findings a hook refused are committed again alone: the images of the feature's folder stay out.
#[test]
fn try_again_commits_only_the_findings() {
    let repo = feature();
    let image = format!("{WORKTREE}/specs/{FOLDER}/images/shot.webp");
    repo.write(&image, "shot");
    let findings = Findings {
        reviewed: "branch".into(),
        commits: "abc..def".into(),
        sections: vec![FindingsSection {
            reviewer: "Claude Code · Opus".into(),
            text: "- Nothing found.".into(),
        }],
    };
    repo.set_hook("exit 1");
    let refused = api::write_findings(repo.path(), FOLDER, &findings).unwrap_err();
    assert_eq!(refused.code, "hook");
    repo.set_hook("exit 0");

    let committed = api::retry_commit(repo.path(), FOLDER, "findings-02.md").unwrap();

    assert_eq!(committed.subject, "review(web-ui): findings 02");
    assert_eq!(
        repo.changed_in(FOLDER),
        [format!("specs/{FOLDER}/findings-02.md")]
    );
    assert!(repo.exists(&image));
}
