//! What the tests of Claude Code's runtime run on: a server whose `claude` is a shell script,
//! which runs no agent, and the built-in runtime the server registered.
//!
//! The script is first on the `PATH` of the server's environment, before the stand-ins of the
//! agents this file's tests do not run: see `support/machine.rs`. It writes what it was started
//! with in the folder it runs in, a session's: `args`, its arguments with a NUL after each,
//! `token`, its token for Uraeda's tools, and `stdin`, each line it read.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use serde_json::Value;
use tempfile::TempDir;
use uraeda_server::runner::Event;
use uraeda_server::runtimes::{
    AgentProcess, Events, Options, Outgoing, Runtime, Runtimes, Tools, When,
};

use crate::support::{self, Setup, TestServer};

/// What every stand-in starts with: `--version` answered, and its arguments and token written.
const START: &str = r#"#!/bin/sh
if [ "$1" = "--version" ]; then echo "2.1.322 (Claude Code)"; echo more; exit 0; fi
for arg in "$@"; do printf '%s\0' "$arg"; done > args
printf '%s' "$URAEDA_MCP_TOKEN" > token
: > stdin
bin=$(dirname "$0")
"#;

/// A stand-in that plays `stream.jsonl`, of the folder it runs in, at each message it reads, and
/// ends with its stdin.
pub const REPLAY: &str = r#"
while IFS= read -r line; do
  printf '%s\n' "$line" >> stdin
  case "$line" in *'"type":"user"'*) cat stream.jsonl ;; esac
done
"#;

/// A stand-in that writes what it reads, and prints nothing.
pub const SILENT: &str = "cat >> stdin\n";

/// A stand-in that answers its control requests as Claude Code 2.1.319 does: `list_models` from
/// `list.json` and `get_settings` from `settings.json`, both beside the script, or, without that
/// one, a process on Opus at the effort `apply_flag_settings` last set, `medium` for none. With
/// a file `refuse` beside the script, it refuses every request.
pub const CONTROLS: &str = r#"
effort=medium
answer() {
  printf '{"type":"control_response","response":{"request_id":"%s","subtype":"success","response":%s}}\n' "$1" "$2"
}
while IFS= read -r line; do
  printf '%s\n' "$line" >> stdin
  id=$(printf '%s' "$line" | sed -n 's/.*"request_id":"\([^"]*\)".*/\1/p')
  if [ -f "$bin/refuse" ]; then
    printf '{"type":"control_response","response":{"request_id":"%s","subtype":"error","error":"Not now"}}\n' "$id"
    continue
  fi
  case "$line" in
    *'"subtype":"list_models"'*) answer "$id" "$(cat "$bin/list.json")" ;;
    *'"subtype":"get_settings"'*)
      if [ -f "$bin/settings.json" ]; then answer "$id" "$(cat "$bin/settings.json")"
      else answer "$id" "{\"applied\":{\"effort\":\"$effort\",\"model\":\"claude-opus-5-5\"},\"effective\":{\"model\":\"opus\"}}"
      fi ;;
    *'"subtype":"apply_flag_settings"'*)
      effort=$(printf '%s' "$line" | sed -n 's/.*"effortLevel":"\([^"]*\)".*/\1/p')
      effort=${effort:-medium}
      printf '{"type":"control_response","response":{"request_id":"%s","subtype":"success"}}\n' "$id" ;;
    *'"type":"control_request"'*)
      printf '{"type":"control_response","response":{"request_id":"%s","subtype":"error","error":"Unsupported"}}\n' "$id" ;;
  esac
done
"#;

/// A server whose `claude` is a stand-in, in Tokyo's time, with the folders its sessions run in.
pub struct Stage {
    pub server: TestServer,
    /// The folder of the stand-in, first on the server's `PATH`.
    pub bin: PathBuf,
    /// Claude Code's own folder, where it would keep its transcripts: `.claude` in the home
    /// folder, as the server's environment names no other.
    pub claude_dir: PathBuf,
    /// The home folder of the server's environment.
    pub home: PathBuf,
    folders: TempDir,
}

/// A server whose `claude` is a script of this body, after the start every stand-in shares.
pub async fn stage(body: &str) -> Stage {
    staged(body, |setup| setup).await
}

/// As [`stage`], on a start the test prepares further.
pub async fn staged(body: &str, prepare: impl FnOnce(Setup) -> Setup) -> Stage {
    let folders = TempDir::new().expect("a temporary folder");
    let folder = |name: &str| {
        let path = folders.path().join(name);
        fs::create_dir(&path).unwrap();
        path
    };
    let (bin, home) = (folder("bin"), folder("home"));
    let claude_dir = home.join(".claude");
    let command = bin.join("claude");
    fs::write(&command, format!("{START}{body}")).unwrap();
    fs::set_permissions(&command, fs::Permissions::from_mode(0o755)).unwrap();
    let setup = support::setup()
        .commands(&bin)
        .env("TZ", "Asia/Tokyo")
        .env("HOME", home.to_str().unwrap());
    Stage {
        server: prepare(setup).start().await,
        bin,
        claude_dir,
        home,
        folders,
    }
}

