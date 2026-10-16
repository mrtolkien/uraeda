mod common;

use std::process::Command;

use common::repo::{TestRepo, without_user_git};
use common::repository_file;
use uraeda_core::api::{self, Decision};

const CONSTITUTION: &str = "specs/CONSTITUTION.md";

/// A decision with every field, its summary two sentences long.
const GIT: &str = "---\nstatus: active\napproved-by: mrtolkien\nicon: git-branch\n---\n\n# Git\n\n\
    Tools read git with gix, and write with the system binary. Commits run the user's hooks.\n\n\
    ## Rules\n\n- Tools MUST NOT bypass hooks. Checked by review.\n\n## Why\n\nHooks.\n\n\
    ## Consequences\n\n- None.\n\n## Applies to\n\n- `crates/`\n";

/// Commits every change, as committed on `date`.
fn commit_on(repo: &TestRepo, message: &str, date: &str) {
    repo.git(&["add", "--all"]);
    let output = without_user_git(
        Command::new("git")
            .args(["commit", "--quiet", "--no-verify", "--message", message])
            .env("GIT_COMMITTER_DATE", format!("{date}T12:00:00+00:00"))
            .current_dir(repo.path()),
    )
    .output()
    .unwrap();
    assert!(output.status.success(), "{output:?}");
}

fn decision<'a>(decisions: &'a [Decision], name: &str) -> &'a Decision {
    decisions
        .iter()
        .find(|decision| decision.name == name)
        .unwrap_or_else(|| panic!("no decision {name}"))
}

/// US8 scenario 1: this repository's constitution, its version line and its six principles.
#[test]
fn the_ledger_reads_the_constitution() {
    let repo = TestRepo::new();
    repo.write(CONSTITUTION, &repository_file(CONSTITUTION));
    repo.commit("docs: constitution");

    let constitution = api::read_ledger(repo.path())
        .unwrap()
        .constitution
        .expect("a constitution");

    assert_eq!(constitution.title, "Uraeda Constitution");
    assert_eq!(constitution.version.as_deref(), Some("1.3.1"));
    assert_eq!(constitution.ratified.as_deref(), Some("2026-10-07"));
    assert_eq!(constitution.amended.as_deref(), Some("2026-10-14"));
    let principles: Vec<(&str, &str, &str)> = constitution
        .principles
        .iter()
        .map(|p| (p.number.as_str(), p.slug.as_str(), p.title.as_str()))
        .collect();
    assert_eq!(
        principles,
        [
            ("I", "i", "Humans stay in control"),
            ("II", "ii", "Git and plain text first"),
            ("III", "iii", "Asynchronous by default"),
            ("IV", "iv", "Review effort matches impact"),
            ("V", "v", "Tools are optional"),
            ("VI", "vi", "Code is checked and stays maintainable"),
        ]
    );
    // A principle's blocks: its heading, its rules, and its rationale, up to the next principle.
    let iv = &constitution.principles[3];
    let texts: Vec<String> = iv
        .blocks
        .iter()
        .map(|&id| constitution.document.text(id))
        .collect();
    assert_eq!(texts[0], "IV. Review effort matches impact");
    assert!(
        texts
            .last()
            .unwrap()
            .starts_with("Rationale: human attention")
    );
    assert_eq!(texts.len(), 3, "{texts:?}");
}

/// US8 scenarios 1, 3, and 7: each decision's fields, and the date of the last commit touching it.
#[test]
fn the_ledger_reads_each_decision() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/git.md", GIT);
    commit_on(&repo, "decision: git", "2026-10-12");
    repo.write(
        "specs/decisions/toolchain.md",
        &GIT.replace("status: active", "status: proposed")
            .replace("approved-by: mrtolkien", "approved-by:")
            .replace("icon: git-branch\n", "")
            .replace("# Git", "# Toolchain"),
    );
    commit_on(&repo, "decision: toolchain", "2026-10-16");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let names: Vec<&str> = ledger.decisions.iter().map(|d| d.name.as_str()).collect();
    assert_eq!(names, ["git", "toolchain"]);
    let git = decision(&ledger.decisions, "git");
    assert_eq!(git.title, "Git");
    assert_eq!(git.status.as_deref(), Some("active"));
    assert_eq!(git.approved_by.as_deref(), Some("mrtolkien"));
    assert_eq!(git.icon.as_deref(), Some("git-branch"));
    assert_eq!(
        git.summary.as_deref(),
        Some("Tools read git with gix, and write with the system binary.")
    );
    assert_eq!(git.changed.as_deref(), Some("2026-10-12"));
    assert_eq!(git.problem, None);
    assert_eq!(git.document.blocks[0].kind.as_str(), "heading");
    let toolchain = decision(&ledger.decisions, "toolchain");
    assert_eq!(toolchain.status.as_deref(), Some("proposed"));
    assert_eq!(toolchain.approved_by, None);
    assert_eq!(toolchain.icon, None);
    assert_eq!(toolchain.changed.as_deref(), Some("2026-10-16"));
    assert!(ledger.problems.is_empty(), "{:?}", ledger.problems);
}

/// Edge case: a decision without an H1 or a summary stands under its file name, without subtitle.
#[test]
fn a_decision_without_a_title_uses_its_file_name() {
    let repo = TestRepo::new();
    repo.write(
        "specs/decisions/git.md",
        "---\nstatus: active\napproved-by: me\n---\n\n## Rules\n\n- A rule.\n",
    );
    repo.commit("decision: git");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let git = decision(&ledger.decisions, "git");
    assert_eq!(git.title, "git");
    assert_eq!(git.summary, None);
    assert_eq!(git.problem.as_deref(), Some("no title"));
}

/// Review focus 7: a decision that cannot be parsed is listed, with the check's first problem.
#[test]
fn an_unreadable_decision_names_its_problem() {
    let repo = TestRepo::new();
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace("status: active", "status: [active"),
    );
    repo.commit("decision: git");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let git = decision(&ledger.decisions, "git");
    assert_eq!(git.title, "Git");
    assert_eq!(git.status, None);
    let problem = git.problem.as_deref().expect("a problem");
    assert!(
        problem.starts_with("frontmatter is not valid YAML"),
        "{problem}"
    );
    assert!(
        ledger
            .problems
            .iter()
            .any(|p| p.file == "specs/decisions/git.md" && p.rule == "frontmatter.parse"),
        "{:?}",
        ledger.problems
    );
}

/// Edge cases: no decisions folder and no constitution.
#[test]
fn no_decisions_or_no_constitution() {
    let repo = TestRepo::new();

    let ledger = api::read_ledger(repo.path()).unwrap();

    assert!(ledger.decisions.is_empty());
    assert!(ledger.constitution.is_none());
}

/// The default branch's files, from its checkout: an edit shows before it is committed, and a
/// branch's own decisions do not.
#[test]
fn the_ledger_reads_the_default_branch() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/git.md", GIT);
    repo.commit("decision: git");
    repo.branch("2026-10-16-x");
    repo.add_on_branch("2026-10-16-x", "specs/decisions/stack.md", GIT);
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace("icon: git-branch", "icon: git-merge"),
    );

    let ledger = api::read_ledger(repo.path()).unwrap();

    let names: Vec<&str> = ledger.decisions.iter().map(|d| d.name.as_str()).collect();
    assert_eq!(names, ["git"]);
    assert_eq!(ledger.decisions[0].icon.as_deref(), Some("git-merge"));
}
