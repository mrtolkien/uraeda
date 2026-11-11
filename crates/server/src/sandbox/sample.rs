//! The sample project: the fixture repository's todo app, with a feature at every step of the
//! workflow and a change at each of its states, as the Node sandbox's builders made it
//! (`packages/web/samples/`), and an `origin` with a commit to pull and one to push.

use std::path::Path;

use super::fixture;
use super::git::{Commit, Files, Repo, copy, sorted, text};
use super::origin::{merge_main, origin};
use super::texts::{
    at, bytes, code, finish, first_stages, lines, plan, proposal, record, recurring, slug_of, spec,
    with_status,
};

/// The folders of the feature page's features, and of the steps' features that share them.
pub(super) mod folders {
    /// At implementation, task 7 of 11 current: the agent builds.
    pub const WORKING: &str = "2026-10-17-redesign-clarifications";
    /// Its spec waiting for review.
    pub const WAITING: &str = "2026-10-17-recurring-reminders";
    /// Its spec approved, no agent working.
    pub const IDLE: &str = "2026-10-17-snooze-times";
    /// Its spec's status unreadable, "aproved": the workflow cannot go on.
    pub const BLOCKED: &str = "2026-10-17-due-dates";
    /// Finished on its branch, its pull request #31 open.
    pub const PULL_REQUEST: &str = "2026-10-17-keyboard-shortcuts";
    /// Merged by rebase, its record in place.
    pub const DONE: &str = "2026-10-17-redesign-rounds";
    /// A change merged by rebase.
    pub const DONE_CHANGE: &str = "2026-10-17-symlinks";
    /// Its plan's turn at work, which a workflow message starts.
    pub const DISCOVERY: &str = "2026-10-19-dark-mode";
    /// The round of the round page, its options showing SVG prototypes.
    pub const ROUND_MOCKUP: &str = "2026-10-17-round-mockup";
}

/// A step's feature: its folder, its title, and how far its commits go.
struct Step {
    folder: &'static str,
    title: &'static str,
    upto: Upto,
}

/// How far a step's feature goes.
#[derive(Clone, Copy)]
enum Upto {
    Proposal,
    Round,
    SpecRevision,
    Approval,
    Plan,
    PlanWaiting,
    PlanRevision,
    Built,
}

/// The steps' features, as `steps.ts` builds them, each on its branch from `main`.
const STEPS: [Step; 11] = [
    Step {
        folder: folders::DISCOVERY,
        title: "Dark mode",
        upto: Upto::Proposal,
    },
    Step {
        folder: "2026-10-19-csv-export",
        title: "CSV export",
        upto: Upto::Round,
    },
    Step {
        folder: "2026-10-19-share-links",
        title: "Share links",
        upto: Upto::SpecRevision,
    },
    Step {
        folder: "2026-10-19-tags",
        title: "Tags",
        upto: Upto::Approval,
    },
    Step {
        folder: "2026-10-19-search",
        title: "Search",
        upto: Upto::Plan,
    },
    Step {
        folder: "2026-10-19-notifications",
        title: "Notifications",
        upto: Upto::PlanWaiting,
    },
    Step {
        folder: "2026-10-19-undo",
        title: "Undo",
        upto: Upto::PlanRevision,
    },
    Step {
        folder: "2026-10-18-archive",
        title: "Archive",
        upto: Upto::Built,
    },
    Step {
        folder: "2026-10-18-themes",
        title: "Themes",
        upto: Upto::Built,
    },
    Step {
        folder: "2026-10-18-bulk-edit",
        title: "Bulk edit",
        upto: Upto::Built,
    },
    Step {
        folder: "2026-10-18-offline",
        title: "Offline mode",
        upto: Upto::Built,
    },
];

/// A new decision the spec of the approval's feature lists, proposed: the human approves it.
const PROPOSED_DECISION: &str = "---\nstatus: proposed\napproved-by:\nicon: repeat\n---\n\n# \
     Repeating tasks\n\nA repeating task is one task, whose due date moves when it is \
     completed.\n\n## Rules\n\n- A repeating task MUST stay one task. Checked by review.\n\n## \
     Why\n\nOne task keeps its history in one place.\n";

/// The changes, one at each state: at work, a round waiting, and four with pull requests.
const CHANGES: [(&str, &str); 6] = [
    ("2026-10-19-sort-order", "Sort order"),
    ("2026-10-19-date-format", "Date format"),
    ("2026-10-18-loading-state", "Loading state"),
    ("2026-10-18-empty-state", "Empty state"),
    ("2026-10-18-retry-button", "Retry button"),
    ("2026-10-18-error-copy", "Error copy"),
];

