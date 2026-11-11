//! Writing: the records `Buffer` and `WriteQueue`, the actions that answer rounds, review specs
//! and plans, save and commit texts, and undo, and the write queue they all go through. Each
//! test talks to a real server over the protocol, on a copy of the fixture repository.

#[path = "writing/fixture.rs"]
mod fixture;
mod support;

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use fixture::{Fixture, Hook, REPO, fixture, fixture_repo, names};
use serde_json::{Value, json};
use uraeda_protocol::ErrorCode;

/// A feature whose spec waits for a review.
const TASKS: &str = "2026-10-06-recurring-tasks";
/// A feature whose plan waits for a review.
const PLAN: &str = "2026-10-13-plan-review";
/// A feature whose round of questions waits for answers.
const WEB: &str = "2026-10-11-web-ui";
/// A proposal file of the default branch.
const PROPOSAL: &str = "specs/proposals/git-listener.md";
/// A decision of the default branch.
const DECISION: &str = "specs/decisions/git.md";
/// The inbox's triage, a round of the default branch.
const TRIAGE: &str = "specs/INBOX-TRIAGE.md";

fn spec(folder: &str) -> String {
    format!("specs/{folder}/spec.md")
}

/// A committing action's `write`: its name in the write queue.
fn named(label: &str) -> Value {
    json!({ "href": "/somewhere", "label": label })
}

/// A file as a branch has it committed.
fn committed(fx: &Fixture, branch: &str, path: &str) -> String {
    fx.repo.git(&["show", &format!("{branch}:{path}")])
}

/// The hash a record or a save gave.
fn hash_of(value: &Value) -> String {
    value["hash"].as_str().expect("a hash").to_owned()
}

/// Saves a text over the one read, and commits it under `label`, without waiting for it to land.
async fn save_and_commit(fx: &mut Fixture, path: &str, text: &str, label: &str) {
    let read = fx.read("Buffer", json!({ "path": path })).await;
    let save = json!({ "path": path, "text": text, "hash": hash_of(&read) });
    fx.call("text.save", save).await;
    let commit = json!({ "path": path, "write": named(label) });
    fx.call("text.commit", commit).await;
}

/// The index lock of the checkout that has `branch`: while it exists, no commit stages there.
fn index_lock(fx: &Fixture, branch: &str) -> PathBuf {
    let listed = fx.repo.git(&["worktree", "list", "--porcelain"]);
    let entries = listed.split("\n\n");
    let has_branch = |entry: &&str| {
        let wanted = format!("branch refs/heads/{branch}");
        entry.lines().any(|line| line == wanted)
    };
    let entry = entries.clone().find(has_branch).expect("a checkout");
    let root = entry
        .lines()
        .next()
        .and_then(|line| line.strip_prefix("worktree "));
    let root = PathBuf::from(root.expect("a worktree's path"));
    let git_dir = support::repo::run_git(&root, &["rev-parse", "--absolute-git-dir"]);
    PathBuf::from(git_dir.trim()).join("index.lock")
}

#[tokio::test]
async fn buffer_answers_its_shape() {
    let mut fx = Fixture::start().await;

    let decision = fx.read("Buffer", json!({ "path": DECISION })).await;
    let on_branch = fx.read("Buffer", json!({ "path": spec(TASKS) })).await;
    let code = fx.read("Buffer", json!({ "path": "README.md" })).await;
    let outside = fx
        .try_watch("Buffer", json!({ "path": "../README.md" }))
        .await;

    let text = fixture("repo/main/specs/decisions/git.md");
    let hash = hash_of(&decision);
    assert_eq!(
        decision,
        json!({
            "path": DECISION,
            "text": text,
            "hash": hash,
            "branch": "main",
            "worktree": null,
            "checkedOut": true,
            "readOnly": null,
        })
    );
    assert_eq!(hash.len(), 64, "a SHA-256 in hexadecimal: {hash}");
    // A feature's file is read on its branch, which no checkout has yet.
    assert_eq!(on_branch["branch"], TASKS);
    assert!(on_branch["text"].as_str().unwrap().contains("# Spec"));
    assert_eq!(on_branch["checkedOut"], false);
    // Any other text file of the main checkout is read, and says why it is not saved here.
    assert_eq!(code["text"], "# Test\n");
    assert!(code["readOnly"].as_str().unwrap().contains("specs/"));
    let (code, message) = outside.unwrap_err();
    assert_eq!(code, ErrorCode::Refused, "{message}");
}

