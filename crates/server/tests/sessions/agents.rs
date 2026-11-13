//! The agent a new session runs on: the settings' default agent while it is registered and on
//! in the session's repository, else the first one on there.

use std::sync::Arc;

use serde_json::json;
use uraeda_server::runtimes::fake::Fake;
use uraeda_server::runtimes::{self, Runtimes};

use super::{REPO, stage};
use crate::support::{self, read};

// The Node server's `runs.default_agent`: a new session runs on the agent the settings name,
// and the record of the runtimes lists it first. A name no runtime has is kept as written, and
// the first agent on stays the default.
#[tokio::test]
async fn a_new_session_runs_on_the_default_agent() {
    let stage = stage().await;
    let shared = stage.server.shared();
    let other = runtimes::register(shared, "other", Arc::new(Fake::new())).unwrap();
    let registry = shared.get::<Runtimes>();
    let checked = tokio::task::spawn_blocking(move || registry.check());
    checked.await.expect("the runtimes are checked");
    let agent_of = async |stage: &super::Stage| {
        let chat = stage.chat().await;
        let session = stage.read("Session", &chat).await;
        session["agent"].as_str().expect("an agent").to_owned()
    };
    assert_eq!(agent_of(&stage).await, "fake", "the first agent on");

    let set = |agent: serde_json::Value| {
        support::call(
            &stage.server,
            "settings.setDefaultAgent",
            json!({ "agent": agent }),
        )
    };
    set(json!("other")).await.expect("the default agent is set");

    assert_eq!(agent_of(&stage).await, "other");
    let settings = read(&stage.server, "Settings", json!(null)).await;
    assert_eq!(settings["runs"]["defaultAgent"], "other");
    let agent = read(&stage.server, "Agent", json!({ "repo": REPO })).await;
    let listed: Vec<_> = agent["runtimes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["id"].clone())
        .collect();
    assert_eq!(listed[0], "other", "{listed:?}");

    set(json!("gone"))
        .await
        .expect("a name no runtime has is kept");
    assert_eq!(agent_of(&stage).await, "fake");
    let (_, refused) = set(json!(" ")).await.expect_err("an empty name");
    assert_eq!(refused, "The agent is empty.");
    set(json!(null))
        .await
        .expect("the default agent is removed");
    let settings = read(&stage.server, "Settings", json!(null)).await;
    assert_eq!(settings["runs"]["defaultAgent"], json!(null));
    other.remove();
    stage.server.stop().await;
}