/// The open pull requests the sandbox's `gh` lists: branch, number, draft, changes requested.
pub(super) const PULL_REQUESTS: [(&str, u32, bool, bool); 8] = [
    (folders::PULL_REQUEST, 31, false, false),
    ("2026-10-18-bulk-edit", 32, false, false),
    ("2026-10-18-themes", 33, true, false),
    ("2026-10-18-offline", 34, false, true),
    ("change/2026-10-18-empty-state", 35, false, false),
    ("change/2026-10-18-retry-button", 38, false, false),
    ("change/2026-10-18-loading-state", 36, true, false),
    ("change/2026-10-18-error-copy", 37, false, true),
];

/// Builds the sample project in `path`.
pub(super) fn build(path: &Path) -> Result<(), String> {
    let repo = Repo::init(path)?;
    copy(&fixture("repo/main"), path)?;
    repo.commit_all("chore: specs")?;
    for branch in sorted(&fixture("repo/branches"))? {
        let name = branch
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        repo.git(&["switch", "--quiet", "--create", name, "main"])?;
        copy(&branch, path)?;
        repo.commit_all(&format!("work on {name}"))?;
        repo.git(&["switch", "--quiet", "main"])?;
    }
    feature_pages(&repo)?;
    for step in &STEPS {
        repo.branch(step.folder, "main")?;
        repo.commits(step.folder, commits_upto(step)?)?;
    }
    changes(&repo)?;
    round_mockup(&repo)?;
    repo.worktree(folders::WORKING)?;
    // The pull requests waiting on review hold main's tip; those that catch up lack it.
    let decisions = ["code-quality.md", "testing.md"].map(|name| {
        let path = format!("specs/decisions/{name}");
        bytes(&format!("realistic/decisions/{name}")).map(|bytes| (path, Some(bytes)))
    });
    let decisions: Files = decisions.into_iter().collect::<Result<_, _>>()?;
    let message = "docs: code-quality and testing decisions";
    repo.commits("main", vec![Commit::new(message, None, decisions)])?;
    for branch in [folders::PULL_REQUEST, "change/2026-10-18-empty-state"] {
        merge_main(&repo, branch)?;
    }
    origin(&repo)
}

/// The feature page's features: at work, gated, finished, and done.
fn feature_pages(repo: &Repo) -> Result<(), String> {
    repo.branch(folders::WORKING, "main")?;
    let mut working = first_stages(folders::WORKING, "Redesign clarifications", true)?;
    let message = "feat(redesign-clarifications): question cards";
    working.push(Commit::new(
        message,
        at("17 15:08"),
        code("clarifications", None),
    ));
    repo.commits(folders::WORKING, working)?;
    for (folder, title, status) in [
        (folders::WAITING, "Recurring reminders", "awaiting-human"),
        (folders::IDLE, "Snooze times", "approved"),
        (folders::BLOCKED, "Due dates", "aproved"),
    ] {
        repo.branch(folder, "main")?;
        let mut stages = first_stages(folder, title, false)?;
        stages.truncate(2);
        let spec_at = at("17 12:11");
        let path = format!("specs/{folder}/spec.md");
        let message = format!("spec({}): the spec", slug_of(folder));
        stages.push(Commit::new(
            message,
            spec_at,
            vec![text(path, spec(status)?)],
        ));
        repo.commits(folder, stages)?;
    }
    repo.branch(folders::PULL_REQUEST, "main")?;
    let title = "Keyboard shortcuts";
    let mut finished = first_stages(folders::PULL_REQUEST, title, true)?;
    let message = "feat(keyboard-shortcuts): the keys";
    finished.push(Commit::new(
        message,
        at("17 15:20"),
        code("shortcuts", None),
    ));
    let record_text = record("feature", title, 7, "2026-10-18");
    finished.push(finish(folders::PULL_REQUEST, record_text, at("18 09:10")));
    repo.commits(folders::PULL_REQUEST, finished)?;
    done(repo)
}

/// The done feature and the done change, merged by rebase onto `main`.
fn done(repo: &Repo) -> Result<(), String> {
    let title = "Redesign rounds";
    let old = "src/rounds/old.ts";
    let mut commits = vec![Commit::new(
        "chore: old rounds",
        at("16 12:00"),
        vec![text(old, lines(310, "old"))],
    )];
    commits.extend(first_stages(folders::DONE, title, true)?);
    let built = "feat(redesign-rounds): question cards";
    commits.push(Commit::new(
        built,
        at("18 09:10"),
        code("rounds", Some(old)),
    ));
    let fixed = vec![text("src/rounds/part-0.ts", lines(70, "card"))];
    commits.push(Commit::new(
        "fix(redesign-rounds): the card's edge",
        at("18 14:30"),
        fixed,
    ));
    let mut finished = finish(
        folders::DONE,
        record("feature", title, 10, "2026-10-18"),
        at("18 16:05"),
    );
    finished.committed = at("18 16:11");
    commits.push(finished);
    let path = format!("specs/changes/{}", folders::DONE_CHANGE);
    let slug = slug_of(folders::DONE_CHANGE);
    commits.push(Commit::new(
        format!("proposal({slug}): symlinks"),
        at("17 15:40"),
        vec![text(format!("{path}/proposal.md"), proposal("Symlinks"))],
    ));
    commits.push(Commit::new(
        format!("fix({slug}): link the ignored folders"),
        at("17 15:44"),
        vec![text("src/worktree/links.ts", lines(487, "link"))],
    ));
    let mut record_commit = Commit::new(
        format!("finish({slug}): the record"),
        at("17 16:06"),
        vec![
            (format!("{path}/proposal.md"), None),
            text(
                format!("specs/done/{}.md", folders::DONE_CHANGE),
                record("change", "Symlinks", 0, "2026-10-17"),
            ),
        ],
    );
    record_commit.committed = at("17 16:13");
    commits.push(record_commit);
    repo.commits("main", commits)
}

