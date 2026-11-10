//! `ura import-sessions`: copies the sessions of the earlier server, the Node one, into the new
//! server's store, once.
//!
//! TEMPORARY: removed with the Node server, once the port is done (task 61).

use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::SystemTime;

use uraeda_core::repositories;
use uraeda_server::default_data_dir;
use uraeda_server::runner::{self, ImportError, Imported, Replace, Store};

/// Imports the sessions of the data folder `from`, the earlier server's by default, into the
/// store of `data_dir`, the new server's by default. `from` is only read. A store that already
/// holds sessions is refused, unless `replace` removes them first.
pub fn run(
    from: Option<PathBuf>,
    data_dir: Option<PathBuf>,
    replace: bool,
) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    // A relative folder joins the current one.
    let from = cwd.join(from.unwrap_or_else(repositories::default_data_dir));
    let data_dir = cwd.join(data_dir.unwrap_or_else(default_data_dir));
    let store = Store::open(&data_dir).map_err(|error| error.to_string())?;
    let replace = if replace { Replace::Yes } else { Replace::No };
    let imported = runner::import(&from, &store, SystemTime::now(), replace);
    store.close();
    print!("{}", shown(&imported.map_err(refusal)?, &from, &data_dir));
    Ok(ExitCode::SUCCESS)
}

/// Why nothing was imported, with the way out a flag gives.
fn refusal(error: ImportError) -> String {
    match error {
        ImportError::Holds { .. } => format!(
            "{error}. With --replace, they are removed, and the earlier server's sessions are \
             imported in their place"
        ),
        other => other.to_string(),
    }
}

/// What `ura import-sessions` prints once it imported.
fn shown(imported: &Imported, from: &Path, data_dir: &Path) -> String {
    let mut shown = String::new();
    let _ = writeln!(
        shown,
        "Imported {}, {}, and {} from {} into {}.",
        counted(imported.sessions, "session", "sessions"),
        counted(imported.turns, "turn", "turns"),
        counted(imported.events, "event", "events"),
        from.join("runner.sqlite").display(),
        data_dir.join(runner::FILE).display(),
    );
    let mut line = |count: u64, one: &str, many: &str| {
        if count > 0 {
            let _ = writeln!(
                shown,
                "{}",
                if count == 1 { one } else { many }.replace("{}", &count.to_string())
            );
        }
    };
    line(
        imported.stopped,
        "{} turn of the earlier server was at work, waiting, or cut by its stop: it is stopped \
         here, as that server may still run it.",
        "{} turns of the earlier server were at work, waiting, or cut by its stop: they are \
         stopped here, as that server may still run them.",
    );
    line(
        imported.continues,
        "{} run waited to continue by itself there: here it waits for you.",
        "{} runs waited to continue by themselves there: here they wait for you.",
    );
    line(
        imported.images,
        "{} image came with its message.",
        "{} images came with their messages.",
    );
    line(
        imported.unread,
        "{} line of a transcript could not be read, and was left out.",
        "{} lines of transcripts could not be read, and were left out.",
    );
    shown
}

/// A count and its noun: `1 session`, `4 sessions`.
fn counted(count: u64, one: &str, many: &str) -> String {
    format!("{count} {}", if count == 1 { one } else { many })
}
