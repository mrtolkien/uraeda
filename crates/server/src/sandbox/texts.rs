//! The texts the sample features are made of: proposals, specs, plans, records, and code, as the
//! Node sandbox's builders wrote them (`packages/web/samples/features.ts`).

use super::git::{Commit, Files, text};
use super::{fixture, fixture_text};

/// A UTC time of October 2026, `"17 10:52"` giving October 17 at 10:52.
pub(super) fn at(time: &str) -> Option<String> {
    Some(format!("2026-10-{}:00Z", time.replace(' ', "T")))
}

/// A folder's slug: its name without its date.
pub(super) fn slug_of(folder: &str) -> &str {
    folder.get(11..).unwrap_or(folder)
}

/// A proposal titled `title`.
pub(super) fn proposal(title: &str) -> String {
    format!(
        "# {title}\n\n## What\n\nRounds of questions read as a flat list.\n\n## Why\n\nThey take \
         too long to answer.\n"
    )
}

/// A file of the recurring tasks' feature in `fixtures/repo/`.
pub(super) fn recurring(name: &str) -> Result<String, String> {
    let folder = "2026-10-06-recurring-tasks";
    fixture_text(&format!("repo/branches/{folder}/specs/{folder}/{name}"))
}

/// The behaviour the sample spec replaces, between its stories and its architecture.
const REPLACED: &str = "## Replaced behaviour\n\n- **A completed task gets no next date.** \
     Guarded by `tests/tasks/complete-a-task.test.tsx`.\n- **A task repeats only on a fixed \
     interval.** Guarded by `tests/tasks/repeat-every-n-days.test.tsx`\n  and \
     `tests/tasks/repeat-end-of-month.test.tsx`.\n\n";

/// A diagram and code, which a spec's reader draws: a diagram's picture, and highlighting.
const SKETCH: &str = "## Flow\n\n```mermaid\nflowchart LR\n  done[Task completed] --> next{Repeats?}\n  \
     next -- yes --> date[Next date set]\n  next -- no --> archive[Archived]\n```\n\n```ts\n\
     export function nextDate(task: Task, today: Date): Date | undefined {\n  \
     return task.rule ? task.rule.after(today) : undefined;\n}\n```\n\n";

/// The recurring tasks' spec at a status, with a replaced behaviour, a diagram, and code added.
pub(super) fn spec(status: &str) -> Result<String, String> {
    let spec = recurring("spec.md")?;
    let spec = spec.replacen(
        "## Architecture\n",
        &format!("{REPLACED}{SKETCH}## Architecture\n"),
        1,
    );
    Ok(with_status(&spec, status))
}

/// A front matter's `status:` line set to a value.
pub(super) fn with_status(text: &str, status: &str) -> String {
    let mut done = false;
    let lines = text.split_inclusive('\n').map(|line| {
        if !done && line.starts_with("status: ") {
            done = true;
            format!("status: {status}\n")
        } else {
            line.to_owned()
        }
    });
    lines.collect()
}

/// The 11 tasks of the sample plans, 5 steps each.
const ELEVEN: [&str; 11] = [
    "Plan progress in the core",
    "One parser for plan tasks",
    "Branch changes in the core",
    "Branch changes on the server",
    "Sidebar slugs and progress",
    "The session's own page",
    "Session column",
    "Jump to the latest",
    "The phone's progress line",
    "Announcements",
    "Layout decision checks",
];

/// A plan of the 11 tasks, for spec revision 1: its first `done` tasks checked.
pub(super) fn plan(done: usize, status: &str) -> String {
    let mut text = format!("---\nstatus: {status}\nspec-revision: 1\n---\n\n# Plan: Feature\n");
    for (index, title) in ELEVEN.iter().enumerate() {
        text.push_str(&format!("\n## Task {}: {title}\n\n", index + 1));
        for step in 1..=5 {
            let mark = if index < done { "x" } else { " " };
            text.push_str(&format!("- [{mark}] **Step {step}: Do**\n"));
        }
    }
    text
}

/// A new decision, named after the feature that made it.
fn decision(title: &str) -> String {
    format!(
        "---\nstatus: active\napproved-by: mrtolkien\nicon: book-open\n---\n\n# {title}\n\nFlows \
         and states are Mermaid code blocks, drawn by the UI.\n\n## Rules\n\n- Flows MUST be \
         drawn as Mermaid code blocks. Checked by review.\n- A diagram MUST draw in a frame \
         without scripts. Checked by the UI tests.\n\n## Why\n\nOne way to draw a flow, \
         readable as text.\n"
    )
}