/// A step's feature's commits, each adding what the one before it waits on.
fn commits_upto(step: &Step) -> Result<Vec<Commit>, String> {
    let (folder, title) = (step.folder, step.title);
    let path = format!("specs/{folder}");
    let slug = slug_of(folder);
    let stage = |kind: &str, what: &str, time: &str, name: &str, body: String| {
        let message = format!("{kind}({slug}): {what}");
        Commit::new(
            message,
            at(time),
            vec![text(format!("{path}/{name}"), body)],
        )
    };
    let mut commits = vec![stage(
        "proposal",
        title,
        "18 10:52",
        "proposal.md",
        proposal(title),
    )];
    if matches!(step.upto, Upto::Proposal) {
        return Ok(commits);
    }
    let round = recurring("clarifications-01.md")?;
    commits.push(stage(
        "discovery",
        "round 01",
        "18 11:18",
        "clarifications-01.md",
        round,
    ));
    let (spec_status, plan_state) = match step.upto {
        Upto::Proposal | Upto::Round => return Ok(commits),
        Upto::SpecRevision => ("changes-requested", None),
        Upto::Approval | Upto::Plan => ("approved", None),
        Upto::PlanWaiting => ("approved", Some((0, "awaiting-human"))),
        Upto::PlanRevision => ("approved", Some((0, "changes-requested"))),
        Upto::Built => ("approved", Some((11, "approved"))),
    };
    commits.push(stage(
        "spec",
        "the spec",
        "18 12:11",
        "spec.md",
        spec(spec_status)?,
    ));
    if matches!(step.upto, Upto::Approval) {
        let decision = PROPOSED_DECISION;
        let path = "specs/decisions/repeating-tasks.md";
        let message = "decision(tags): Repeating tasks";
        commits.push(Commit::new(
            message,
            at("18 12:30"),
            vec![text(path, decision)],
        ));
    }
    if let Some((done, status)) = plan_state {
        commits.push(stage(
            "plan",
            "the plan",
            "18 15:05",
            "plan.md",
            plan(done, status),
        ));
    }
    if matches!(step.upto, Upto::Built) {
        let code = vec![text(
            format!("src/{slug}/index.ts"),
            "export const built = true;\n",
        )];
        commits.push(Commit::new(
            format!("feat({slug}): the code"),
            at("18 15:20"),
            code,
        ));
    }
    Ok(commits)
}

/// The changes, each on its branch `change/<folder>`: the second with a round waiting.
fn changes(repo: &Repo) -> Result<(), String> {
    for (index, (folder, title)) in CHANGES.iter().enumerate() {
        let branch = format!("change/{folder}");
        repo.branch(&branch, "main")?;
        let path = format!("specs/changes/{folder}");
        let mut files = vec![text(format!("{path}/proposal.md"), proposal(title))];
        if index == 1 {
            let round = with_status(&recurring("clarifications-01.md")?, "awaiting-human");
            files.push(text(format!("{path}/clarifications-01.md"), round));
        }
        repo.commits(
            &branch,
            vec![Commit::new(format!("work on {branch}"), None, files)],
        )?;
    }
    Ok(())
}

/// The round page's feature: its Q1 answered B, and the SVG prototypes its options show.
fn round_mockup(repo: &Repo) -> Result<(), String> {
    let folder = folders::ROUND_MOCKUP;
    repo.branch(folder, "main")?;
    let round = String::from_utf8_lossy(&bytes("round-mockup/clarifications-01.md")?).replacen(
        "**Answer:**\n",
        "**Answer:** B\n",
        1,
    );
    let mut files = vec![text(format!("specs/{folder}/clarifications-01.md"), round)];
    for name in [
        "mockups/moved-date.svg",
        "mockups/new-task.svg",
        "proposal.md",
    ] {
        let file = bytes(&format!("round-mockup/{name}"))?;
        files.push((format!("specs/{folder}/{name}"), Some(file)));
    }
    repo.commits(
        folder,
        vec![Commit::new(format!("work on {folder}"), None, files)],
    )
}