#[tokio::test]
async fn write_queue_answers_its_shape() {
    let mut fx = Fixture::start().await;
    let hook = Hook::held(&fx.repo);
    let queue = fx.watch("WriteQueue", json!({})).await;
    assert_eq!(*fx.value(queue), json!({ "writes": [] }));

    let approve = json!({ "folder": TASKS, "file": "spec.md", "write": named("Approving") });
    fx.call("review.approve", approve).await;

    // The call answered once its files were written: its commit lands behind it.
    assert!(fx.text(&spec(TASKS)).await.contains("status: approved"));
    assert!(!committed(&fx, TASKS, &spec(TASKS)).contains("status: approved"));
    let running = fx.until(queue, |value| value["writes"][0]["state"] == "running");
    let write = json!({
        "id": "write-1",
        "label": "Approving",
        "href": "/somewhere",
        "folder": TASKS,
        "file": "spec.md",
        "state": "running",
        "failure": null,
        "output": null,
        "steps": null,
    });
    assert_eq!(running.await, json!({ "writes": [write] }));
    hook.release();
    assert_eq!(fx.idle().await, Vec::<Value>::new());
    assert!(committed(&fx, TASKS, &spec(TASKS)).contains("status: approved"));
}

// The break it catches: a deferred commit landing outside the repository's turn, so a save
// writes the checkout while the commit's hooks run, where a hook that stashes what is not staged
// would take the save's text away, or sweep it into the commit. A save that arrives meanwhile
// waits for the one commit that runs, and no other.
#[tokio::test]
async fn a_save_never_writes_while_a_commit_lands() {
    let mut fx = Fixture::start().await;
    let hook = Hook::held(&fx.repo);
    let queue = fx.watch("WriteQueue", json!({})).await;
    let before = fx.repo.read(PROPOSAL);
    let hash = hash_of(&fx.read("Buffer", json!({ "path": PROPOSAL })).await);
    let approve = json!({ "folder": TASKS, "file": "spec.md", "write": named("The spec") });
    fx.call("review.approve", approve).await;
    fx.until(queue, |value| value["writes"][0]["state"] == "running")
        .await;

    let text = "# Git listener\n\nSaved while a hook ran.\n";
    let save = json!({ "path": PROPOSAL, "text": text, "hash": hash });
    let save = fx.send("text.save", save).await;
    let answered = fx.answered_within(save, Duration::from_millis(300)).await;
    assert!(!answered, "the save ran while the commit's hook ran");
    assert_eq!(fx.repo.read(PROPOSAL), before, "nothing written meanwhile");

    hook.release();
    fx.answer(save)
        .await
        .expect("the save, once the commit landed");
    assert_eq!(fx.repo.read(PROPOSAL), text);
    assert_eq!(fx.idle().await, Vec::<Value>::new());
    assert_eq!(hook.log().len(), 2, "one commit: {:?}", hook.log());
    assert!(committed(&fx, TASKS, &spec(TASKS)).contains("status: approved"));
}

