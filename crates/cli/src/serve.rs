//! `ura serve`: runs Uraeda's server on this machine, until it is stopped.

use std::io::IsTerminal as _;
use std::path::PathBuf;
use std::process::ExitCode;

use uraeda_core::{repositories, settings};
use uraeda_server::{Clock, NotStarted, Options};

/// The earlier server's session store, in its data folder.
const EARLIER_STORE: &str = "runner.sqlite";

/// Runs the server on `port`, or the one its variable or the settings give, with its files in
/// `data_dir`, and the repository of the current folder in its list. A data folder that holds
/// the earlier server's sessions is refused: that server's files are only ever read, by
/// `ura import-sessions`. When this data folder's server already runs, it gets the folder instead,
/// and its address is printed. `no_scheduled_jobs` starts no job at its times. A start typed at a
/// terminal opens the app in the browser, unless `no_open` or the settings say otherwise: one
/// whose output is read by a program, as the Linux app's, a service's, or a script's, opens none.
/// Only a start at a terminal shows the access key, at the first start: the output of any other
/// goes to a file or a program, where a key would rest in clear. `ura key` makes one then.
pub fn run(
    port: Option<u16>,
    data_dir: Option<PathBuf>,
    no_scheduled_jobs: bool,
    no_open: bool,
) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    // A relative folder joins the current one.
    let data_dir = cwd.join(data_dir.unwrap_or_else(repositories::default_data_dir));
    if data_dir.join(EARLIER_STORE).exists() {
        let folder = data_dir.display();
        return Err(format!(
            "{folder} holds the earlier server's sessions, {EARLIER_STORE}: it is not this \
             server's data folder. Run `ura import-sessions --from {folder}` to copy them, and \
             start the server on another folder, with --data-dir or URAEDA_DATA_DIR, or on its \
             own with neither"
        ));
    }
    let options = Options {
        port,
        config_dir: cwd.join(settings::default_config_dir()),
        data_dir,
        folder: Some(cwd),
        environment: environment(),
        allow_origins: Vec::new(),
        clock: Clock::system(),
        no_scheduled_jobs,
        sandbox: None,
    };
    let at_terminal = std::io::stdout().is_terminal();
    let opens = !no_open && at_terminal;
    match uraeda_server::run(options, opens, at_terminal) {
        Ok(()) => Ok(ExitCode::SUCCESS),
        Err(handed @ NotStarted::HandedOver { .. }) => {
            println!("{handed}");
            Ok(ExitCode::SUCCESS)
        }
        Err(error) => Err(error.to_string()),
    }
}

/// This process's environment: a variable that is not text is left out.
fn environment() -> Vec<(String, String)> {
    std::env::vars_os()
        .filter_map(|(name, value)| Some((name.into_string().ok()?, value.into_string().ok()?)))
        .collect()
}
