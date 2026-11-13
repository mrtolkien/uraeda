//! `ura sandbox`: the server over the sample projects and a fake agent, without sign-in, for
//! Uraeda's own development. See `uraeda_server::sandbox`.

use std::path::PathBuf;
use std::process::ExitCode;

use uraeda_server::NotStarted;
use uraeda_server::sandbox::{self, Mode, Prepare};

/// The sandbox's flags.
#[derive(clap::Args)]
pub struct Args {
    /// Build the sample projects and their data again, from the checkout's fixtures
    #[arg(long)]
    reset: bool,
    /// The port on 127.0.0.1, 4420 by default; 0 takes a free one
    #[arg(long)]
    port: Option<u16>,
    /// The sandbox's folder, `.sandbox/` of the checkout by default
    #[arg(long, value_hint = clap::ValueHint::DirPath)]
    folder: Option<PathBuf>,
    /// Keep sign-in on, with a new key at each start, to see the sign-in and pairing screens
    #[arg(long)]
    sign_in: bool,
    /// Add a chat of 20,000 messages to the project "sample", kept until a reset
    #[arg(long)]
    long_chat: bool,
}

/// Prepares the sandbox, then runs its server until it is stopped. It prints the server's
/// address first, as `ura serve` does, then the sandbox's folder.
pub fn run(args: Args) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let folder = args
        .folder
        .map_or_else(sandbox::default_folder, |folder| cwd.join(folder));
    // The stories feature's preview runs this program's own fake Storybook.
    let ura = std::env::current_exe().map_err(|error| error.to_string())?;
    let prepare = Prepare {
        reset: args.reset,
        long_chat: args.long_chat,
        storybook: Some(format!("{} fake-storybook", ura.display())),
    };
    if args.long_chat {
        eprintln!(
            "ura: the long chat is written once, and kept until a reset: about half a minute"
        );
    }
    let built = sandbox::prepare(&folder, prepare)?;
    if built.stale {
        eprintln!(
            "ura: the sample projects were built by older code: run with --reset to rebuild them"
        );
    }
    // The core reads today from the process: the sample projects' last day, so their dates read
    // as they were written. No thread runs yet.
    // SAFETY: set before the server's runtime starts any thread.
    unsafe { std::env::set_var("URA_TODAY", sandbox::TODAY) };
    let environment = std::env::vars_os()
        .filter_map(|(name, value)| Some((name.into_string().ok()?, value.into_string().ok()?)))
        .collect();
    let mode = Mode {
        sign_in: args.sign_in,
    };
    let options = sandbox::options(
        &built,
        args.port.unwrap_or(sandbox::PORT),
        mode,
        environment,
    );
    eprintln!("ura: the sandbox's folder is {}", built.folder.display());
    // The sandbox's key is no owner's secret: shown wherever its output goes.
    match uraeda_server::run(options, false, true) {
        Ok(()) => Ok(ExitCode::SUCCESS),
        Err(handed @ NotStarted::HandedOver { .. }) => {
            println!("{handed}");
            Ok(ExitCode::SUCCESS)
        }
        Err(error) => Err(error.to_string()),
    }
}