impl Stage {
    /// The built-in runtime, as the server registered it.
    pub fn runtime(&self) -> Arc<dyn Runtime> {
        let runtimes = self.server.shared().get::<Runtimes>();
        runtimes.get("claude").expect("the built-in runtime")
    }

    /// A new folder for a session to run in.
    pub fn session_dir(&self) -> PathBuf {
        let sessions = self.folders.path().join("sessions");
        fs::create_dir_all(&sessions).unwrap();
        let dir = TempDir::new_in(sessions).expect("a temporary folder");
        dir.keep()
    }

    /// Opens a session's process, on a blocking thread, as the sessions do.
    pub async fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        let runtime = self.runtime();
        let opened = tokio::task::spawn_blocking(move || runtime.open(options));
        opened.await.expect("the runtime opens")
    }

    /// Opens a new session's process in a new folder: the folder, and the process.
    pub async fn session(&self) -> (PathBuf, Box<dyn AgentProcess>) {
        let dir = self.session_dir();
        let process = self.open(options(&dir)).await;
        (dir, process)
    }

    /// Asks the runtime something that waits, on a blocking thread.
    pub async fn ask<T: Send + 'static>(
        &self,
        ask: impl FnOnce(&dyn Runtime) -> T + Send + 'static,
    ) -> T {
        let runtime = self.runtime();
        let asked = tokio::task::spawn_blocking(move || ask(runtime.as_ref()));
        asked.await.expect("the runtime answers")
    }

    /// Sets the server's clock, in seconds since 1970.
    pub fn at(&self, seconds: u64) {
        let at = SystemTime::UNIX_EPOCH + Duration::from_secs(seconds);
        self.server.clock().set(at);
    }
}

/// How a new session's process opens in a folder: a chat, with nothing picked.
pub fn options(cwd: &Path) -> Options {
    Options {
        cwd: cwd.to_owned(),
        native_id: "id".to_owned(),
        resume: false,
        model: None,
        effort: None,
        account: None,
        allowed: Vec::new(),
        skills: Vec::new(),
        tools: Tools::Own,
    }
}

/// A message sent to an agent, queued.
pub fn message(id: &str, text: &str) -> Outgoing {
    Outgoing {
        id: id.to_owned(),
        text: text.to_owned(),
        images: Vec::new(),
        when: When::Queue,
        review: false,
    }
}

/// Every event of a process until its stream ends, as JSON.
pub async fn rest(events: &mut Events) -> Vec<Value> {
    let mut read = Vec::new();
    while let Some(next) = events.next().await {
        read.push(json(&next));
    }
    read
}

/// The next event of a process, as JSON.
pub async fn next(events: &mut Events) -> Value {
    json(&events.next().await.expect("the stream goes on"))
}

fn json(event: &Event) -> Value {
    serde_json::to_value(event).unwrap()
}

/// The arguments a stand-in was started with, in the folder it ran in.
pub fn args(dir: &Path) -> Vec<String> {
    let written = fs::read_to_string(dir.join("args")).expect("the stand-in's arguments");
    let mut args: Vec<String> = written.split('\0').map(str::to_owned).collect();
    args.pop();
    args
}

/// The JSON lines a stand-in read on its stdin so far, in the folder it ran in.
pub fn stdin(dir: &Path) -> Vec<Value> {
    let read = fs::read_to_string(dir.join("stdin")).unwrap_or_default();
    let lines = read.lines().filter(|line| !line.is_empty());
    lines
        .map(|line| serde_json::from_str(line).expect("a JSON line"))
        .collect()
}

/// The lines a session wrote: what a stand-in read, without the `list_models` and the
/// `get_settings` every process asks as it opens.
pub fn written(dir: &Path) -> Vec<Value> {
    let asked = |line: &Value| {
        let subtype = line["request"]["subtype"].as_str();
        matches!(subtype, Some("list_models" | "get_settings"))
    };
    stdin(dir).into_iter().filter(|line| !asked(line)).collect()
}

/// The values of an option that takes several: the arguments after it, up to the next option.
pub fn values_of(args: &[String], option: &str) -> Vec<String> {
    let Some(at) = args.iter().position(|arg| arg == option) else {
        return Vec::new();
    };
    let rest = args[at + 1..].iter();
    rest.take_while(|arg| !arg.starts_with("--"))
        .cloned()
        .collect()
}

/// The value of an option that takes one, each time it is given.
pub fn each_of(args: &[String], option: &str) -> Vec<String> {
    let pairs = args.windows(2).filter(|pair| pair[0] == option);
    pairs.map(|pair| pair[1].clone()).collect()
}

/// Whether two JSON values are the same, whatever the order of their keys, and however a number
/// is written: `1` is `1.0`.
pub fn same(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(left), Value::Number(right)) => left.as_f64() == right.as_f64(),
        (Value::Array(left), Value::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right)
                    .all(|(left, right)| same(left, right))
        }
        (Value::Object(left), Value::Object(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .all(|(key, left)| right.get(key).is_some_and(|right| same(left, right)))
        }
        _ => left == right,
    }
}
