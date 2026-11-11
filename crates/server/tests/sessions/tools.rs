//! The agents a workflow run starts through `/mcp`: an implementer of a task, with
//! `run_agent`, and a review's reviewers, with `review`.

use std::fs;

use serde_json::{Value, json};
use uraeda_server::runtimes::Tools;

use super::{AGENT, REPO, Stage, script, stage, staged};

/// A workflow session of the fixture's feature that waits on the agent, its turn left open,
/// as an agent at work: the session, and its process's token of the MCP endpoint.
async fn workflow(stage: &Stage) -> (String, String) {
    let run = json!({
        "folder": AGENT,
        "text": "/uraeda Continue the feature.",
        "workflow": { "trigger": "manual" },
    });
    let sent = stage.done("session.send", run).await;
    let session = sent["session"].as_str().expect("a session").to_owned();
    stage
        .turn_in(sent["turn"].as_str().expect("a turn"), "running")
        .await;
    let opened = stage.fake.opens().pop().expect("the session's process");
    let Tools::Uraeda { token, url } = opened.tools else {
        panic!("a workflow session gets Uraeda's tools: {:?}", opened.tools);
    };
    assert_eq!(url, format!("{}/mcp", stage.server.address()));
    (session, token)
}

/// Calls a tool of `/mcp` with a process's token: its text, or its error's.
async fn tool(stage: &Stage, token: &str, name: &str, arguments: Value) -> Result<String, String> {
    let message = json!({
        "jsonrpc": "2.0",
        "id": 7,
        "method": "tools/call",
        "params": { "name": name, "arguments": arguments },
    });
    let accept = "application/json, text/event-stream";
    let request = stage
        .server
        .post("/mcp")
        .bearer(token)
        .header("accept", accept);
    let answer = request.json(&message).send().await;
    assert_eq!(answer.status, 200, "{}", answer.text());
    let text = answer.text();
    let data = text
        .lines()
        .filter_map(|line| line.strip_prefix("data: "))
        .next_back();
    let answer: Value = serde_json::from_str(data.unwrap_or(&text)).expect("a JSON-RPC answer");
    let result = &answer["result"];
    let said = result["content"][0]["text"]
        .as_str()
        .expect("a tool's text")
        .to_owned();
    match result["isError"] == true {
        true => Err(said),
        false => Ok(said),
    }
}

/// A linked worktree for a task of the feature, on a branch named after the feature's.
fn task_worktree(stage: &Stage, task: &str) -> String {
    let path = stage
        .repo
        .path()
        .join(".worktrees")
        .join(format!("{AGENT}-{task}"));
    let (path, branch) = (
        path.to_string_lossy().into_owned(),
        format!("{AGENT}-{task}"),
    );
    stage
        .repo
        .git(&["worktree", "add", "--quiet", "-b", &branch, &path, AGENT]);
    path
}

