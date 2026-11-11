//! The models Codex lists for the account, asked of a short `codex app-server`, closed once it
//! answered.

use std::path::PathBuf;
use std::time::Duration;

use serde_json::json;
use uraeda_protocol::ModelList;

use super::models::{Listing, Next, config_of, models};
use super::rpc::{Read, Rpc};
use crate::runner::Event;
use crate::runtimes::{Child, Lines, Spawn};
use crate::shared::Shared;

/// A short process, as one that lists the models, gives up after this long.
pub(super) const MODELS_TIMEOUT: Duration = Duration::from_secs(10);

/// What waits for an answer of the short process.
enum Asked {
    Initialize,
    Page,
    Config,
}

/// The models listed for the account: `model/list`, every page, and `config/read`, through a
/// short app-server in the home folder. Its process group then gets SIGTERM, and SIGKILL when
/// it still runs 5 seconds after.
///
/// # Errors
///
/// When Codex is not there, refuses, exits, or does not answer within 10 seconds, in words.
pub(super) async fn list(
    shared: &Shared,
    command: String,
    home: PathBuf,
) -> Result<ModelList, String> {
    let spawn = Spawn {
        program: command,
        args: vec!["app-server".to_owned()],
        cwd: home,
        env: Vec::new(),
    };
    let mut child = Child::spawn(shared, spawn);
    let mut lines = child.lines();
    let asked = tokio::time::timeout(MODELS_TIMEOUT, ask(&child, &mut lines)).await;
    child.end_short();
    asked.unwrap_or_else(|_| {
        let seconds = MODELS_TIMEOUT.as_secs();
        Err(format!(
            "Codex did not list its models within {seconds} seconds"
        ))
    })
}

/// Introduces the client, then asks for the pages and the configuration together.
async fn ask(child: &Child, lines: &mut Lines) -> Result<ModelList, String> {
    let mut rpc = Rpc::new();
    let mut listing = Listing::default();
    let write = |rpc: &mut Rpc<Asked>, method: &str, params, asked| {
        if let Ok(line) = rpc.request(method, params, asked) {
            child.write(&line);
        }
    };
    let client = json!({
        "capabilities": { "experimentalApi": true, "requestAttestation": false },
        "clientInfo": { "name": "uraeda", "title": "Uraeda", "version": "1" },
    });
    write(&mut rpc, "initialize", client, Asked::Initialize);
    while let Some(line) = lines.next().await {
        let next = match rpc.read(&line) {
            Read::Answer(Asked::Initialize, answer) => {
                answer?;
                child.write(&Rpc::<Asked>::notify("initialized"));
                let (list, config) = Listing::asks();
                write(&mut rpc, "model/list", list, Asked::Page);
                write(&mut rpc, "config/read", config, Asked::Config);
                Next::Wait
            }
            Read::Answer(Asked::Page, answer) => listing.page(answer),
            Read::Answer(Asked::Config, answer) => listing.config(answer),
            Read::Refused(error) => {
                child.write(&error);
                Next::Wait
            }
            Read::Notification { .. } | Read::Other => Next::Wait,
        };
        match next {
            Next::Wait => {}
            Next::Page(params) => write(&mut rpc, "model/list", params, Asked::Page),
            Next::Done(listed) => return Ok(models(&listed.rows, &config_of(&listed.config))),
            Next::Failed(why) => return Err(why),
        }
    }
    match child.exited().await {
        Event::Exit {
            missing: Some(true),
            stderr,
            ..
        } => Err(format!("Codex is not available: {stderr}")),
        _ => Err("Codex exited".to_owned()),
    }
}
