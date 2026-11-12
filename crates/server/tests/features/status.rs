//! Whose move a started feature's status says, in every place that reads it at once: the
//! workspace, the feature's record, and what needs the human. A feature whose step waits on an
//! agent that no run follows waits for the human's Continue, as a start never spends an agent's
//! time by itself; a dropped one is in flight nowhere.

use serde_json::{Value, json};

use super::{AGENT, REPO, done, idle, of_item, of_repo, served};
use crate::support::read;

const LISTENER: &str = "specs/proposals/git-listener.md";

/// The feature of a workspace, by its folder, if it lists it.
fn feature<'a>(workspace: &'a Value, folder: &str) -> Option<&'a Value> {
    let features = workspace["features"].as_array().expect("features");
    features.iter().find(|feature| feature["folder"] == folder)
}

/// The rows of what needs the human that are of this folder.
async fn asking(server: &crate::support::TestServer, folder: &str) -> Vec<Value> {
    let list = read(server, "NeedsYouList", Value::Null).await;
    let rows = list["rows"].as_array().expect("rows").clone();
    rows.into_iter()
        .filter(|row| row["folder"] == folder)
        .collect()
}

// The break it catches: a started feature reading "Idle" on Home and "An agent's turn" in the
// priorities while nothing will move it but the human's Continue.
#[tokio::test]
async fn a_started_feature_no_run_follows_waits_for_the_humans_continue() {
    let (_repo, server) = served().await;
    let plan = done(&server, "feature.start", json!({ "proposal": LISTENER })).await;
    assert_eq!(idle(&server, REPO).await, Vec::<String>::new());
    let folder = plan["folder"].as_str().expect("the folder");

    let workspace = of_repo(&server, "Workspace").await;
    let status = &feature(&workspace, folder).expect("the feature")["status"];
    let expected = json!({ "status": "needs-you", "reason": "continue" });
    assert_eq!(
        json!({ "status": status["status"], "reason": status["reason"] }),
        expected
    );
    assert_eq!(status["label"], "Waits for your Continue");
    // Its page says the same.
    let record = of_item(&server, "Feature", folder).await;
    assert_eq!(&record["status"], status);
    let rows = asking(&server, folder).await;
    assert_eq!(rows.len(), 1, "{rows:?}");
    assert_eq!(rows[0]["reason"], "continue");
    // What its Continue does, in its page's button's words.
    assert_eq!(
        rows[0]["message"],
        "Continue, investigate it and ask me your questions"
    );
    assert_eq!(rows[0]["href"], format!("/r/{REPO}/f/{folder}"));
}

// The break it catches: a dropped feature, whose branch stays, read as waiting for the human's
// Continue, or still linked by a line that keeps it in Home's In progress, while the priorities
// dropped it.
#[tokio::test]
async fn a_dropped_feature_asks_nothing_and_no_line_holds_it() {
    let (_repo, server) = served().await;
    assert_eq!(
        asking(&server, AGENT).await.len(),
        1,
        "it waits for Continue"
    );

    done(&server, "feature.drop", json!({ "folder": AGENT })).await;
    assert_eq!(idle(&server, REPO).await, Vec::<String>::new());

    let workspace = of_repo(&server, "Workspace").await;
    // Its branch stays, so the workspace still reads it, at rest.
    let dropped = feature(&workspace, AGENT).expect("its branch's feature");
    assert_eq!(dropped["status"]["status"], "idle");
    let lines = workspace["priorities"].as_array().expect("the priorities");
    assert!(
        lines.iter().all(|line| line["feature"] != AGENT),
        "{lines:?}"
    );
    assert_eq!(asking(&server, AGENT).await, Vec::<Value>::new());
}
