//! Accounts, on the fake runtime with scripted accounts: the account a new session picks and
//! keeps, the refusal when none is signed in, and the move of a run a usage limit refused. The
//! pick's rule row by row is the unit test of `runtimes/accounts.rs`; Claude Code's folders are
//! in `claude/accounts.rs`.

use crate::support;

use std::sync::Arc;

use serde_json::{Value, json};
use support::{Held, TestRepo, TestServer, fixture_repo};
use uraeda_server::runtimes::fake::{Fake, Script};
use uraeda_server::runtimes::{self, Account, AccountState, AccountWindow, Runtimes};

const REPO: &str = "todo-app";

/// The built-in runtimes off: the fake is the one a new session runs on.
const FAKE_ONLY: &str = "[extensions.claude]\non = []\n\n[extensions.codex]\non = []\n";

/// A known, signed-in account with its five hours used by `five`, and its week by `week`.
fn account(id: &str, five: f64, week: f64) -> Account {
    let window = |id: &str, used| AccountWindow {
        id: id.to_owned(),
        label: id.to_owned(),
        resets_at: None,
        used,
    };
    Account {
        id: format!("/accounts/{id}"),
        name: id.to_owned(),
        state: AccountState::Ready,
        windows: vec![window("five_hour", five), window("seven_day", week)],
        asked_at: None,
        known: true,
    }
}

struct Stage {
    _repo: TestRepo,
    server: TestServer,
    fake: Fake,
}

async fn stage(accounts: Vec<Account>) -> Stage {
    let repo = fixture_repo(REPO);
    let setup = support::setup().config("config.toml", FAKE_ONLY);
    let server = setup.folder(repo.path()).start().await;
    let fake = Fake::new();
    fake.set(|behaviour| behaviour.accounts = accounts);
    let registered = runtimes::register(server.shared(), "fake", Arc::new(fake.clone()));
    drop(registered.expect("the fake registers"));
    let runtimes = server.shared().get::<Runtimes>();
    let checked = tokio::task::spawn_blocking(move || runtimes.check());
    checked.await.expect("the runtimes are checked");
    Stage {
        _repo: repo,
        server,
        fake,
    }
}

impl Stage {
    async fn asked(&self, action: &str, mut input: Value) -> Result<Value, support::Refused> {
        input["repo"] = json!(REPO);
        support::call(&self.server, action, input).await
    }

    async fn done(&self, action: &str, input: Value) -> Value {
        let answered = self.asked(action, input).await;
        answered.unwrap_or_else(|refused| panic!("`{action}` is refused: {refused:?}"))
    }

    async fn chat(&self) -> String {
        let made = self.done("session.newChat", json!({})).await;
        made["session"].as_str().expect("a session").to_owned()
    }

    async fn send(&self, session: &str, text: &str) -> String {
        let sent = self
            .done("session.send", json!({ "session": session, "text": text }))
            .await;
        sent["turn"].as_str().expect("a turn").to_owned()
    }

    async fn held(&self, record: &str, id: &str) -> Held {
        Held::open(&self.server, record, json!({ "repo": REPO, "id": id })).await
    }

    async fn turn_in(&self, turn: &str, state: &str) {
        let mut held = self.held("Turn", turn).await;
        held.until(&format!("turn {turn} {state}"), |turn| {
            turn["state"] == state
        })
        .await;
    }

    /// Waits until the record `Agent` lists the fake's accounts as `expected`: each by its
    /// name, and `next` on the one a new session would start on. A read asks their usage.
    async fn listed(&self, expected: &[&str]) {
        let args = json!({ "repo": REPO });
        let mut held = Held::open(&self.server, "Agent", args).await;
        let what = format!("the accounts to read {expected:?}");
        held.until(&what, |agent| names(agent) == expected).await;
    }

    /// The account each process opened on, by name.
    fn opened_on(&self) -> Vec<Option<String>> {
        let opens = self.fake.opens().into_iter();
        let name = |id: String| id.trim_start_matches("/accounts/").to_owned();
        opens.map(|options| options.account.map(name)).collect()
    }
}

/// The fake's accounts in the record `Agent`, by name, `next` on the one a session would pick.
fn names(agent: &Value) -> Vec<String> {
    let runtimes = agent["runtimes"].as_array().unwrap();
    let fake = runtimes
        .iter()
        .find(|runtime| runtime["id"] == "fake")
        .unwrap();
    let accounts = fake["accounts"].as_array().unwrap().iter();
    let named = |account: &Value| {
        let name = account["name"].as_str().unwrap();
        match account["isNext"] == true {
            true => format!("{name} next"),
            false => name.to_owned(),
        }
    };
    accounts.map(named).collect()
}

fn script(steps: Value) -> Script {
    serde_json::from_value(steps).expect("a script")
}

/// A turn a usage limit of `kind` refuses.
fn limited(kind: &str) -> Script {
    script(json!([
        { "type": "limit", "limit": { "kind": kind, "resetsAt": "2026-11-10T14:00:00Z" } },
        { "type": "result", "ok": false, "interrupted": false, "denials": [],
          "errors": ["You have hit your limit."] },
    ]))
}