// Breaks caught: commits landed at the same time, and a commit of files whose last commit has
// not landed yet.
#[tokio::test]
async fn two_writes_on_one_repository_land_in_order() {
    let repo = fixture_repo(REPO);
    repo.write(
        "specs/proposals/second.md",
        "# Second\n\n## What\n\nMore.\n",
    );
    repo.commit("chore: a second proposal");
    let mut fx = Fixture::over(repo).await;
    let hook = Hook::held(&fx.repo);
    let queue = fx.watch("WriteQueue", json!({})).await;
    let second = "specs/proposals/second.md";
    let hash = |value: Value| hash_of(&value);
    let first_hash = hash(fx.read("Buffer", json!({ "path": PROPOSAL })).await);
    let second_hash = hash(fx.read("Buffer", json!({ "path": second })).await);

    let spec_file = json!({ "folder": TASKS, "file": "spec.md", "write": named("The spec") });
    fx.call("review.approve", spec_file).await;
    fx.until(queue, |value| value["writes"][0]["state"] == "running")
        .await;
    // Every write sent while the spec's commit lands waits for it, in the order sent; the lists'
    // second commit waits for their first to land too, as the core would not defer it.
    let plan_file = json!({ "folder": PLAN, "file": "plan.md", "write": named("The plan") });
    let first = "# Git listener\n\nFirst.\n";
    let commit = |path: &str, label: &str| json!({ "path": path, "write": named(label) });
    let sent = [
        fx.send("review.approve", plan_file).await,
        fx.send(
            "text.save",
            json!({ "path": PROPOSAL, "text": first, "hash": first_hash }),
        )
        .await,
        fx.send("text.commit", commit(PROPOSAL, "The proposal"))
            .await,
        fx.send(
            "text.save",
            json!({ "path": second, "text": "# Second\n\nMore.\n", "hash": second_hash }),
        )
        .await,
        fx.send("text.commit", commit(second, "The second proposal"))
            .await,
    ];
    let answered = fx
        .answered_within(sent[0], Duration::from_millis(300))
        .await;
    assert!(!answered, "a write ran while a commit landed");
    assert_eq!(fx.writes(queue), ["The spec running"]);

    hook.release();
    for id in sent {
        fx.answer(id).await.expect("a write sent meanwhile");
    }
    assert_eq!(fx.idle().await, Vec::<Value>::new());

    // One commit at a time, in the order the writes were made.
    let log = hook.log();
    let starts: Vec<&String> = log.iter().step_by(2).collect();
    let ends: Vec<&String> = log.iter().skip(1).step_by(2).collect();
    assert_eq!(log.len(), 8, "{log:?}");
    assert!(ends.iter().all(|line| *line == "end"), "{log:?}");
    let files = [
        &spec(TASKS),
        &format!("specs/{PLAN}/plan.md"),
        PROPOSAL,
        second,
    ];
    for (start, file) in starts.iter().zip(files) {
        assert!(
            start.starts_with("start ") && start.contains(file),
            "{log:?}"
        );
    }
    assert!(committed(&fx, TASKS, &spec(TASKS)).contains("status: approved"));
    let plan = format!("specs/{PLAN}/plan.md");
    assert!(committed(&fx, PLAN, &plan).contains("status: approved"));
    assert_eq!(
        committed(&fx, "main", PROPOSAL),
        "# Git listener\n\nFirst.\n"
    );
    assert_eq!(committed(&fx, "main", second), "# Second\n\nMore.\n");
}

// The break it catches: each call run on a task of its own, so two saves one client sends back
// to back reach the queue in either order, and the older text is the one that stays. The first
// save's input is the longer one to read, as a call's may be: without an order kept, the second
// reaches the queue first. Ten rounds, each a commit: fifty took 5 s.
#[tokio::test]
async fn two_saves_sent_back_to_back_land_in_the_order_sent() {
    let mut fx = Fixture::start().await;
    let mut hash = hash_of(&fx.read("Buffer", json!({ "path": PROPOSAL })).await);
    // A field the action does not know is read, and dropped, before the action runs.
    let long_to_read = vec![0; 40_000];

    for round in 0..10 {
        // Both are made over the text read: the one that lands first wins, the other conflicts.
        let text = |nth: &str| format!("round {round}, the {nth} save\n");
        let first = json!({
            "path": PROPOSAL, "text": text("first"), "hash": hash, "unknown": long_to_read,
        });
        let second = json!({ "path": PROPOSAL, "text": text("second"), "hash": hash });
        let first = fx.send("buffer.save", first).await;
        let second = fx.send("buffer.save", second).await;

        let landed = fx.answer(first).await;
        let late = fx.answer(second).await;
        let landed = landed.unwrap_or_else(|refused| panic!("round {round}: {refused:?}"));
        assert_eq!(late.unwrap_err().0, ErrorCode::Conflict, "round {round}");
        hash = hash_of(&landed);
    }
    assert_eq!(fx.repo.read(PROPOSAL), "round 9, the first save\n");
}

