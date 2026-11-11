//! Codex's `app-server` notifications into agent-neutral events. Codex's formats stay here and
//! in `items.rs`: the field names follow the protocol's generated types, `ServerNotification`
//! and `ThreadItem` (Codex 0.163.0).

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use super::items::{end_of, review_notice, tokens_of, tool_of};
use super::json::{Object, filled, object, text, texts, truthy};
use super::limits;
use super::target::effort_name;
use crate::runner::{Activity, Event};

/// The account's rate-limit bucket, as against a model's own.
const CODEX_BUCKET: &str = "codex";

/// The events of one Codex process's notifications, read in order. It keeps what a notification
/// alone does not say: the session's thread and its sub-agents' threads, the text streamed by
/// each message, the tool items already started, and the last usage report.
pub(super) struct Reader {
    /// The session's directory, which makes targets under it relative.
    cwd: String,
    /// Each model's name for people, by its id, from the runtime's model list.
    names: HashMap<String, String>,
    thread: Option<String>,
    /// The effort the thread's settings name: none at the default.
    effort: Option<String>,
    /// The effort Codex resolved the thread to at its start, the default's when none is named.
    resolved: Option<String>,
    texts: HashMap<String, String>,
    started: HashSet<String>,
    /// The sub-agents' threads, by the tool call that spawned each.
    children: HashMap<String, String>,
    limits: Option<Value>,
}

impl Reader {
    pub(super) fn new(cwd: &str) -> Reader {
        Reader {
            cwd: cwd.to_owned(),
            names: HashMap::new(),
            thread: None,
            effort: None,
            resolved: None,
            texts: HashMap::new(),
            started: HashSet::new(),
            children: HashMap::new(),
            limits: None,
        }
    }

    /// Names a model for people, from now on.
    pub(super) fn name(&mut self, id: &str, name: &str) {
        self.names.insert(id.to_owned(), name.to_owned());
    }

    /// The events of one notification: none for one Uraeda has no use for.
    pub(super) fn read(&mut self, method: &str, params: &Value) -> Vec<Event> {
        if !params.is_object() {
            return Vec::new();
        }
        if method == "thread/started" {
            return self.thread_started(params.get("thread"));
        }
        if method == "account/rateLimits/updated" {
            return self.rate_limits(params.get("rateLimits"));
        }
        // The session's own thread, a sub-agent's under its call, or neither.
        let Some(parent) = self.scope(params) else {
            return Vec::new();
        };
        if method.starts_with("item/") {
            return self.item(method, params, parent.as_deref());
        }
        if parent.is_some() {
            return Vec::new();
        }
        self.own(method, params)
    }

    /// The session's thread starting gives its id, and what it runs on when it says: a resumed
    /// thread gets no settings update. A sub-agent's thread gives none.
    fn thread_started(&mut self, thread: Option<&Value>) -> Vec<Event> {
        let Some(thread) = thread.filter(|thread| thread.is_object()) else {
            return Vec::new();
        };
        let id = thread.get("id").and_then(Value::as_str);
        let Some(id) = id.filter(|_| !truthy(thread, "parentThreadId")) else {
            return Vec::new();
        };
        self.thread = Some(id.to_owned());
        if let Some(effort) = filled(thread, "reasoningEffort") {
            self.resolved = Some(effort.to_owned());
        }
        let init = Event::Init {
            session_id: id.to_owned(),
            problem: None,
        };
        let mut events = vec![init];
        events.extend(self.runs_on(text(thread, "model")));
        events
    }

    /// A notification's thread: the session's own, with no parent, or a sub-agent's under its
    /// call; for any other, none.
    fn scope(&mut self, params: &Value) -> Option<Option<String>> {
        let Some(thread) = params.get("threadId").and_then(Value::as_str) else {
            return Some(None);
        };
        if self.thread.as_deref() == Some(thread) {
            return Some(None);
        }
        if let Some(parent) = self.children.get(thread) {
            return Some(Some(parent.clone()));
        }
        // A resumed thread may not report its start: the first thread heard from is the
        // session's.
        if self.thread.is_none() {
            self.thread = Some(thread.to_owned());
            return Some(None);
        }
        None
    }

    /// The usage windows of a sparse report, merged over the last, and a limit it says was
    /// reached. Only the account's bucket, `codex` (or unnamed in a sparse report), counts: a
    /// per-model bucket's windows and limit are that model's alone.
    fn rate_limits(&mut self, report: Option<&Value>) -> Vec<Event> {
        let Some(report) = report.and_then(Value::as_object) else {
            return Vec::new();
        };
        let account = match report.get("limitId") {
            None | Some(Value::Null) => true,
            Some(bucket) => bucket.as_str() == Some(CODEX_BUCKET),
        };
        if !account {
            return Vec::new();
        }
        let last = self.limits.as_ref().and_then(Value::as_object);
        let mut merged: Object = last.cloned().unwrap_or_default();
        for (key, value) in report {
            if !value.is_null() || key == "rateLimitReachedType" {
                merged.insert(key.clone(), value.clone());
            }
        }
        let merged = Value::Object(merged);
        let windows = limits::windows(&merged);
        let limit = limits::limit(Some(&merged), None);
        self.limits = Some(merged);
        let usage = (!windows.is_empty()).then_some(Event::Usage { windows });
        let limit = limit.map(|limit| Event::Limit { limit });
        usage.into_iter().chain(limit).collect()
    }

