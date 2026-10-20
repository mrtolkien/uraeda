mod common;

use std::process::Command;

use common::repo::{TestRepo, without_user_git};
use uraeda_core::api::{self, Decision};

const CONSTITUTION: &str = "specs/CONSTITUTION.md";

/// A constitution in this repository's shape, fixed: amending the real one must not break the test.
const FIXED_CONSTITUTION: &str = "# Uraeda Constitution\n\n\
    Principles are listed by priority.\n\n## Core Principles\n\n\
    ### I. Humans stay in control\n\n- Agents MUST stay within the approved scope.\n\n\
    Rationale: agents must not decide alone.\n\n\
    ### II. Git and plain text first\n\n- State MUST be plain text in git.\n\n\
    Rationale: git gives history.\n\n\
    ### III. Asynchronous by default\n\n- Steps MUST end with a commit.\n\n\
    Rationale: work resumes anywhere.\n\n\
    ### IV. Review effort matches impact\n\n- Questions MUST carry a recommendation.\n\n\
    Rationale: human attention is the scarcest resource in the workflow.\n\n\
    ## Governance\n\n- Only humans amend this constitution.\n\n\
    **Version**: 1.3.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-14\n";

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

/// US8 scenario 1: a constitution's version line and its principles.
#[test]
fn the_ledger_reads_the_constitution() {
    let repo = TestRepo::new();
    repo.write(CONSTITUTION, FIXED_CONSTITUTION);
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
    assert!(!git.unreadable);
}

/// A readable decision with a problem `ura check` finds, like a broken link, keeps its title and
/// its summary: only a decision that cannot be parsed is unreadable.
#[test]
fn a_decision_with_a_broken_link_keeps_its_summary() {
    let repo = TestRepo::new();
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace("Hooks.\n", "Hooks, as [the hooks](missing.md) say.\n"),
    );
    repo.commit("decision: git");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let git = decision(&ledger.decisions, "git");
    assert!(git.problem.is_some(), "{:?}", ledger.problems);
    assert!(!git.unreadable);
    assert_eq!(git.title, "Git");
    assert_eq!(
        git.summary.as_deref(),
        Some("Tools read git with gix, and write with the system binary.")
    );
}

/// Review focus 7: a decision that cannot be parsed is listed, unreadable, by its file name, with
/// the check's first problem.
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
    assert!(git.unreadable);
    // Titled by its file name, even with an H1: nothing read from it stands as its own.
    assert_eq!(git.title, "git");
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

/// A repository whose default branch, `main`, links `target` from its `git` decision and is
/// checked out nowhere: the current checkout, `old`, branched before the decision existed.
fn default_checked_out_nowhere(target: &str) -> TestRepo {
    let repo = TestRepo::new();
    repo.write("README.md", "# Repo\n");
    repo.commit("chore: base");
    repo.branch("old");
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace(
            "Hooks.\n",
            &format!("Hooks, as [the hooks]({target}) say.\n"),
        ),
    );
    repo.commit("decision: git");
    repo.switch("old");
    repo
}

/// A link is checked against the default branch's tree, not the current checkout: a file its tip
/// has is there, though the checkout lacks it.
#[test]
fn a_link_to_a_file_of_the_default_branch_is_valid_from_another_checkout() {
    let repo = default_checked_out_nowhere("../../docs/hooks.md");
    repo.git(&["switch", "--quiet", "main"]);
    repo.write("docs/hooks.md", "# Hooks\n");
    repo.commit("docs: hooks");
    repo.switch("old");

    let ledger = api::read_ledger(repo.path()).unwrap();

    assert!(!repo.exists("docs/hooks.md"));
    assert_eq!(ledger.problems, [], "{:?}", ledger.problems);
    assert_eq!(decision(&ledger.decisions, "git").problem, None);
}

/// A file only the current checkout has does not make a link valid.
#[test]
fn a_link_to_a_file_only_the_checkout_has_is_broken() {
    let repo = default_checked_out_nowhere("../../docs/hooks.md");
    repo.write("docs/hooks.md", "# Hooks\n");
    repo.commit("docs: hooks");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let git = decision(&ledger.decisions, "git");
    assert_eq!(git.problem.as_deref(), Some("no file ../../docs/hooks.md"));
}