// The break it catches: a write that tells its own domain's records only, so a page that reads
// after an action's answer shows the file, the proposal, or the Git page as they were, until
// the watcher's next burst.
#[tokio::test]
async fn a_write_and_its_landing_reach_the_records_of_every_domain() {
    let mut fx = Fixture::start().await;
    let hook = Hook::held(&fx.repo);
    let round = json!({ "id": format!("{WEB}/clarifications-01.md") });
    let round = fx.watch("WorkflowFile", round).await;
    let proposal = fx.watch("ProposalFile", json!({ "id": PROPOSAL })).await;
    let page = fx.watch("GitPage", json!({})).await;
    let asked = fx.value(round).clone();
    let subject = |page: &Value| page["history"][0]["subject"].clone();
    let before = subject(fx.value(page));

    // A save of writing reaches the features' record of the file it wrote.
    let answer = json!({
        "folder": WEB, "question": "Q1", "letters": ["A"], "comment": "", "previous": "",
    });
    fx.call("answer.save", answer).await;
    fx.until(round, |file| *file != asked).await;

    // A commit is written at once: the proposal's record has the text while its hooks run.
    let text = "# Git listener\n\n## What\n\nRun every step.\n";
    save_and_commit(&mut fx, PROPOSAL, text, "Committing the listener").await;
    let written = |file: &Value| file.to_string().contains("Run every step.");
    fx.until(proposal, written).await;
    assert_eq!(subject(fx.value(page)), before, "nothing landed yet");

    // Once it landed, the Git page's history starts with it.
    hook.release();
    fx.until(page, |page| subject(page) != before).await;
    assert_eq!(fx.idle().await, Vec::<Value>::new());
}

#[tokio::test]
async fn a_refused_write_stays_until_dismissed_and_does_not_stop_the_next() {
    let mut fx = Fixture::start().await;
    let hook = Hook::held(&fx.repo);
    hook.release();
    hook.refusing(true);

    save_and_commit(
        &mut fx,
        PROPOSAL,
        "# Git listener\n\nFirst.\n",
        "The proposal",
    )
    .await;
    let refused = fx.idle().await;
    hook.refusing(false);
    let approve = json!({ "folder": TASKS, "file": "spec.md", "write": named("The spec") });
    fx.call("review.approve", approve).await;
    let left = fx.idle().await;

    assert_eq!(names(&refused), ["The proposal refused"]);
    assert_eq!(refused[0]["failure"], "hook");
    let output = refused[0]["output"].as_str().unwrap();
    assert!(output.contains("lint: 1 problem"), "{output}");
    // A hook's refusal commits nothing, and the next write landed all the same.
    assert_ne!(
        committed(&fx, "main", PROPOSAL),
        "# Git listener\n\nFirst.\n"
    );
    assert!(committed(&fx, TASKS, &spec(TASKS)).contains("status: approved"));
    // It stays, for every client, until one dismisses it.
    assert_eq!(left, refused);
    fx.call("writes.dismiss", json!({ "id": refused[0]["id"] }))
        .await;
    assert_eq!(fx.idle().await, Vec::<Value>::new());
}

#[tokio::test]
async fn a_write_that_failed_leaves_its_files_and_commit_retry_lands_them() {
    let mut fx = Fixture::start().await;
    let file = json!({ "folder": TASKS, "file": "spec.md" });
    // A comment makes the feature's checkout, where the lock then stops git.
    let comment = json!({ "folder": TASKS, "file": "spec.md", "text": "Why daily?" });
    fx.call("review.comment", comment).await;
    let lock = index_lock(&fx, TASKS);
    fs::write(&lock, "").unwrap();

    let request = json!({ "folder": TASKS, "file": "spec.md", "write": named("The review") });
    fx.call("review.requestChanges", request).await;
    let refused = fx.idle().await;
    let written = fx.text(&spec(TASKS)).await;
    let uncommitted = committed(&fx, TASKS, &spec(TASKS));
    fs::remove_file(&lock).unwrap();
    fx.call("writes.dismiss", json!({ "id": refused[0]["id"] }))
        .await;
    fx.call("commit.retry", file).await;
    let left = fx.idle().await;

    assert_eq!(names(&refused), ["The review refused"]);
    assert_eq!(refused[0]["failure"], "failed", "{refused:?}");
    assert!(written.contains("status: changes-requested"), "{written}");
    assert!(
        !uncommitted.contains("status: changes-requested"),
        "{uncommitted}"
    );
    assert_eq!(left, Vec::<Value>::new());
    assert!(committed(&fx, TASKS, &spec(TASKS)).contains("status: changes-requested"));
    let review = format!("specs/{TASKS}/spec-review.md");
    assert!(committed(&fx, TASKS, &review).contains("Why daily?"));
}