// A workflow run's implementer is a session Uraeda starts, in its task's worktree, with
// neither sub-agents nor tools of its own: `run_agent` answers its last message, the same task
// asked again answers the same session, and a worktree that is no task's is refused.
#[tokio::test]
async fn run_agent_runs_a_task_in_a_sub_session_and_answers_its_last_message() {
    let stage = stage().await;
    stage.fake.fallback(|message| {
        let builds = message.text == "Build task 1.";
        builds.then(|| script(json!([{ "type": "text", "text": "Task 1 is built." }])))
    });
    let (parent, token) = workflow(&stage).await;
    let worktree = task_worktree(&stage, "task-1");
    let task = json!({ "task": "Task 1", "prompt": "Build task 1.", "worktree": worktree });

    let answer = tool(&stage, &token, "run_agent", task.clone()).await;
    assert_eq!(answer.as_deref(), Ok("Task 1 is built."));
    let opens = stage.fake.opens();
    let implementer = opens.last().expect("the implementer's process");
    assert_eq!(implementer.cwd, fs::canonicalize(&worktree).unwrap());
    assert_eq!(implementer.tools, Tools::None);
    let session = stage.read("Session", &parent).await;
    let subs = session["subSessions"].as_array().expect("its sub-sessions");
    let listed: Vec<_> = subs
        .iter()
        .map(|sub| (&sub["role"], &sub["about"], &sub["state"]))
        .collect();
    assert_eq!(
        listed,
        [(&json!("implementer"), &json!("Task 1"), &json!("done"))]
    );
    // The sub-session is none of the sidebar's, and never its feature's latest session.
    let list = crate::support::read(&stage.server, "SessionList", json!({ "repo": REPO })).await;
    let ids: Vec<&Value> = list["rows"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| &row["id"])
        .collect();
    assert_eq!(ids, [&json!(parent)]);

    // The same task again answers the first call's result, and starts nothing.
    let again = tool(&stage, &token, "run_agent", task).await;
    assert_eq!(again.as_deref(), Ok("Task 1 is built."));
    assert_eq!(stage.fake.opens().len(), opens.len());

    // The main checkout is no task's worktree.
    let main = stage.repo.path().to_string_lossy().into_owned();
    let wrong = json!({ "task": "Task 2", "prompt": "Build task 2.", "worktree": main });
    let refused = tool(&stage, &token, "run_agent", wrong).await.unwrap_err();
    assert!(
        refused.contains("is the main checkout, not a worktree of a task"),
        "{refused}"
    );

    // An implementer that fails says why, as the tool's error.
    stage.fake.fallback(|_| {
        let failed = json!({
            "type": "result", "ok": false, "interrupted": false, "denials": [],
            "errors": ["The tests do not pass."],
        });
        Some(script(json!([failed])))
    });
    let worktree = task_worktree(&stage, "task-3");
    let failing = json!({ "task": "Task 3", "prompt": "Build task 3.", "worktree": worktree });
    let failed = tool(&stage, &token, "run_agent", failing)
        .await
        .unwrap_err();
    assert_eq!(
        failed,
        "The implementer of Task 3 failed: The tests do not pass."
    );
    stage.server.stop().await;
}

// A review runs every reviewer of the feature at once, an agent in a sub-session of its own
// and a command in the feature's worktree, then commits their findings in the feature's
// folder, a section each: the tool answers the file's path and its text.
#[tokio::test]
async fn review_runs_every_reviewer_and_commits_their_findings() {
    let reviewers = "[[runs.reviewers]]\nagent = \"fake\"\n\n\
                     [[runs.reviewers]]\ncommand = \"echo lint: clean\"\n";
    let stage = staged(reviewers).await;
    stage.fake.fallback(|message| {
        let reviews = message
            .text
            .starts_with("Review the code changes of the commits");
        reviews.then(|| script(json!([{ "type": "text", "text": "- src/a.rs:1 leaks." }])))
    });
    let (parent, token) = workflow(&stage).await;
    let commit = |name: &str| stage.repo.git(&["rev-parse", name]).trim().to_owned();
    let (base, head) = (commit("main"), commit(AGENT));
    let review = json!({ "reviewed": "branch", "base": base, "head": head });

    let answer = tool(&stage, &token, "review", review)
        .await
        .expect("the findings");
    let (path, text) = answer.split_once("\n\n").expect("a path, then the text");
    assert!(
        path.ends_with(&format!("specs/{AGENT}/findings-01.md")),
        "{path}"
    );
    assert_eq!(fs::read_to_string(path).unwrap(), text);
    assert!(text.contains("- src/a.rs:1 leaks."), "{text}");
    assert!(text.contains("lint: clean"), "{text}");
    assert!(
        text.contains("## echo lint: clean"),
        "a section per reviewer: {text}"
    );
    // Committed alone, on the feature's branch.
    let subject = stage.repo.git(&["log", "-1", "--format=%s", AGENT]);
    assert_eq!(subject.trim(), "review(cli-tuis): findings 01");
    let session = stage.read("Session", &parent).await;
    assert_eq!(session["subSessions"][0]["role"], "reviewer");
    assert_eq!(session["subSessions"][0]["state"], "done");
    // Its title names the reviewer, without the commits that tell its reviews apart.
    let about = session["subSessions"][0]["about"]
        .as_str()
        .expect("its title");
    assert!(!about.is_empty() && !about.contains(&base), "{about}");
    stage.server.stop().await;
}
