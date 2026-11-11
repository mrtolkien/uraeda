//! The other sample projects: "empty", a project just set up; "broken", whose features carry the
//! problems `ura check` reports; "bare", a repository not set up; and "realistic", a full day's
//! load, as the Node sandbox's builders made them (`packages/web/samples/`).

use std::fs;
use std::path::Path;

use super::fixture;
use super::git::{Commit, Files, Repo, text};
use super::texts::{at, bytes, code, finish, first_stages, proposal, record};

/// The folders of the realistic project's live features.
pub(super) mod realistic_folders {
    /// Its round of questions waits for the human.
    pub const ASKING: &str = "2026-10-21-leader-key";
    /// Its spec waits for the human's review.
    pub const REVIEWING: &str = "2026-10-19-leader-key";
    /// An agent builds it: task 7 of 11.
    pub const BUILDING: &str = "2026-10-18-due-reminders";
    /// An agent writes its spec, from the answered round.
    pub const SPECIFYING: &str = "2026-10-21-calendar-view";
}

/// The templates a project set up has in its `specs/`, and the folders setup makes.
const SETUP: [&str; 4] = ["README.md", "CONSTITUTION.md", "PRIORITIES.md", "INBOX.md"];
const SETUP_FOLDERS: [&str; 3] = ["proposals", "decisions", "changes"];

/// A project set up, as `projects.md` says, its setup committed.
pub(super) fn empty(path: &Path) -> Result<Repo, String> {
    let repo = Repo::init(path)?;
    let specs = path.join("specs");
    let templates = fixture("../skills/uraeda/assets/templates/specs");
    for name in SETUP {
        let from = templates.join(name);
        fs::create_dir_all(&specs).map_err(|error| error.to_string())?;
        fs::copy(&from, specs.join(name))
            .map_err(|error| format!("{}: {error}", from.display()))?;
    }
    for name in SETUP_FOLDERS {
        let folder = specs.join(name);
        fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
        fs::write(folder.join(".gitkeep"), "").map_err(|error| error.to_string())?;
    }
    repo.commit_all("chore: set up specs")?;
    Ok(repo)
}

/// A repository with a README, and no `specs/`.
pub(super) fn bare(path: &Path) -> Result<(), String> {
    let repo = Repo::init(path)?;
    let readme = "# Bare\n\nA project not set up for Uraeda yet.\n";
    fs::write(path.join("README.md"), readme).map_err(|error| error.to_string())?;
    repo.commit_all("docs: readme")
}

/// A project set up, then one feature per file of `fixtures/broken/`, each on its branch: its
/// proposal, and that file, copied byte for byte.
pub(super) fn broken(path: &Path) -> Result<(), String> {
    let repo = empty(path)?;
    let source = fixture("broken");
    let mut names: Vec<String> = fs::read_dir(&source)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    for name in names {
        let file = name.trim_end_matches(".md");
        let folder = format!("2026-10-19-broken-{file}");
        repo.branch(&folder, "main")?;
        let files = vec![
            text(
                format!("specs/{folder}/proposal.md"),
                proposal(&format!("Broken {file}")),
            ),
            (
                format!("specs/{folder}/{name}"),
                Some(bytes(&format!("broken/{name}"))?),
            ),
        ];
        let message = format!("docs({folder}): proposal");
        repo.commits(&folder, vec![Commit::new(message, None, files)])?;
    }
    Ok(())
}

/// The realistic project's done features, each with when it was finished and its questions.
const DONE: [(&str, &str, &str, usize); 3] = [
    ("2026-10-12-task-search", "Task search", "17 18:30", 6),
    ("2026-10-13-csv-import", "Import from CSV", "18 11:15", 4),
    (
        "2026-10-14-keyboard-nav",
        "Keyboard navigation",
        "18 16:05",
        8,
    ),
];

/// The leader key's round, besides its proposal: its discovery and its mockups.
const LEADER_KEY_ROUND: [&str; 8] = [
    "discovery-01.md",
    "clarifications-01.md",
    "mockups/bottom-panel.html",
    "mockups/bottom-right-box.html",
    "mockups/centered-modal.html",
    "mockups/leader.css",
    "mockups/leader.js",
    "mockups/status-line-strip.html",
];

