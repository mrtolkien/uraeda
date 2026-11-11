//! The endpoint's tools: what an agent reads of each, the check of its arguments, and the
//! [`Runner`] that does what it says, which the sessions give.

use std::pin::Pin;
use std::sync::Arc;

use serde_json::{Value, json};

/// What a tool's call answers, once it ends: its text, or as `Err`, its refusal, which the agent
/// reads as the tool's error.
///
/// The future is dropped when the call's client cancels it, or when its connection drops: what
/// must stop with the call, as an agent it runs, stops as the future is dropped.
pub type Answer = Pin<Box<dyn Future<Output = Result<String, String>> + Send>>;

/// What runs the tools that start agents: the sessions, given with [`Mcp::serve`](super::Mcp).
/// `session` is the one whose process calls: the tool's token was issued to it.
pub trait Runner: Send + Sync + 'static {
    /// `run_agent`: runs one task of the plan in a sub-session of `session`, and answers the
    /// implementer's last message. The same task again answers the first call's result.
    fn run_agent(&self, session: &str, input: RunAgent) -> Answer;

    /// `review`: has the commits of `session`'s feature reviewed by every reviewer at once, and
    /// answers the findings' path and text.
    fn review(&self, session: &str, input: Review) -> Answer;
}

/// The arguments of `run_agent`, each a text that is not blank, trimmed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunAgent {
    /// The task's name, as the plan gives it: `Task 4`.
    pub task: String,
    /// Everything the implementer needs, its only context.
    pub prompt: String,
    /// The absolute path of the task's worktree.
    pub worktree: String,
}

/// The arguments of `review`, each trimmed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Review {
    /// What is reviewed: `branch`, or `wave <N>`.
    pub reviewed: String,
    /// The commit the reviewed changes start after: one word, without a colon.
    pub base: String,
    /// The last commit reviewed: one word, without a colon.
    pub head: String,
    /// What the reviewers should know, when given.
    pub context: Option<String>,
}

/// A tool, as the endpoint lists it and calls it.
pub(super) struct Tool {
    pub name: &'static str,
    description: &'static str,
    /// The JSON schema of its arguments.
    schema: fn() -> Value,
    /// Checks the arguments, and starts the call.
    start: fn(&dyn Runner, &str, &Value) -> Result<Answer, String>,
}

/// The endpoint's tools, as `tools/list` gives them.
const TOOLS: [Tool; 2] = [
    Tool {
        name: "run_agent",
        description: "Runs one task of the plan as an implementer: a new agent session in the \
            task's worktree, on the implementers' agent, model, and effort, given `prompt` as \
            its only context. Answers with the implementer's last message once it ends. Call it \
            once per task, several at once for a wave's tasks. The same `task` again answers the \
            first call's result, without starting another session.",
        schema: run_agent_schema,
        start: |runner, session, input| Ok(runner.run_agent(session, run_agent(input)?)),
    },
    Tool {
        name: "review",
        description: "Reviews the feature's commits `base..head` with every reviewer of the \
            feature at once, each an agent's own review in its own session or a command, then \
            commits their findings in the feature's folder as the next findings-NN.md. Answers \
            with the file's path and its text, a section per reviewer. When a hook refuses the \
            commit, it answers `not committed:` with the hook's output, after the file's path \
            when the file is left written: fix what the hook says, then call it again with the \
            same `reviewed`, `base`, and `head`, which commits the findings and runs no \
            reviewer. Call it once per review: after a wave is merged, with `reviewed` \
            `wave <N>`, and on the whole branch, with `reviewed` `branch`.",
        schema: review_schema,
        start: |runner, session, input| Ok(runner.review(session, review(input)?)),
    },
];

/// The names of the endpoint's tools: a runtime allows each, as its agent names it.
pub(super) fn names() -> Vec<&'static str> {
    TOOLS.iter().map(|tool| tool.name).collect()
}

/// The tool of this name.
pub(super) fn find(name: &str) -> Option<&'static Tool> {
    TOOLS.iter().find(|tool| tool.name == name)
}

