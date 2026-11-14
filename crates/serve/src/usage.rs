//! `ura usage`: the usage windows, five hours and a week, of the human's Claude Code accounts and
//! of Codex, asked of the agents themselves in short processes that spend no usage, all at once.
//!
//! - **Claude Code**: each account is a configuration folder, listed in `[usage] claude` of
//!   `config.toml`, reached as `CLAUDE_CONFIG_DIR`, but `~/.claude`, Claude Code's own, which is
//!   reached without it. A short `claude -p` answers the `get_usage` control request with its
//!   `rate_limits`.
//! - **Codex**: a short `codex app-server` answers `account/rateLimits/read` with its `primary`
//!   and `secondary` windows.
//!
//! An account that cannot be read says why, and never fails the others.
//!
//! ```toml
//! [usage]
//! claude = ["~/.claude", "~/.claude-work"]
//! ```

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};

use serde::Serialize;
use serde_json::{Value, json};
use toml_edit::DocumentMut;

use crate::providers::{PATIENCE, next, send, start_with};

/// What `ura usage` prints.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Usage {
    /// The Claude Code accounts, in the settings' order.
    pub claude: Vec<Account>,
    pub codex: Windows,
}

/// One Claude Code account: its name and folder, and its windows.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Account {
    /// The folder's name without its dot and its `claude-`: `work` for `~/.claude-work`, and
    /// `default` for `~/.claude`.
    pub name: String,
    /// As the settings list it.
    pub folder: String,
    #[serde(flatten)]
    pub windows: Windows,
}

/// The windows of an account, or why they could not be read.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct Windows {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub five_hour: Option<Window>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub week: Option<Window>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub problem: Option<String>,
}

/// A window: the share used, in percent, and when it resets, in RFC 3339; none while the window
/// is not open.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Window {
    pub used: f64,
    pub resets_at: Option<String>,
}

impl Windows {
    fn problem(why: impl Into<String>) -> Windows {
        Windows {
            problem: Some(why.into()),
            ..Windows::default()
        }
    }
}

/// The settings' Claude Code folders, `[usage] claude`, as listed: none without the table.
///
/// # Errors
///
/// A file that is not TOML, or a list that is not one of folders.
pub fn accounts(config_dir: &Path) -> Result<Vec<String>, String> {
    let file = config_dir.join(crate::config::FILE);
    let text = match std::fs::read_to_string(&file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("{}: {error}", file.display())),
    };
    accounts_of(&text).map_err(|why| format!("{}: {why}", file.display()))
}

/// The folders of `[usage] claude` in a settings file's text.
fn accounts_of(text: &str) -> Result<Vec<String>, String> {
    let document: DocumentMut = text.parse().map_err(|_| "not valid TOML".to_string())?;
    let Some(listed) = document.get("usage").and_then(|usage| usage.get("claude")) else {
        return Ok(Vec::new());
    };
    let problem = || "[usage] claude is a list of folders, like [\"~/.claude\"]".to_string();
    listed
        .as_array()
        .ok_or_else(problem)?
        .iter()
        .map(|folder| folder.as_str().map(str::to_string).ok_or_else(problem))
        .collect()
}

/// Every account's windows and Codex's, asked at once.
pub fn read(folders: &[String]) -> Usage {
    let home = std::env::home_dir().unwrap_or_default();
    std::thread::scope(|scope| {
        let codex = scope.spawn(codex);
        let accounts: Vec<_> = folders
            .iter()
            .map(|folder| {
                let home = &home;
                scope.spawn(move || Account {
                    name: name_of(folder),
                    folder: folder.clone(),
                    windows: claude(&expand(folder, home), home),
                })
            })
            .collect();
        Usage {
            claude: accounts
                .into_iter()
                .map(|account| {
                    account
                        .join()
                        .unwrap_or_else(|_| unreachable!("an account's thread panicked"))
                })
                .collect(),
            codex: codex
                .join()
                .unwrap_or_else(|_| Windows::problem("Codex's thread stopped")),
        }
    })
}

/// A listed folder on disk: `~/` read as `home`.
fn expand(folder: &str, home: &Path) -> PathBuf {
    match folder.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None if folder == "~" => home.to_path_buf(),
        None => PathBuf::from(folder),
    }
}

/// A folder's name: its last segment, without its dot and its `claude-`; `default` for
/// `.claude`.
fn name_of(folder: &str) -> String {
    let segment = Path::new(folder.trim_end_matches('/'))
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let segment = segment.strip_prefix('.').unwrap_or(&segment);
    if segment == "claude" {
        return "default".to_string();
    }
    let name = segment.strip_prefix("claude-").unwrap_or(segment);
    if name.is_empty() {
        folder.to_string()
    } else {
        name.to_string()
    }
}