/// A decision's date is the last commit touching it, through a merge: a branch's edit of one
/// decision carries its own date, and the merge, which touches none, carries none.
#[test]
fn a_merged_decision_keeps_the_date_of_its_commit() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/git.md", GIT);
    commit_on(&repo, "decision: git", "2026-10-12");
    repo.write(
        "specs/decisions/toolchain.md",
        &GIT.replace("# Git", "# Toolchain"),
    );
    commit_on(&repo, "decision: toolchain", "2026-10-13");
    repo.switch_new("edit-git");
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace("icon: git-branch", "icon: git-merge"),
    );
    commit_on(&repo, "decision: git icon", "2026-10-15");
    repo.switch("main");
    repo.write(
        "specs/decisions/toolchain.md",
        &GIT.replace("# Git", "# Build"),
    );
    commit_on(&repo, "decision: toolchain title", "2026-10-16");
    let merged = without_user_git(
        Command::new("git")
            .args([
                "merge",
                "--quiet",
                "--no-ff",
                "--message",
                "merge",
                "edit-git",
            ])
            .env("GIT_COMMITTER_DATE", "2026-10-17T12:00:00+00:00")
            .current_dir(repo.path()),
    )
    .output()
    .unwrap();
    assert!(merged.status.success(), "{merged:?}");

    let ledger = api::read_ledger(repo.path()).unwrap();

    assert_eq!(
        decision(&ledger.decisions, "git").changed.as_deref(),
        Some("2026-10-15")
    );
    assert_eq!(
        decision(&ledger.decisions, "toolchain").changed.as_deref(),
        Some("2026-10-16")
    );
}

/// A decision whose file name has non-ASCII characters still gets its date.
#[test]
fn a_decision_with_a_non_ascii_name_has_its_date() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/café.md", GIT);
    commit_on(&repo, "decision: café", "2026-10-12");

    let ledger = api::read_ledger(repo.path()).unwrap();

    assert_eq!(
        decision(&ledger.decisions, "café").changed.as_deref(),
        Some("2026-10-12")
    );
}

/// US2: a decision's rules are the kept parts of its `## Rules` section, each with its strength,
/// its words, and its check.
#[test]
fn rules_of_a_decision_are_its_kept_parts_with_strength_and_check() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/git.md", GIT);
    repo.commit("decision: git");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let rules = &decision(&ledger.decisions, "git").rules;
    assert_eq!(rules.len(), 1, "{rules:?}");
    assert_eq!(rules[0].kind, "kept");
    assert_eq!(rules[0].strength.as_deref(), Some("must-not"));
    let words = |runs: &[uraeda_core::decisions::Run]| {
        runs.iter()
            .map(|run| run.text.as_str())
            .collect::<Vec<_>>()
            .join(" ")
    };
    assert_eq!(words(&rules[0].runs), "Tools MUST NOT bypass hooks.");
    assert_eq!(words(&rules[0].check), "Checked by review.");
}

/// Edge case: a decision that cannot be parsed has no rules, and keeps its problem.
#[test]
fn an_unreadable_decision_has_no_rules_and_keeps_its_problem() {
    let repo = TestRepo::new();
    repo.write(
        "specs/decisions/git.md",
        &GIT.replace("status: active", "status: [active"),
    );
    repo.commit("decision: git");

    let git = api::read_ledger(repo.path()).unwrap().decisions.remove(0);

    assert!(git.rules.is_empty());
    assert!(git.problem.is_some());
}

/// A candidate under `specs/decisions-check/` is not a decision of the ledger.
#[test]
fn files_under_decisions_check_are_not_in_the_ledger() {
    let repo = TestRepo::new();
    repo.write("specs/decisions/git.md", GIT);
    repo.write("specs/decisions-check/q1-a/git-extra.md", GIT);
    repo.commit("decision: git");

    let ledger = api::read_ledger(repo.path()).unwrap();

    let names: Vec<&str> = ledger.decisions.iter().map(|d| d.name.as_str()).collect();
    assert_eq!(names, ["git"]);
}
