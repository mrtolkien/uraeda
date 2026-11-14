//! The agents and models a pick chooses among, asked of the agents themselves: Claude Code's
//! `list_models` and `get_settings` control requests, on a short `claude -p` that spends no usage,
//! and Codex's `model/list` and `config/read`, on a short `codex app-server`. Each answers in a
//! few seconds: the pages ask both at once, and keep the answers a while (see `Shared::agents`).
//!
//! A pick names an agent by its command, `claude` or `codex`, and a model by the id the agent
//! lists: `fable`, `claude-fable-5-1`, `gpt-6.1-sol`.

use std::io::{BufRead as _, BufReader, Write as _};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{Value, json};

/// How long an agent may take to list its models.
pub(crate) const PATIENCE: Duration = Duration::from_secs(15);

/// An agent, as a pick offers it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Provider {
    /// Its command: `claude` or `codex`.
    pub id: String,
    /// `Claude Code`.
    pub name: String,
    pub models: Vec<Model>,
    /// Why it lists no model, when it could not: not installed, or no answer.
    pub problem: Option<String>,
}

/// A model of an agent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Model {
    /// The id the agent runs it by: `fable`, `gpt-6.1-sol`.
    pub slug: String,
    /// `Fable 5.2`.
    pub name: String,
    /// Other ids that name it: `claude-fable-5-2`.
    pub aliases: Vec<String>,
    /// Whether the agent runs on it when none is picked.
    pub default: bool,
    pub efforts: Vec<Effort>,
}

/// An effort a model takes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Effort {
    /// `xhigh`.
    pub id: String,
    /// `Extra high`.
    pub label: String,
    pub default: bool,
}

/// Both agents, asked at once: one that cannot answer lists no model, and says why.
pub fn read() -> Vec<Provider> {
    let claude = std::thread::spawn(|| lister("claude", "Claude Code", claude));
    let codex = lister("codex", "Codex", codex);
    let claude = claude
        .join()
        .unwrap_or_else(|_| failed("claude", "Claude Code", "failed"));
    vec![claude, codex]
}

fn lister(id: &str, name: &str, list: fn() -> Result<Vec<Model>, String>) -> Provider {
    match list() {
        Ok(models) => Provider {
            id: id.into(),
            name: name.into(),
            models,
            problem: None,
        },
        Err(why) => failed(id, name, &why),
    }
}

fn failed(id: &str, name: &str, why: &str) -> Provider {
    Provider {
        id: id.into(),
        name: name.into(),
        models: Vec::new(),
        problem: Some(why.into()),
    }
}

/// The agent an agent value names.
pub fn find<'a>(providers: &'a [Provider], agent: &str) -> Option<&'a Provider> {
    providers.iter().find(|p| p.id == agent)
}

/// The model a model value names, by its id or another id of it.
pub fn model<'a>(provider: &'a Provider, value: &str) -> Option<&'a Model> {
    provider
        .models
        .iter()
        .find(|m| m.slug == value || m.aliases.iter().any(|a| a == value))
}

/// An effort's name for people.
fn effort_label(id: &str) -> String {
    match id {
        "xhigh" => "Extra high".into(),
        other => {
            let mut chars = other.chars();
            chars.next().map_or_else(String::new, |first| {
                first.to_uppercase().chain(chars).collect()
            })
        }
    }
}

/// A short process of `program` with `args`, in the home folder, its output read line by line
/// on a thread of its own.
fn start(program: &str, args: &[&str]) -> Result<(Child, mpsc::Receiver<String>), String> {
    start_with(program, args, &[])
}

/// [`start`], with `env` added to the process's environment.
pub(crate) fn start_with(
    program: &str,
    args: &[&str],
    env: &[(String, String)],
) -> Result<(Child, mpsc::Receiver<String>), String> {
    let mut child = Command::new(program)
        .args(args)
        .envs(env.iter().map(|(name, value)| (name, value)))
        .current_dir(std::env::home_dir().unwrap_or_default())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => format!("{program} is not installed"),
            _ => format!("{program} could not start: {e}"),
        })?;
    let stdout = child.stdout.take().ok_or("no output")?;
    let (send, lines) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if send.send(line).is_err() {
                break;
            }
        }
    });
    Ok((child, lines))
}