/// One account's windows, from a short `claude -p` in its folder.
fn claude(folder: &Path, home: &Path) -> Windows {
    // Claude Code reads its own folder, `~/.claude`, without the variable: with it, it would read
    // `.claude.json` inside the folder, not `~/.claude.json`.
    let env = if folder == home.join(".claude") {
        Vec::new()
    } else {
        vec![(
            "CLAUDE_CONFIG_DIR".to_string(),
            folder.to_string_lossy().into_owned(),
        )]
    };
    let args = [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--no-session-persistence",
    ];
    let (mut child, lines) = match start_with("claude", &args, &env) {
        Ok(started) => started,
        Err(why) => return Windows::problem(why),
    };
    send(
        &mut child,
        &[
            json!({"type": "control_request", "request_id": "u", "request": {"subtype": "get_usage"}}),
        ],
    );
    let until = Instant::now() + PATIENCE;
    let mut answer = None;
    while let Some(line) = next(&lines, until) {
        let response = &line["response"];
        if line.get("type").and_then(Value::as_str) == Some("control_response")
            && response.get("request_id").and_then(Value::as_str) == Some("u")
        {
            answer = Some(response.get("response").cloned().unwrap_or(Value::Null));
            break;
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    match answer {
        Some(answer) => claude_windows(&answer),
        None => Windows::problem(format!(
            "Claude Code gave no usage within {} seconds",
            PATIENCE.as_secs()
        )),
    }
}

/// The windows of a `get_usage` answer. A signed-out folder's has no five-hour window: then it
/// is a problem, not an empty account.
pub fn claude_windows(answer: &Value) -> Windows {
    let Some(limits) = answer
        .get("rate_limits")
        .filter(|limits| limits.is_object())
    else {
        return Windows::problem("Claude Code gave no usage: is the account signed in?");
    };
    let window = |key: &str| {
        let window = limits.get(key).filter(|window| window.is_object())?;
        Some(Window {
            used: window.get("utilization")?.as_f64()?,
            resets_at: window
                .get("resets_at")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    };
    let Some(five_hour) = window("five_hour") else {
        return Windows::problem("Claude Code gave no five-hour window: is the account signed in?");
    };
    Windows {
        five_hour: Some(five_hour),
        week: window("seven_day"),
        problem: None,
    }
}

/// Codex's windows, from a short `codex app-server`.
fn codex() -> Windows {
    let (mut child, lines) = match start_with("codex", &["app-server"], &[]) {
        Ok(started) => started,
        Err(why) => return Windows::problem(why),
    };
    let client = json!({
        "capabilities": { "experimentalApi": true, "requestAttestation": false },
        "clientInfo": { "name": "uraeda", "title": "Uraeda", "version": "1" },
    });
    send(
        &mut child,
        &[json!({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": client})],
    );
    let until = Instant::now() + PATIENCE;
    let mut answer = None;
    while let Some(line) = next(&lines, until) {
        match line.get("id").and_then(Value::as_i64) {
            Some(0) => send(
                &mut child,
                &[
                    json!({"jsonrpc": "2.0", "method": "initialized"}),
                    json!({"jsonrpc": "2.0", "id": 1, "method": "account/rateLimits/read"}),
                ],
            ),
            Some(1) => {
                answer = Some(line);
                break;
            }
            _ => {}
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    match answer {
        Some(answer) => codex_windows(&answer),
        None => Windows::problem(format!(
            "Codex gave no usage within {} seconds",
            PATIENCE.as_secs()
        )),
    }
}

/// The five-hour and weekly windows of an `account/rateLimits/read` answer, each found by its
/// length among `primary` and `secondary`.
pub fn codex_windows(answer: &Value) -> Windows {
    if let Some(error) = answer.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("an error");
        return Windows::problem(format!("Codex refused to give its usage: {message}"));
    }
    let Some(limits) = answer
        .pointer("/result/rateLimits")
        .filter(|l| l.is_object())
    else {
        return Windows::problem("Codex gave no usage: is it signed in?");
    };
    let mut windows = Windows::default();
    for key in ["primary", "secondary"] {
        let Some(window) = limits.get(key).filter(|window| window.is_object()) else {
            continue;
        };
        let Some(used) = window.get("usedPercent").and_then(Value::as_f64) else {
            continue;
        };
        let resets_at = window
            .get("resetsAt")
            .and_then(Value::as_u64)
            .map(|seconds| uraeda_core::today::rfc3339(UNIX_EPOCH + Duration::from_secs(seconds)));
        let read = Some(Window { used, resets_at });
        match window.get("windowDurationMins").and_then(Value::as_u64) {
            Some(300) => windows.five_hour = read,
            Some(10_080) => windows.week = read,
            _ => {}
        }
    }
    if windows.five_hour.is_none() && windows.week.is_none() {
        return Windows::problem("Codex gave neither a five-hour nor a weekly window");
    }
    windows
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A `get_usage` answer, as Claude Code gave it on 2026-11-14.
    const CLAUDE: &str = r#"{"rate_limits":{"five_hour":{"utilization":18,"resets_at":"2026-11-14T15:09:59.950077+00:00"},"seven_day":{"utilization":42.5,"resets_at":"2026-11-19T08:00:00.000000+00:00"}}}"#;

    /// An `account/rateLimits/read` answer, as Codex gave it on 2026-11-14.
    const CODEX: &str = r#"{"jsonrpc":"2.0","id":1,"result":{"rateLimits":{"primary":{"usedPercent":0,"windowDurationMins":300,"resetsAt":1794674606},"secondary":{"usedPercent":7,"windowDurationMins":10080,"resetsAt":1795100000}}}}"#;

    fn json(text: &str) -> Value {
        serde_json::from_str(text).unwrap()
    }

    #[test]
    fn claude_gives_its_five_hours_and_its_week() {
        let windows = claude_windows(&json(CLAUDE));

        assert_eq!(
            windows.five_hour,
            Some(Window {
                used: 18.0,
                resets_at: Some("2026-11-14T15:09:59.950077+00:00".into())
            })
        );
        assert_eq!(windows.week.map(|w| w.used), Some(42.5));
        assert_eq!(windows.problem, None);
    }

    #[test]
    fn a_signed_out_claude_folder_is_a_problem() {
        for answer in [
            r#"{"rate_limits":{}}"#,
            r#"{"rate_limits":{"seven_day":{"utilization":3}}}"#,
            "{}",
        ] {
            let windows = claude_windows(&json(answer));

            assert!(windows.problem.is_some(), "{answer}");
            assert_eq!(windows.five_hour, None, "{answer}");
        }
    }

    #[test]
    fn codex_gives_each_window_by_its_length() {
        let windows = codex_windows(&json(CODEX));

        assert_eq!(
            windows.five_hour,
            Some(Window {
                used: 0.0,
                resets_at: Some("2026-11-14T16:43:26Z".into())
            })
        );
        assert_eq!(windows.week.map(|w| w.used), Some(7.0));
        assert_eq!(windows.problem, None);
    }

    #[test]
    fn codex_without_limits_or_with_an_error_is_a_problem() {
        let refused = r#"{"id":1,"error":{"code":-32600,"message":"not signed in"}}"#;
        let empty = r#"{"id":1,"result":{"rateLimits":{}}}"#;

        assert!(
            codex_windows(&json(refused))
                .problem
                .unwrap()
                .contains("not signed in")
        );
        assert!(codex_windows(&json(empty)).problem.is_some());
    }

    #[test]
    fn the_accounts_are_the_listed_folders() {
        let text =
            "[serve]\nport = 4310\n\n[usage]\nclaude = [\"~/.claude\", \"~/.claude-work\"]\n";

        assert_eq!(accounts_of(text).unwrap(), ["~/.claude", "~/.claude-work"]);
        assert_eq!(accounts_of("").unwrap(), Vec::<String>::new());
        assert!(accounts_of("[usage]\nclaude = \"~/.claude\"\n").is_err());
    }

    #[test]
    fn an_account_is_named_by_its_folder() {
        assert_eq!(name_of("~/.claude"), "default");
        assert_eq!(name_of("~/.claude-work"), "work");
        assert_eq!(name_of("/accounts/leo/"), "leo");
    }

    #[test]
    fn the_json_names_each_window_and_problem() {
        let usage = Usage {
            claude: vec![Account {
                name: "work".into(),
                folder: "~/.claude-work".into(),
                windows: Windows::problem("signed out"),
            }],
            codex: codex_windows(&json(CODEX)),
        };

        let printed = serde_json::to_value(&usage).unwrap();

        assert_eq!(printed["claude"][0]["name"], "work");
        assert_eq!(printed["claude"][0]["problem"], "signed out");
        assert_eq!(printed["codex"]["five_hour"]["used"], 0.0);
        assert_eq!(
            printed["codex"]["week"]["resets_at"],
            "2026-11-19T14:53:20Z"
        );
    }
}