/// The tools, as `tools/list` answers them.
pub(super) fn listed() -> Vec<Value> {
    let listed = |tool: &Tool| {
        json!({
            "description": tool.description,
            "inputSchema": (tool.schema)(),
            "name": tool.name,
        })
    };
    TOOLS.iter().map(listed).collect()
}

/// Starts a call of a tool for `session`: its answer, which is the tool's error at once for
/// arguments that are not the tool's, and while nothing runs the tools.
pub(super) fn start(
    tool: &Tool,
    runner: Option<Arc<dyn Runner>>,
    session: &str,
    input: &Value,
) -> Answer {
    let started = match runner {
        Some(runner) => (tool.start)(runner.as_ref(), session, input),
        None => Err(format!(
            "`{}` is not available: this server runs no agent yet.",
            tool.name
        )),
    };
    started.unwrap_or_else(|refusal| Box::pin(async move { Err(refusal) }))
}

fn run_agent_schema() -> Value {
    json!({
        "properties": {
            "prompt": {
                "description":
                    "Everything the implementer needs: the task, its files, and how to check it.",
                "type": "string",
            },
            "task": {
                "description": "The task's name, as the plan gives it: `Task 4`.",
                "type": "string",
            },
            "worktree": {
                "description": "The absolute path of the task's worktree, one of the \
                    repository's linked worktrees, on a branch named after the feature's: \
                    `<feature-branch>-task-4`.",
                "type": "string",
            },
        },
        "required": ["task", "prompt", "worktree"],
        "type": "object",
    })
}

fn review_schema() -> Value {
    json!({
        "properties": {
            "base": {
                "description": "The commit the reviewed changes start after.",
                "pattern": "^[^\\s:]+$",
                "type": "string",
            },
            "context": {
                "description":
                    "What the reviewers should know: what the changes do, what to look at.",
                "type": "string",
            },
            "head": {
                "description": "The last commit reviewed.",
                "pattern": "^[^\\s:]+$",
                "type": "string",
            },
            "reviewed": {
                "description": "What is reviewed: `wave 2`, or `branch`.",
                "pattern": "^(branch|wave [0-9]+)$",
                "type": "string",
            },
        },
        "required": ["reviewed", "base", "head"],
        "type": "object",
    })
}

/// An argument's text, trimmed: empty when it is absent, or not a text.
fn text<'a>(input: &'a Value, name: &str) -> &'a str {
    input
        .get(name)
        .and_then(Value::as_str)
        .map_or("", str::trim)
}

/// The arguments of `run_agent`, each a text that is not blank: else refused, saying which.
fn run_agent(input: &Value) -> Result<RunAgent, String> {
    let given = |name: &str| match text(input, name) {
        "" => Err(format!("run_agent needs `{name}`, a text.")),
        given => Ok(given.to_owned()),
    };
    let (prompt, task, worktree) = (given("prompt")?, given("task")?, given("worktree")?);
    Ok(RunAgent {
        task,
        prompt,
        worktree,
    })
}

/// The arguments of `review`: `reviewed` is `branch` or `wave <N>`, `base` and `head` each a
/// commit, one word without a colon, as a reviewer's message and the findings name the range,
/// and `context` is optional. Checked before any reviewer runs.
fn review(input: &Value) -> Result<Review, String> {
    let commit = |name: &str| {
        let given = text(input, name);
        let word = !given.is_empty() && !given.contains(|c: char| c.is_whitespace() || c == ':');
        match word {
            true => Ok(given.to_owned()),
            false => Err(format!(
                "review needs `{name}`, a commit, one word without a colon."
            )),
        }
    };
    let (base, head) = (commit("base")?, commit("head")?);
    let reviewed = text(input, "reviewed");
    let wave = reviewed.strip_prefix("wave ").is_some_and(|number| {
        !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit())
    });
    if reviewed != "branch" && !wave {
        return Err("review needs `reviewed`, `branch` or `wave <N>`.".to_owned());
    }
    let context = Some(text(input, "context")).filter(|context| !context.is_empty());
    Ok(Review {
        reviewed: reviewed.to_owned(),
        base,
        head,
        context: context.map(str::to_owned),
    })
}
