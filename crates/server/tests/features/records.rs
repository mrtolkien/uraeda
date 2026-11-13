//! Each record of the features' domain answers its shape, on the fixture's repository: the
//! protocol's type reads the answer, and the answer says what the fixture holds.

use serde_json::{Value, json};
use uraeda_protocol::SessionStatus;
use uraeda_protocol::{
    AllBranchChanges, BranchChanges, BranchDecision, Feature, FileView, HistoryView, Inbox, Ledger,
    PostponeMessage, Priorities, ProposalFileView, ProposalHints, RecommendedMessage, Trigger,
    WorkflowMessage,
};

use super::{AGENT, HUMAN, Held, REPO, fixture_repo, of_item, of_repo, read, served, serving};

/// The protocol's type of a record's value, read from the answer.
fn typed<T: serde::de::DeserializeOwned>(value: &Value) -> T {
    serde_json::from_value(value.clone()).expect("the protocol's type reads the answer")
}

#[tokio::test]
async fn feature_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_item(&server, "Feature", HUMAN).await;

    let feature: Feature = typed::<Option<Feature>>(&value).expect("the feature");
    assert_eq!(feature.feature.folder, HUMAN);
    assert_eq!(feature.feature.kind, "feature");
    assert_eq!(feature.feature.step.waits_on, "human");
    assert_eq!(feature.status.status, SessionStatus::NeedsYou);
    assert_eq!(
        value["runOptions"],
        json!({ "own": options(), "merged": options() })
    );
    assert_eq!((feature.label, feature.session), (None, None));
    // The core's view is flattened: a client reads `folder` beside `status`.
    assert_eq!(value["folder"], HUMAN);
}

/// Run options that set nothing, as they are sent.
fn options() -> Value {
    json!({ "steps": [], "implementers": null, "reviewers": null, "reviewDepth": null })
}

#[tokio::test]
async fn a_folder_that_is_no_features_is_answered_as_none() {
    let (_repo, server) = served().await;

    assert_eq!(
        of_item(&server, "Feature", "2026-01-01-nothing").await,
        Value::Null
    );
    let file = format!("{HUMAN}/plan.md");
    assert_eq!(of_item(&server, "WorkflowFile", &file).await, Value::Null);
    let other = "2026-01-01-nothing/spec.md";
    assert_eq!(of_item(&server, "WorkflowFile", other).await, Value::Null);
    let decision = format!("{HUMAN}/no-such-decision");
    assert_eq!(
        of_item(&server, "BranchDecision", &decision).await,
        Value::Null
    );
    assert_eq!(
        of_item(&server, "RecommendedMessage", "2026-01-01-nothing").await,
        Value::Null
    );
    // A round of the default branch is none until an agent writes it.
    assert_eq!(
        of_item(&server, "WorkflowFile", "inbox-triage").await,
        Value::Null
    );
}

#[tokio::test]
async fn a_record_of_a_repository_not_listed_is_refused() {
    let (_repo, server) = served().await;

    let asked = Held::asked(&server, "Inbox", json!({ "repo": "elsewhere" })).await;

    let (code, message) = asked.err().expect("a refusal");
    assert_eq!(code, uraeda_protocol::ErrorCode::Refused);
    assert!(message.contains("elsewhere"), "{message}");
}

#[tokio::test]
async fn workflow_file_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_item(
        &server,
        "WorkflowFile",
        &format!("{HUMAN}/clarifications-01.md"),
    )
    .await;

    let file: FileView = typed::<Option<FileView>>(&value).expect("the file");
    assert_eq!(
        (file.folder.as_str(), file.kind.as_str()),
        (HUMAN, "clarifications")
    );
    assert_eq!(file.status.as_deref(), Some("awaiting-human"));
    // The core's document tree crosses as it is: blocks with their spans, and the round's items.
    assert!(
        file.current
            .document
            .blocks
            .iter()
            .any(|block| !block.spans.is_empty())
    );
    let round = file.current.items.clarifications.expect("a round's items");
    assert!(!round.questions.is_empty());
}

#[tokio::test]
async fn a_round_of_the_default_branch_is_read_by_its_id() {
    let repo = fixture_repo(REPO);
    repo.write(
        "specs/INBOX-TRIAGE.md",
        &std::fs::read_to_string(super::fixture("INBOX-TRIAGE.md")).unwrap(),
    );
    let server = serving(&repo).await;

    let value = of_item(&server, "WorkflowFile", "inbox-triage").await;
    let file: FileView = typed::<Option<FileView>>(&value).expect("the triage");
    assert_eq!(file.path, "specs/INBOX-TRIAGE.md");
    assert_eq!(file.status.as_deref(), Some("awaiting-human"));
    // The inbox carries the triage's status.
    assert_eq!(of_repo(&server, "Inbox").await["triage"], "awaiting-human");
}