/// A record of a finished feature or change, with `questions` questions in one round.
pub(super) fn record(kind: &str, title: &str, questions: usize, finished: &str) -> String {
    let asked: Vec<String> = (1..=questions)
        .map(|n| format!("#### Q{n}: How should question {n} read?\n\n**Answer:** A, one card per question.\n"))
        .collect();
    let round = if questions > 0 {
        format!("\n## Questions\n\n### Round 01\n\n{}", asked.join("\n"))
    } else {
        String::new()
    };
    let decisions = if kind == "feature" {
        format!("\n## Decisions\n\n- New: {title}.\n")
    } else {
        String::new()
    };
    format!(
        "---\nkind: {kind}\nfinished: {finished}\npull-request: \
         https://github.com/mrtolkien/uraeda/pull/30\n---\n\n# Record: {title}\n\n## What and \
         why\n\nRounds of questions had grown long and read as a flat list. You asked for a \
         round that is quick to read once, top to bottom, with a verdict first.\n\n## \
         Behaviour\n\n- A round opens with the counts and the time, then a verdict.\n- Each \
         question is a card, with a muted \"Why it matters\" box after its context.\n{round}\
         {decisions}\n## Follow-ups\n\n- Keyboard navigation between question cards, left for \
         later.\n"
    )
}

/// `count` numbered lines.
pub(super) fn lines(count: usize, prefix: &str) -> String {
    (0..count).map(|n| format!("{prefix} {n}\n")).collect()
}

/// The code a feature's build writes, 22 files, and a file it removes.
pub(super) fn code(prefix: &str, old: Option<&str>) -> Files {
    let mut files: Files = (0..22)
        .map(|n| {
            let count = if n == 0 { 70 } else { 54 };
            text(format!("src/{prefix}/part-{n}.ts"), lines(count, "line"))
        })
        .collect();
    files.extend(old.map(|old| (old.to_owned(), None)));
    files
}

/// The finish of a feature: its files removed, its record added.
pub(super) fn finish(folder: &str, record: String, at: Option<String>) -> Commit {
    let mut files: Files = ["proposal.md", "clarifications-01.md", "spec.md", "plan.md"]
        .iter()
        .map(|name| (format!("specs/{folder}/{name}"), None))
        .collect();
    files.push(text(format!("specs/done/{folder}.md"), record));
    let mut commit = Commit::new(
        format!("finish({}): the record", slug_of(folder)),
        at,
        files,
    );
    commit.committed.clone_from(&commit.at);
    commit
}

/// A feature's first stages, from its proposal on October 17 at 10:52 to its plan at 15:05, its
/// decision left out without `decision`.
pub(super) fn first_stages(
    folder: &str,
    title: &str,
    decision_too: bool,
) -> Result<Vec<Commit>, String> {
    let path = format!("specs/{folder}");
    let slug = slug_of(folder);
    let mut stages = vec![
        Commit::new(
            format!("proposal({slug}): {title}"),
            at("17 10:52"),
            vec![text(format!("{path}/proposal.md"), proposal(title))],
        ),
        Commit::new(
            format!("discovery({slug}): round 01"),
            at("17 11:18"),
            vec![text(
                format!("{path}/clarifications-01.md"),
                recurring("clarifications-01.md")?,
            )],
        ),
        Commit::new(
            format!("spec({slug}): the spec"),
            at("17 12:11"),
            vec![text(format!("{path}/spec.md"), spec("approved")?)],
        ),
    ];
    if decision_too {
        stages.push(Commit::new(
            format!("decision({slug}): {title}"),
            at("17 15:01"),
            vec![text(format!("specs/decisions/{slug}.md"), decision(title))],
        ));
    }
    stages.push(Commit::new(
        format!("plan({slug}): the plan"),
        at("17 15:05"),
        vec![text(format!("{path}/plan.md"), plan(6, "auto-approved"))],
    ));
    Ok(stages)
}

/// A fixture's bytes, for a file a commit writes as it is.
pub(super) fn bytes(path: &str) -> Result<Vec<u8>, String> {
    let file = fixture(path);
    std::fs::read(&file).map_err(|error| format!("{}: {error}", file.display()))
}