    /// The session's thread's own notifications: its settings, tokens, and turns.
    fn own(&mut self, method: &str, params: &Value) -> Vec<Event> {
        let none = Value::Null;
        match method {
            "thread/settings/updated" => {
                let settings = object(params, "threadSettings").unwrap_or(&none);
                self.effort = filled(settings, "effort").map(str::to_owned);
                self.runs_on(text(settings, "model"))
            }
            "model/rerouted" => self.runs_on(text(params, "toModel")),
            "thread/tokenUsage/updated" => {
                let usage = object(params, "tokenUsage").unwrap_or(&none);
                tokens_of(usage.get("total")).into_iter().collect()
            }
            "turn/completed" => self.turn_completed(object(params, "turn").unwrap_or(&none)),
            _ => Vec::new(),
        }
    }

    /// What the thread runs on: at the default effort, the one Codex resolved.
    fn runs_on(&self, model: &str) -> Vec<Event> {
        if model.is_empty() {
            return Vec::new();
        }
        let effort = self.effort.as_deref().or(self.resolved.as_deref());
        let name = self.names.get(model).map_or(model, String::as_str);
        vec![Event::RunsOn {
            model: name.to_owned(),
            effort: effort.map(|effort| effort_name(effort).to_owned()),
        }]
    }

    /// A turn's end: its usage limit first, when one refused it, then its result.
    fn turn_completed(&self, turn: &Value) -> Vec<Event> {
        let status = text(turn, "status");
        let error = object(turn, "error");
        let failed = status == "failed";
        let limit = failed.then(|| limits::limit(self.limits.as_ref(), error));
        let message = error.and_then(|error| filled(error, "message"));
        let errors = failed.then(|| message.unwrap_or("The turn failed.").to_owned());
        let result = Event::Result {
            cost_usd: None,
            denials: Vec::new(),
            errors: errors.into_iter().collect(),
            interrupted: status == "interrupted",
            models: None,
            ok: status == "completed",
        };
        let limit = limit.flatten().map(|limit| Event::Limit { limit });
        limit.into_iter().chain([result]).collect()
    }

    /// An item's notifications: its start, its streamed text, its end, and its review.
    fn item(&mut self, method: &str, params: &Value, parent: Option<&str>) -> Vec<Event> {
        let item = object(params, "item");
        match method {
            "item/started" => item.map_or_else(Vec::new, |item| self.item_started(item, parent)),
            "item/completed" => {
                item.map_or_else(Vec::new, |item| self.item_completed(item, parent))
            }
            "item/agentMessage/delta" if parent.is_none() => {
                self.delta(text(params, "itemId"), text(params, "delta"))
            }
            "item/autoApprovalReview/completed" => {
                review_notice(params.get("review")).into_iter().collect()
            }
            _ => Vec::new(),
        }
    }

    fn delta(&mut self, item: &str, delta: &str) -> Vec<Event> {
        if delta.is_empty() {
            return Vec::new();
        }
        self.texts
            .entry(item.to_owned())
            .or_default()
            .push_str(delta);
        vec![Event::TextDelta {
            text: delta.to_owned(),
        }]
    }

    fn item_started(&mut self, item: &Value, parent: Option<&str>) -> Vec<Event> {
        if text(item, "type") != "reasoning" {
            return self.tool_start(item, parent);
        }
        let thinking = Event::Activity {
            activity: Activity::Thinking,
        };
        parent.is_none().then_some(thinking).into_iter().collect()
    }

    /// A tool item's start, once: an item first seen completed starts as it ends.
    fn tool_start(&mut self, item: &Value, parent: Option<&str>) -> Vec<Event> {
        let id = text(item, "id");
        if id.is_empty() || self.started.contains(id) {
            return Vec::new();
        }
        let Some(tool) = tool_of(item, &self.cwd) else {
            return Vec::new();
        };
        self.started.insert(id.to_owned());
        vec![Event::ToolStart {
            id: id.to_owned(),
            input: tool.input,
            kind: tool.kind,
            name: tool.name,
            parent: parent.map(str::to_owned),
            subagent: tool.subagent,
            target: tool.target,
        }]
    }

    fn item_completed(&mut self, item: &Value, parent: Option<&str>) -> Vec<Event> {
        let id = text(item, "id");
        match text(item, "type") {
            "agentMessage" => {
                let streamed = self.texts.remove(id).unwrap_or_default();
                // A sub-agent's text is not the session's: only its tools and thoughts are
                // shown.
                let whole = filled(item, "text").map_or(streamed, str::to_owned);
                let shown = parent.is_none() && !whole.is_empty();
                return shown
                    .then_some(Event::Text { text: whole })
                    .into_iter()
                    .collect();
            }
            "reasoning" => {
                let summary = texts(item, "summary").join("\n\n");
                let said = if summary.is_empty() {
                    texts(item, "content").join("\n\n")
                } else {
                    summary
                };
                return vec![Event::Thought {
                    parent: parent.map(str::to_owned),
                    text: (!said.is_empty()).then_some(said),
                }];
            }
            "collabAgentToolCall" if text(item, "tool") == "spawnAgent" => {
                for thread in texts(item, "receiverThreadIds") {
                    self.children.insert(thread.to_owned(), id.to_owned());
                }
            }
            _ => {}
        }
        let mut events = self.tool_start(item, parent);
        if !self.started.remove(id) {
            return Vec::new();
        }
        let (is_error, output) = end_of(item);
        events.push(Event::ToolEnd {
            id: id.to_owned(),
            is_error,
            output,
        });
        events
    }
}