#[tokio::test]
async fn proposal_file_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_item(&server, "ProposalFile", "specs/proposals/git-listener.md").await;

    let file: ProposalFileView = typed(&value);
    assert_eq!(file.kind, "proposal-file");
    assert_eq!(file.path, "specs/proposals/git-listener.md");
    assert!(file.committed);
    assert_eq!(
        file.proposal.expect("its line of the priorities").id,
        "next-2"
    );
    assert!(!file.document.blocks.is_empty());
}

#[tokio::test]
async fn priorities_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_repo(&server, "Priorities").await;

    let priorities: Priorities = typed(&value);
    let sections: Vec<_> = priorities
        .sections
        .iter()
        .map(|each| &*each.section)
        .collect();
    assert_eq!(sections, ["now", "next", "later", "blocked"]);
    let next = &priorities.sections[1].proposals;
    assert_eq!(next[0].id, "next-1");
    assert_eq!(next[0].text, "Claude Code runner (triggered manually)");
    assert_eq!(
        next[1].file.as_ref().expect("its file").path,
        "specs/proposals/git-listener.md"
    );
    // A proposal of Now links its feature while it runs, with its step.
    let running = priorities.sections[0].proposals[0]
        .running
        .as_ref()
        .expect("a running feature");
    assert_eq!(
        (running.folder.as_str(), running.step.waits_on.as_str()),
        (HUMAN, "human")
    );
    assert_eq!(priorities.changes, 0);
}

#[tokio::test]
async fn proposal_hints_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = read(&server, "ProposalHints", Value::Null).await;

    let hints: ProposalHints = typed(&value);
    assert!(
        hints.hints.iter().any(|hint| hint.heading == "What"),
        "{value}"
    );
    assert!(hints.hints.iter().all(|hint| !hint.hint.is_empty()));
}

#[tokio::test]
async fn inbox_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_repo(&server, "Inbox").await;

    let inbox: Inbox = typed(&value);
    let names: Vec<_> = inbox
        .categories
        .iter()
        .map(|each| each.name.as_deref())
        .collect();
    assert_eq!(names, [None, Some("UI"), Some("CLI")]);
    assert_eq!((inbox.count, inbox.changes, inbox.triage), (10, 0, None));
    let first = &inbox.categories[0].notes[0];
    assert_eq!(
        (first.id.as_str(), first.text.as_str()),
        ("note-1", "Specs are still way too long and hard to read")
    );
    let about = &inbox.categories[1].notes[0];
    assert_eq!(about.about.as_deref(), Some("run-ui"));
}

#[tokio::test]
async fn ledger_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_repo(&server, "Ledger").await;

    let ledger: Ledger = typed(&value);
    let names: Vec<_> = ledger.decisions.iter().map(|each| &*each.name).collect();
    assert_eq!(names, ["agents", "git", "stack", "tui", "ui-behaviour"]);
    assert!(
        ledger
            .constitution
            .is_some_and(|constitution| !constitution.principles.is_empty())
    );
}

#[tokio::test]
async fn history_answers_its_shape() {
    let (_repo, server) = served().await;

    let value = of_item(&server, "History", HUMAN).await;

    let history: HistoryView = typed(&value);
    assert_eq!(history.folder, HUMAN);
    assert_eq!(history.stages[0].name, "proposal");
}

#[tokio::test]
async fn branch_decision_answers_its_shape() {
    let repo = fixture_repo(REPO);
    let text = repo
        .read("specs/decisions/git.md")
        .replace("read git through gix", "read git through git2");
    repo.add_on_branch(HUMAN, "specs/decisions/git.md", &text);
    let server = serving(&repo).await;

    let value = of_item(&server, "BranchDecision", &format!("{HUMAN}/git")).await;

    let decision: BranchDecision = typed::<Option<BranchDecision>>(&value).expect("the decision");
    assert_eq!(
        (decision.name.as_str(), decision.folder.as_str()),
        ("git", HUMAN)
    );
    assert_eq!(decision.change.kind, "changed");
    assert!(!decision.document.blocks.is_empty());
}

#[tokio::test]
async fn branch_changes_answers_its_shape() {
    let repo = fixture_repo(REPO);
    repo.add_on_branch(HUMAN, "src/app.ts", "export const app = 1;\n");
    let server = serving(&repo).await;

    let value = of_item(&server, "BranchChanges", HUMAN).await;

    let changes: BranchChanges = typed(&value);
    let view = changes.changes.expect("the branch's changes");
    assert_eq!(
        (view.count, view.added, view.removed, changes.failed),
        (1, 1, 0, false)
    );
    assert_eq!(view.files[0].path, "src/app.ts");
    let none = of_item(&server, "BranchChanges", "2026-01-01-nothing").await;
    assert_eq!(none, json!({ "changes": null, "failed": false }));
}