/// A project as it is lived in: Uraeda's own constitution and decisions, three done features,
/// long priorities and inbox, an inbox triage waiting, and four live features, two of which
/// wait for the human on Uraeda's own leader key.
pub(super) fn realistic(path: &Path) -> Result<(), String> {
    let repo = empty(path)?;
    let mut governance: Files = vec![("specs/decisions/.gitkeep".to_owned(), None)];
    governance.push(file("specs/CONSTITUTION.md", "realistic/CONSTITUTION.md")?);
    let decisions = fs::read_dir(fixture("realistic/decisions")).map_err(|e| e.to_string())?;
    let mut decisions: Vec<String> = decisions
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    decisions.sort();
    for name in decisions {
        governance.push(file(
            &format!("specs/decisions/{name}"),
            &format!("realistic/decisions/{name}"),
        )?);
    }
    let mut main = vec![Commit::new(
        "docs: the constitution and decisions",
        at("16 09:30"),
        governance,
    )];
    for (folder, title, finished, questions) in DONE {
        let slug = &folder[11..];
        main.extend(first_stages(folder, title, false)?);
        main.push(Commit::new(
            format!("feat({slug}): the code"),
            at("17 16:00"),
            code(slug, None),
        ));
        let day = format!("2026-10-{}", &finished[..2]);
        main.push(finish(
            folder,
            record("feature", title, questions, &day),
            at(finished),
        ));
    }
    main.push(Commit::new(
        "docs: priorities and inbox",
        at("17 09:00"),
        vec![
            file("specs/INBOX.md", "sandbox/realistic/INBOX.md")?,
            file(
                "specs/notes/due-date-picker/images/due-date-picker.webp",
                "images/lossy.webp",
            )?,
            file(
                "specs/notes/due-date-picker/note.md",
                "sandbox/realistic/note.md",
            )?,
            file("specs/PRIORITIES.md", "sandbox/realistic/PRIORITIES.md")?,
            file(
                "specs/proposals/shared-lists.md",
                "sandbox/realistic/shared-lists.md",
            )?,
        ],
    ));
    let triage = String::from_utf8_lossy(&bytes("realistic/INBOX-TRIAGE.md")?).into_owned();
    let summary = triage
        .lines()
        .find_map(|line| line.strip_prefix("> "))
        .unwrap_or_default();
    main.push(Commit::new(
        format!("chore: propose an inbox triage\n\n{summary}"),
        at("21 11:00"),
        vec![text("specs/INBOX-TRIAGE.md", triage.clone())],
    ));
    repo.commits("main", main)?;
    live_features(&repo)
}

/// The realistic project's four live features, each on its branch: a spec being written, a plan
/// being built, the leader key's round of questions, and its spec waiting for review.
fn live_features(repo: &Repo) -> Result<(), String> {
    use realistic_folders::{ASKING, BUILDING, REVIEWING, SPECIFYING};
    repo.branch(SPECIFYING, "main")?;
    let mut specifying = first_stages(SPECIFYING, "Calendar view", false)?;
    specifying.truncate(2);
    repo.commits(SPECIFYING, specifying)?;

    repo.branch(BUILDING, "main")?;
    let mut building = first_stages(BUILDING, "Due date reminders", false)?;
    let message = "feat(due-reminders): the reminder rules";
    building.push(Commit::new(
        message,
        at("17 15:08"),
        code("reminders", None),
    ));
    repo.commits(BUILDING, building)?;
    repo.worktree(BUILDING)?;

    repo.branch(ASKING, "main")?;
    let message = "proposal(leader-key): Leader key/shortcut map";
    let proposal_file = file(
        &format!("specs/{ASKING}/proposal.md"),
        "round-leader-key/proposal.md",
    )?;
    let round: Files = LEADER_KEY_ROUND
        .iter()
        .map(|name| {
            file(
                &format!("specs/{ASKING}/{name}"),
                &format!("round-leader-key/{name}"),
            )
        })
        .collect::<Result<_, _>>()?;
    repo.commits(
        ASKING,
        vec![
            Commit::new(message, at("21 09:40"), vec![proposal_file]),
            Commit::new(
                "discovery(leader-key): Leader key/shortcut map",
                at("21 10:25"),
                round,
            ),
        ],
    )?;

    repo.branch(REVIEWING, "main")?;
    let spec_files = [
        "spec.md",
        "data-model.md",
        "mockups/keyboard-setting.html",
        "mockups/picker.html",
    ];
    let stages: [(&str, &[&str], &str); 3] = [
        (
            "19 09:00",
            &["proposal.md"],
            "proposal(leader-key): Leader key/shortcut map",
        ),
        (
            "19 09:40",
            &LEADER_KEY_ROUND,
            "discovery(leader-key): Leader key/shortcut map",
        ),
        (
            "19 11:30",
            &spec_files,
            "spec(leader-key): Leader key/shortcut map",
        ),
    ];
    let mut reviewing = Vec::new();
    for (time, names, message) in stages {
        let files: Files = names
            .iter()
            .map(|name| {
                file(
                    &format!("specs/{REVIEWING}/{name}"),
                    &format!("spec-leader-key/{name}"),
                )
            })
            .collect::<Result<_, _>>()?;
        reviewing.push(Commit::new(message, at(time), files));
    }
    repo.commits(REVIEWING, reviewing)
}

/// A file a commit writes, from a fixture.
fn file(path: &str, from: &str) -> Result<(String, Option<Vec<u8>>), String> {
    Ok((path.to_owned(), Some(bytes(from)?)))
}
