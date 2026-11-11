//! `uraeda`, the app on Linux: a GTK window that finds this machine's server, or starts it, or
//! connects to another machine's with `--server`. `uraeda --help` says how.

use std::process::ExitCode;

#[cfg(target_os = "linux")]
fn main() -> ExitCode {
    let given: Vec<String> = std::env::args().skip(1).collect();
    let args = match uraeda_app::host::Args::parse(given.iter().cloned()) {
        Ok(args) => args,
        // Asked for, the usage is the answer.
        Err(usage) if given.iter().any(|arg| arg == "--help" || arg == "-h") => {
            println!("{usage}");
            return ExitCode::SUCCESS;
        }
        Err(usage) => {
            eprintln!("{usage}");
            return ExitCode::from(2);
        }
    };
    // As the runner `nsh` builds for the app: NSH's base components and the app's own module,
    // and the app's native components on every view.
    nsh_platform_linux::set_ui_sets(vec![nsh_base::registry(), uraeda_app::registry()]);
    nsh_platform_linux::set_components(uraeda_app::__nsh_native_components_linux);
    uraeda_app::host::run(args)
}

/// The app's window is GTK's: on another system, the app is another host's.
#[cfg(not(target_os = "linux"))]
fn main() -> ExitCode {
    eprintln!("uraeda: this host runs on Linux");
    ExitCode::FAILURE
}