#[tokio::test]
async fn all_branch_changes_answers_its_shape() {
    let repo = fixture_repo(REPO);
    repo.add_on_branch(HUMAN, "src/app.ts", "export const app = 1;\n");
    let server = serving(&repo).await;

    let value = of_repo(&server, "AllBranchChanges").await;

    let all: AllBranchChanges = typed(&value);
    let changed = all
        .features
        .iter()
        .find(|each| each.id == HUMAN)
        .expect("the feature");
    assert_eq!(
        (changed.count, changed.added, changed.removed, all.failed),
        (1, 1, 0, false)
    );
}

#[tokio::test]
async fn workflow_message_answers_its_shape() {
    let (_repo, server) = served().await;
    let args =
        |folder: &str, trigger: &str| json!({ "repo": REPO, "folder": folder, "trigger": trigger });

    let value = read(&server, "WorkflowMessage", args(AGENT, "approval")).await;
    let comments = read(&server, "WorkflowMessage", args(AGENT, "comments")).await;

    let message: WorkflowMessage = typed::<Option<WorkflowMessage>>(&value).expect("the message");
    assert_eq!(message.refusal, None);
    assert_eq!(message.step, "plan");
    assert_eq!(
        message.text,
        format!(
            "/uraeda Continue the feature specs/{AGENT}/ on branch {AGENT}: Write the plan, \
             starting with skills/uraeda/references/plan.md.\nStop when the plan waits for my \
             review, and earlier only if you need a decision from me.\n"
        )
    );
    // The comments message runs whatever the step, from the implementation's reference.
    assert_eq!(
        comments["text"],
        format!(
            "/uraeda Continue the feature specs/{AGENT}/ on branch {AGENT}: Address the comments \
             on its pull request, starting with skills/uraeda/references/implementation.md.\n\
             Stop when the pull request is ready for review again, and earlier only if you need \
             a decision from me.\n"
        )
    );
    // A feature that waits on the human has nothing to continue, and says so.
    let gate = read(&server, "WorkflowMessage", args(HUMAN, "manual")).await;
    let refusal = "The feature waits on you now: there is nothing to continue.";
    assert_eq!(
        gate,
        json!({ "refusal": refusal, "step": "human-gate", "text": "" })
    );
    let unknown = read(
        &server,
        "WorkflowMessage",
        args("2026-01-01-nothing", "start"),
    )
    .await;
    assert_eq!(unknown, Value::Null);
}

#[tokio::test]
async fn postpone_message_answers_its_shape() {
    let (_repo, server) = served().await;

    let postpone = of_item(&server, "PostponeMessage", AGENT).await;
    let unknown = of_item(&server, "PostponeMessage", "2026-01-01-nothing").await;

    let message: PostponeMessage =
        typed::<Option<PostponeMessage>>(&postpone).expect("the message");
    assert_eq!(message.refusal, None);
    assert_eq!(
        message.text,
        format!(
            "/uraeda Postpone the feature specs/{AGENT}/ on branch {AGENT}, following \"Postpone \
             or block\" in skills/uraeda/references/projects.md: write its proposal, and move \
             its line to Later.\nStop when it is postponed, and earlier only if you need a \
             decision from me.\n"
        )
    );
    assert_eq!(unknown, Value::Null);
}

#[tokio::test]
async fn recommended_message_answers_its_shape() {
    // A message is recommended only to an agent that takes it: the fake stands for one.
    let repo = fixture_repo(REPO);
    let only_fake = "[extensions.claude]\non = []\n\n[extensions.codex]\non = []\n";
    let setup = crate::support::setup().config("config.toml", only_fake);
    let server = setup.folder(repo.path()).start().await;
    let fake = std::sync::Arc::new(uraeda_server::runtimes::fake::Fake::new());
    drop(uraeda_server::runtimes::register(server.shared(), "fake", fake).expect("the fake"));
    let runtimes = server.shared().get::<uraeda_server::runtimes::Runtimes>();
    let checked = tokio::task::spawn_blocking(move || runtimes.check());
    checked.await.expect("the runtimes are checked");

    let value = of_item(&server, "RecommendedMessage", AGENT).await;

    let message: RecommendedMessage =
        typed::<Option<RecommendedMessage>>(&value).expect("the message");
    assert_eq!(message.trigger, Some(Trigger::Manual));
    assert_eq!(message.step.as_deref(), Some("plan"));
    let name = "Continue, write the plan";
    assert_eq!(message.name.as_deref(), Some(name));
    assert!(
        message.text.starts_with("/uraeda Continue the feature"),
        "{}",
        message.text
    );
    // At a gate, no message is recommended, and the record says why.
    let gate = of_item(&server, "RecommendedMessage", HUMAN).await;
    assert_eq!(
        gate["reason"],
        "No recommended message: the feature waits on you"
    );
    assert_eq!(
        (&gate["text"], &gate["trigger"]),
        (&json!(""), &Value::Null)
    );
}