#[tokio::test]
async fn a_round_is_answered_noted_and_submitted() {
    let mut fx = Fixture::start().await;
    let round = format!("specs/{WEB}/clarifications-01.md");
    let subject = "The actions' commits move into the core";

    for question in ["Q1", "Q2", "Q3"] {
        let answer = json!({
            "folder": WEB, "question": question, "letters": ["A"], "comment": "", "previous": "",
        });
        fx.call("answer.save", answer).await;
    }
    let notes = json!({ "folder": WEB, "notes": "Fine by me.", "previous": "" });
    fx.call("notes.save", notes).await;
    let comment = json!({ "folder": WEB, "subject": subject, "text": "Keep it." });
    fx.call("settled.comment", comment).await;
    let edit = json!({
        "folder": WEB, "number": 1, "subject": subject, "text": "Keep it there.",
        "previous": "Keep it.",
    });
    fx.call("settled.edit", edit).await;
    let written = fx.text(&round).await;
    let remove = json!({
        "folder": WEB, "number": 1, "subject": subject, "previous": "Keep it there.",
    });
    let removed = fx.call("settled.remove", remove).await;
    let submit = json!({ "folder": WEB, "file": "clarifications-01.md" });
    fx.call("answers.submit", submit).await;
    assert_eq!(fx.idle().await, Vec::<Value>::new());

    assert!(written.contains("**Answer:** A"), "{written}");
    assert!(written.contains("Fine by me."), "{written}");
    assert!(written.contains("Keep it there."), "{written}");
    // An undoable write answers the change it made, for the client's undo stack.
    assert_eq!(removed["change"]["files"][0]["path"], round);
    let landed = committed(&fx, WEB, &round);
    assert!(landed.contains("status: answered"), "{landed}");
    assert!(
        landed.contains("Fine by me.") && !landed.contains("Keep it there."),
        "{landed}"
    );
}

#[tokio::test]
async fn a_review_is_written_comment_by_comment() {
    let mut fx = Fixture::start().await;
    let review = format!("specs/{TASKS}/spec-review.md");
    let on = |fields: Value| {
        let mut input = json!({ "folder": TASKS, "file": "spec.md" });
        input
            .as_object_mut()
            .unwrap()
            .extend(fields.as_object().unwrap().clone());
        input
    };

    let commented = fx
        .call("review.comment", on(json!({ "text": "Why daily?" })))
        .await;
    let edit = on(json!({ "number": 1, "text": "Why weekly?" }));
    fx.call("review.edit", edit).await;
    let lines = on(json!({ "text": "On a line.", "startLine": 12, "endLine": 13 }));
    fx.call("review.comment", lines).await;
    let both = fx.text(&review).await;
    fx.call("review.remove", on(json!({ "number": 2 }))).await;
    let one = fx.text(&review).await;
    let over = fx.call("review.startOver", on(json!({}))).await;

    assert_eq!(commented["change"]["files"][0]["path"], review);
    assert!(commented["change"]["files"][0]["before"].is_null());
    assert!(
        both.contains("Why weekly?") && both.contains("On a line."),
        "{both}"
    );
    assert!(!both.contains("Why daily?"), "{both}");
    assert!(
        one.contains("Why weekly?") && !one.contains("On a line."),
        "{one}"
    );
    assert!(over["change"]["files"][0]["after"].is_null());
    assert_eq!(fx.try_text(&review).await, None);
}