fn done_turn() -> Script {
    script(json!([{ "type": "text", "text": "Done." }]))
}

// The multi-accounts record: a new session starts on the account with the most of its five
// hours left, says so in its record, and keeps it from its first started turn on, whatever
// the usage does after. With none signed in, its turn is refused in the record's words.
#[tokio::test]
async fn a_session_picks_the_account_with_the_most_of_its_five_hours_left_and_keeps_it() {
    let stage = stage(vec![account("a", 0.6, 0.1), account("b", 0.2, 0.1)]).await;
    stage.listed(&["a", "b next"]).await;
    stage.fake.script(done_turn());
    stage.fake.script(done_turn());
    let chat = stage.chat().await;
    let first = stage.send(&chat, "Read the README").await;
    stage.turn_in(&first, "done").await;
    let session = stage.held("Session", &chat).await.value;
    assert_eq!(
        (&session["account"], &session["accountId"]),
        (&json!("b"), &json!("/accounts/b"))
    );

    // b fills up: the session keeps it, and a new one would start on a.
    stage.fake.set(|behaviour| {
        behaviour.accounts = vec![account("a", 0.1, 0.1), account("b", 0.9, 0.1)];
    });
    let second = stage.send(&chat, "And the license?").await;
    stage.turn_in(&second, "done").await;
    // The accounts are asked again with the runtimes' check, every minute.
    tokio::time::pause();
    tokio::time::advance(std::time::Duration::from_secs(61)).await;
    tokio::time::resume();
    stage.listed(&["a next", "b"]).await;
    assert!(
        stage
            .opened_on()
            .iter()
            .all(|on| on.as_deref() == Some("b")),
        "{:?}",
        stage.opened_on()
    );
    assert!(stage.fake.account_asks() > 0, "the pick asks the usage");

    // None signed in: a new session's turn is refused, and says how to go on.
    stage.fake.set(|behaviour| {
        for account in &mut behaviour.accounts {
            account.state = AccountState::SignedOut;
        }
    });
    let other = stage.chat().await;
    let input = json!({ "session": other, "text": "Hello" });
    let refused = stage
        .asked("session.send", input)
        .await
        .expect_err("refused");
    assert_eq!(
        refused.1,
        "No Fake agent account is signed in: sign one in, or empty Accounts in Settings, \
         Extensions"
    );
    stage.server.stop().await;
}

// The models and run lifecycle decisions: a run a usage limit refused goes on at once on
// another account with room that holds its conversation, in a turn that names it, resuming
// the agent's session there. A weekly limit moves too.
#[tokio::test]
async fn a_run_a_limit_refused_goes_on_at_once_on_another_account() {
    let stage = stage(vec![account("a", 0.1, 0.1), account("b", 0.5, 0.1)]).await;
    stage.fake.script(limited("other"));
    stage.fake.script(done_turn());
    let chat = stage.chat().await;
    let turn = stage.send(&chat, "Rename the helper").await;
    stage.turn_in(&turn, "failed").await;

    let mut held = stage.held("Session", &chat).await;
    let moved = held
        .until("the run to go on", |session| {
            session["turns"].as_array().unwrap().len() == 2 && session["status"] == "unread"
        })
        .await
        .clone();
    assert_eq!(moved["accountId"], "/accounts/b");
    let next = moved["turns"][1].as_str().unwrap();
    let args = json!({ "repo": REPO, "turn": next, "page": 0 });
    let page = support::read(&stage.server, "TurnLog", args).await;
    let texts: Vec<&str> = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["text"].as_str().unwrap_or_default())
        .collect();
    assert_eq!(
        texts,
        [
            "Continued on account b, after a usage limit.",
            "The usage limit was reached, and the session moved to another account. Continue \
             where you left off.",
            "Done.",
        ]
    );
    assert_eq!(
        stage.opened_on(),
        [Some("a".to_owned()), Some("b".to_owned())]
    );
    assert!(
        stage.fake.opens()[1].resume,
        "the conversation goes on there"
    );
    stage.server.stop().await;
}

// No other account has room, or none holds the conversation: the session keeps its account,
// and a session's limit waits for its reset, as it would with one account.
#[tokio::test]
async fn a_run_with_no_other_account_with_room_waits_for_its_reset() {
    let rows = [
        ("the other's week is used up", account("b", 0.0, 1.0), false),
        (
            "the other holds no transcript of it",
            account("b", 0.5, 0.0),
            true,
        ),
    ];
    for (row, other, apart) in rows {
        let stage = stage(vec![account("a", 0.1, 0.1), other]).await;
        if apart {
            let apart = "/accounts/b".to_owned();
            stage.fake.set(|behaviour| {
                behaviour.apart.insert(apart);
            });
        }
        stage.fake.script(limited("session"));
        let chat = stage.chat().await;
        let turn = stage.send(&chat, "Rename the helper").await;
        stage.turn_in(&turn, "failed").await;
        let mut held = stage.held("Session", &chat).await;
        let waits = held
            .until(row, |session| session["wait"]["reason"] == "limit")
            .await
            .clone();
        assert_eq!(waits["accountId"], "/accounts/a", "{row}");
        stage.server.stop().await;
    }
}