/// Writes `messages`, one JSON per line, to the process.
pub(crate) fn send(child: &mut Child, messages: &[Value]) {
    if let Some(stdin) = child.stdin.as_mut() {
        for message in messages {
            let _ = writeln!(stdin, "{message}");
        }
        let _ = stdin.flush();
    }
}

/// The next line within the time left, as JSON; `None` once the time is up or the output ends.
pub(crate) fn next(lines: &mpsc::Receiver<String>, until: Instant) -> Option<Value> {
    loop {
        let left = until.checked_duration_since(Instant::now())?;
        let line = lines.recv_timeout(left).ok()?;
        if let Ok(value) = serde_json::from_str(&line) {
            return Some(value);
        }
    }
}

/// Claude Code's models: its `list_models` rows that run unattended, in `auto` mode, but the
/// `default` row; its configured model, from `get_settings`, marked default, with its effort.
fn claude() -> Result<Vec<Model>, String> {
    let args = [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--permission-mode",
        "auto",
        "--no-session-persistence",
    ];
    let (mut child, lines) = start("claude", &args)?;
    send(
        &mut child,
        &[
            json!({"type": "control_request", "request_id": "list", "request": {"subtype": "list_models"}}),
            json!({"type": "control_request", "request_id": "settings", "request": {"subtype": "get_settings"}}),
        ],
    );
    let until = Instant::now() + PATIENCE;
    let (mut list, mut settings) = (None, None);
    while list.is_none() || settings.is_none() {
        let Some(line) = next(&lines, until) else {
            break;
        };
        if line.get("type").and_then(Value::as_str) != Some("control_response") {
            continue;
        }
        let response = &line["response"];
        let body = response.get("response").cloned().unwrap_or(Value::Null);
        match response.get("request_id").and_then(Value::as_str) {
            Some("list") => list = Some(body),
            Some("settings") => settings = Some(body),
            _ => {}
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    let list = list.ok_or("Claude Code did not list its models")?;
    Ok(claude_models(&list, &settings.unwrap_or(Value::Null)))
}

/// The models of Claude Code's `list_models` and `get_settings` answers.
pub fn claude_models(list: &Value, settings: &Value) -> Vec<Model> {
    let text = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).map(str::to_string);
    let configured = settings.pointer("/effective/model").and_then(Value::as_str);
    let effort = settings.pointer("/applied/effort").and_then(Value::as_str);
    let rows = list.get("models").and_then(Value::as_array);
    rows.into_iter()
        .flatten()
        .filter(|row| text(row, "value").is_some_and(|v| v != "default"))
        .filter(|row| row.get("supportsAutoMode").and_then(Value::as_bool) == Some(true))
        .map(|row| {
            let slug = text(row, "value").unwrap_or_default();
            let resolved = text(row, "resolvedModel");
            let default = configured.is_some_and(|c| c == slug || Some(c) == resolved.as_deref());
            let levels = row.get("supportedEffortLevels").and_then(Value::as_array);
            Model {
                name: text(row, "displayName").unwrap_or_else(|| slug.clone()),
                aliases: resolved.into_iter().filter(|r| *r != slug).collect(),
                default,
                efforts: levels
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(|id| Effort {
                        id: id.into(),
                        label: effort_label(id),
                        default: default && effort == Some(id),
                    })
                    .collect(),
                slug,
            }
        })
        .collect()
}

/// Codex's models: `model/list`, every page, and `config/read`, on a short app server.
fn codex() -> Result<Vec<Model>, String> {
    let (mut child, lines) = start("codex", &["app-server"])?;
    let client = json!({
        "capabilities": { "experimentalApi": true, "requestAttestation": false },
        "clientInfo": { "name": "uraeda", "title": "Uraeda", "version": "1" },
    });
    send(
        &mut child,
        &[json!({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": client})],
    );
    let until = Instant::now() + PATIENCE;
    let mut rows: Vec<Value> = Vec::new();
    let mut config = None;
    let mut listed = false;
    let mut page = 1;
    while !listed || config.is_none() {
        let Some(line) = next(&lines, until) else {
            break;
        };
        let result = line.get("result").cloned();
        match line.get("id").and_then(Value::as_i64) {
            Some(0) => send(
                &mut child,
                &[
                    json!({"jsonrpc": "2.0", "method": "initialized"}),
                    json!({"jsonrpc": "2.0", "id": 1, "method": "model/list", "params": {}}),
                    json!({"jsonrpc": "2.0", "id": 1000, "method": "config/read", "params": {}}),
                ],
            ),
            Some(1000) => config = Some(result.unwrap_or(Value::Null)),
            Some(id) if (1..1000).contains(&id) => {
                let result = result.unwrap_or(Value::Null);
                rows.extend(result["data"].as_array().cloned().unwrap_or_default());
                match result.get("nextCursor").and_then(Value::as_str) {
                    Some(cursor) if page < 50 => {
                        page += 1;
                        send(
                            &mut child,
                            &[json!({"jsonrpc": "2.0", "id": page, "method": "model/list",
                                "params": {"cursor": cursor}})],
                        );
                    }
                    _ => listed = true,
                }
            }
            _ => {}
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    if !listed {
        return Err("Codex did not list its models".into());
    }
    let config = config.unwrap_or(Value::Null);
    Ok(codex_models(
        &rows,
        config.get("config").unwrap_or(&Value::Null),
    ))
}

/// The models of Codex's `model/list` rows and its configuration: every row but the hidden ones;
/// the configured model, else the row marked default, marked default.
pub fn codex_models(rows: &[Value], config: &Value) -> Vec<Model> {
    let text = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).map(str::to_string);
    let configured = text(config, "model");
    let marked = rows
        .iter()
        .find(|r| r.get("isDefault").and_then(Value::as_bool) == Some(true))
        .and_then(|r| text(r, "model").or_else(|| text(r, "id")));
    let default_model = configured.or(marked);
    rows.iter()
        .filter(|row| row.get("hidden").and_then(Value::as_bool) != Some(true))
        .filter_map(|row| {
            let slug = text(row, "model").or_else(|| text(row, "id"))?;
            let default = default_model.as_deref() == Some(slug.as_str());
            let usual = if default {
                text(config, "model_reasoning_effort")
                    .or_else(|| text(row, "defaultReasoningEffort"))
            } else {
                text(row, "defaultReasoningEffort")
            };
            let efforts = row
                .get("supportedReasoningEfforts")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|e| text(e, "reasoningEffort"))
                .map(|id| Effort {
                    default: usual.as_deref() == Some(id.as_str()),
                    label: effort_label(&id),
                    id,
                })
                .collect();
            Some(Model {
                name: text(row, "displayName").unwrap_or_else(|| slug.clone()),
                aliases: Vec::new(),
                default,
                efforts,
                slug,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_lists_its_unattended_models_and_its_configured_one() {
        let list = json!({"models": [
            {"value": "default", "displayName": "Default", "supportsAutoMode": true},
            {"value": "fable", "displayName": "Fable 5.2", "resolvedModel": "claude-fable-5-2",
             "supportsAutoMode": true, "supportedEffortLevels": ["low", "xhigh"]},
            {"value": "claude-haiku-4-5", "displayName": "Haiku 4.5"}
        ]});
        let settings = json!({"effective": {"model": "fable"}, "applied": {"effort": "xhigh"}});
        let models = claude_models(&list, &settings);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].slug, "fable");
        assert_eq!(models[0].aliases, ["claude-fable-5-2"]);
        assert!(models[0].default);
        assert_eq!(models[0].efforts[1].label, "Extra high");
        assert!(models[0].efforts[1].default);
    }

    #[test]
    fn codex_lists_its_shown_models_with_their_usual_effort() {
        let rows = vec![
            json!({"model": "gpt-a", "displayName": "GPT A", "isDefault": true,
                   "defaultReasoningEffort": "low",
                   "supportedReasoningEfforts": [{"reasoningEffort": "low"}, {"reasoningEffort": "ultra"}]}),
            json!({"model": "gpt-hidden", "hidden": true}),
        ];
        let models = codex_models(&rows, &json!({"model_reasoning_effort": "ultra"}));
        assert_eq!(models.len(), 1);
        assert!(models[0].default);
        assert!(models[0].efforts[1].default, "the configured effort");
    }
}