/// A server over the fixture repository with the inbox's triage committed on `main`.
async fn with_triage() -> Fixture {
    let repo = fixture_repo(REPO);
    repo.write(TRIAGE, &fixture("INBOX-TRIAGE.md"));
    repo.commit("chore: triage");
    Fixture::over(repo).await
}

#[tokio::test]
async fn a_round_of_the_default_branch_is_answered_and_committed() {
    let mut fx = with_triage().await;
    let read = fx.read("Buffer", json!({ "path": TRIAGE })).await;
    let answer = |question: &str, base: &str| {
        json!({
            "id": "inbox-triage", "question": question, "letters": ["A"], "comment": "",
            "previous": "", "base": base,
        })
    };

    // Each save answers the round's hash, which the next one takes.
    let first = fx
        .call("defaultRound.answer", answer("Q1", &hash_of(&read)))
        .await;
    let stale = fx
        .refused("defaultRound.answer", answer("Q2", &hash_of(&read)))
        .await;
    let second = fx
        .call("defaultRound.answer", answer("Q2", &hash_of(&first)))
        .await;
    let third = fx
        .call("defaultRound.answer", answer("Q3", &hash_of(&second)))
        .await;
    let notes = json!({
        "id": "inbox-triage", "notes": "Go.", "previous": "", "base": hash_of(&third),
    });
    let noted = fx.call("defaultRound.notes", notes).await;
    let written = fx.read("Buffer", json!({ "path": TRIAGE })).await;
    // A commit that cannot stage fails, its files left written: `defaultRound.retry` lands it.
    let lock = index_lock(&fx, "main");
    fs::write(&lock, "").unwrap();
    let submit = json!({ "id": "inbox-triage", "previous": hash_of(&noted) });
    fx.call("defaultRound.submit", submit).await;
    let failed = fx.idle().await;
    fs::remove_file(&lock).unwrap();
    let uncommitted = committed(&fx, "main", TRIAGE);
    fx.call("defaultRound.retry", json!({ "id": "inbox-triage" }))
        .await;
    let left = fx.idle().await;

    assert_eq!(stale.0, ErrorCode::Conflict, "{}", stale.1);
    assert_eq!(hash_of(&noted), hash_of(&written));
    assert!(written["text"].as_str().unwrap().contains("Go."));
    assert_eq!(failed.len(), 1, "{failed:?}");
    assert_eq!(failed[0]["failure"], "failed", "{failed:?}");
    assert!(
        uncommitted.contains("status: awaiting-human"),
        "{uncommitted}"
    );
    // The retry landed: only the write that failed is left, until dismissed.
    assert_eq!(left, failed);
    assert!(committed(&fx, "main", TRIAGE).contains("status: answered"));
}

#[tokio::test]
async fn the_triage_is_dismissed_with_a_commit_of_its_own() {
    let mut fx = with_triage().await;
    let read = fx.read("Buffer", json!({ "path": TRIAGE })).await;

    let dismiss = json!({ "previous": hash_of(&read), "write": named("Dismissing") });
    fx.call("defaultRound.dismiss", dismiss).await;
    assert_eq!(fx.idle().await, Vec::<Value>::new());

    assert_eq!(fx.try_text(TRIAGE).await, None);
    let held = format!("main:{TRIAGE}");
    assert!(
        !fx.repo.try_git(&["cat-file", "-e", &held]),
        "the triage is still committed"
    );
}

#[tokio::test]
async fn a_text_is_saved_set_and_committed() {
    let mut fx = Fixture::start().await;
    let read = fx.read("Buffer", json!({ "path": PROPOSAL })).await;
    let text = "# Git listener\n\n## What\n\nRun every step.\n";

    let save = json!({ "path": PROPOSAL, "text": text, "hash": hash_of(&read) });
    let saved = fx.call("text.save", save.clone()).await;
    let stale = fx.refused("text.save", save).await;
    let level = json!({ "path": PROPOSAL, "level": "medium", "hash": hash_of(&saved) });
    let set = fx.call("text.discovery", level).await;
    let written = fx.read("Buffer", json!({ "path": PROPOSAL })).await;
    let uncommitted = committed(&fx, "main", PROPOSAL);
    fx.call("text.commit", json!({ "path": PROPOSAL })).await;
    assert_eq!(fx.idle().await, Vec::<Value>::new());

    assert_eq!(stale.0, ErrorCode::Conflict, "{}", stale.1);
    assert_eq!(hash_of(&set), hash_of(&written));
    let written = written["text"].as_str().unwrap();
    assert!(written.contains("discovery: medium") && written.contains("Run every step."));
    // A save commits nothing: the commit is the human's act.
    assert!(!uncommitted.contains("Run every step."), "{uncommitted}");
    assert_eq!(committed(&fx, "main", PROPOSAL), written);
}

#[tokio::test]
async fn a_buffer_is_saved_as_typed_and_its_readers_follow() {
    let mut fx = Fixture::start().await;
    let buffer = fx.watch("Buffer", json!({ "path": DECISION })).await;
    let read = fx.value(buffer).clone();
    let text = format!("{}\nOne more line.\n", read["text"].as_str().unwrap());

    let save = json!({ "path": DECISION, "text": text, "hash": hash_of(&read) });
    let saved = fx.call("buffer.save", save.clone()).await;
    let followed = fx
        .until(buffer, |value| value["hash"] == saved["hash"])
        .await;
    let stale = fx.refused("buffer.save", save).await;
    let outside = json!({ "path": "README.md", "text": "# Mine\n", "hash": "" });
    let refused = fx.refused("buffer.save", outside).await;

    assert_eq!(followed["text"], text);
    assert_ne!(hash_of(&saved), hash_of(&read));
    assert_eq!(stale.0, ErrorCode::Conflict, "{}", stale.1);
    assert_eq!(refused.0, ErrorCode::Refused, "{}", refused.1);
    // Never committed: the edit waits on the Git page.
    assert!(!committed(&fx, "main", DECISION).contains("One more line."));
    assert_eq!(fx.repo.read("README.md"), "# Test\n");
}

#[tokio::test]
async fn a_change_is_undone_and_redone_until_its_file_changed() {
    let mut fx = Fixture::start().await;
    let review = format!("specs/{TASKS}/spec-review.md");
    let file = json!({ "folder": TASKS, "file": "spec.md", "text": "Why?" });
    let commented = fx.call("review.comment", file).await;
    let change = commented["change"].clone();
    let apply = |direction: &str| json!({ "change": change.clone(), "direction": direction, "subject": "Why?" });

    let since = fx
        .call("undo.committed", json!({ "change": change.clone() }))
        .await;
    let undone = fx.call("undo.apply", apply("undo")).await;
    let after_undo = fx.try_text(&review).await;
    fx.call("undo.apply", apply("redo")).await;
    let after_redo = fx.text(&review).await;
    let edit = json!({ "folder": TASKS, "file": "spec.md", "number": 1, "text": "Why not?" });
    fx.call("review.edit", edit).await;
    let refused = fx.refused("undo.apply", apply("undo")).await;

    assert_eq!(since, json!(false));
    assert_eq!(undone, json!({ "commit": change["commit"] }));
    assert_eq!(after_undo, None);
    assert!(after_redo.contains("Why?"), "{after_redo}");
    // An undo never overwrites what changed since: it is refused, naming the file.
    let message = "Could not undo: “Why?” changed since in spec-review.md.";
    assert_eq!(refused, (ErrorCode::Conflict, message.to_owned()));
    assert!(fx.text(&review).await.contains("Why not?"));
}

#[tokio::test]
async fn a_stopped_server_defers_no_commit_any_more() {
    let mut fx = Fixture::start().await;
    let approve = json!({ "folder": TASKS, "file": "spec.md" });
    fx.call("review.approve", approve).await;
    fx.idle().await;

    let repo = fx.stop().await;
    // The core commits within its call again, as for `ura`: nothing is left for a queue to land.
    uraeda_core::api::approve(repo.path(), PLAN, "plan.md", None, None, None).unwrap();

    let plan = repo.git(&["show", &format!("{PLAN}:specs/{PLAN}/plan.md")]);
    assert!(plan.contains("status: approved"), "{plan}");
}
