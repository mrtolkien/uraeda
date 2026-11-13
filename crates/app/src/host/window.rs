//! The app's window: the TSX bundle, run on GTK with the host channel's handlers, and the server
//! the app started stopped once the window closes.

use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use nsh_engine::{HostCall, HostChannel, JsonValue};
use nsh_platform_linux::{AppOptions, AppSource, AssetBase, Bundle, Limits};
use serde_json::json;

use super::{Host, Pairing, Target};
use crate::server_start::{Local, LocalOptions, START, STOP};

const USAGE: &str = "\
Usage: uraeda [--server <address>] [--data-dir <folder>] [--port <port>] [--ura <command>]
              [--app <folder>]
       uraeda --version

  --server <address>   Another machine's server: https://mac.tail1234.ts.net. The app pairs
                       with it on its first start.
  --data-dir <folder>  The data folder of this machine's server: Uraeda's own unless given.
  --port <port>        The port of a server the app starts: `ura serve`'s own, 4310 unless
                       its settings say otherwise, unless given; 0 takes a free one.
  --ura <command>      The `ura` that serves, when the app starts the server: the one beside
                       this app, else the one on the PATH.
  --app <folder>       The app's built files, `bundle.nshc`: `nsh/` beside this app unless given.";

/// What `uraeda` was started with.
#[derive(Debug, Default)]
pub struct Args {
    pub server: Option<String>,
    pub data_dir: Option<PathBuf>,
    pub port: Option<u16>,
    pub ura: Option<PathBuf>,
    pub app: Option<PathBuf>,
}

impl Args {
    /// Reads the command line, past the program's name.
    ///
    /// # Errors
    ///
    /// The usage, with what was wrong, for a flag it does not know or one without its value.
    pub fn parse(mut given: impl Iterator<Item = String>) -> Result<Args, String> {
        let mut args = Args::default();
        while let Some(flag) = given.next() {
            if flag == "--help" || flag == "-h" {
                return Err(USAGE.to_owned());
            }
            let mut value = || {
                given
                    .next()
                    .ok_or_else(|| format!("{flag} needs a value\n\n{USAGE}"))
            };
            match flag.as_str() {
                "--server" => args.server = Some(value()?),
                "--data-dir" => args.data_dir = Some(value()?.into()),
                "--port" => {
                    let typed = value()?;
                    let port = typed
                        .parse()
                        .map_err(|_| format!("{typed} is no port\n\n{USAGE}"))?;
                    args.port = Some(port);
                }
                "--ura" => args.ura = Some(value()?.into()),
                "--app" => args.app = Some(value()?.into()),
                _ => return Err(format!("unknown argument {flag}\n\n{USAGE}")),
            }
        }
        Ok(args)
    }
}

/// The oldest GTK the app runs on: NSH's GTK backend uses 4.14's calls.
const GTK_NEEDED: (u32, u32) = (4, 14);

/// Runs the app until its last window closes, then stops the server it started.
pub fn run(args: Args) -> ExitCode {
    if let Err(problem) = gtk_recent_enough() {
        eprintln!("uraeda: {problem}");
        return ExitCode::FAILURE;
    }
    let exe = std::env::current_exe()
        .and_then(|exe| exe.canonicalize())
        .ok();
    let beside = exe.as_ref().and_then(|exe| exe.parent()).map(PathBuf::from);
    let app = args
        .app
        .clone()
        .or_else(|| beside.as_ref().map(|dir| dir.join("nsh")));
    let Some(app) = app else {
        eprintln!("uraeda: the app's files are not found: give them with --app");
        return ExitCode::FAILURE;
    };
    // SAFETY: the bytecode is the app's own, built with it.
    let bundle = match unsafe { Bundle::read_trusted(&app.join("bundle.nshc")) } {
        Ok(bundle) => bundle,
        Err(error) => {
            eprintln!(
                "uraeda: the app's files are not in {}: {error}",
                app.display()
            );
            return ExitCode::FAILURE;
        }
    };
    let host = Arc::new(Host::new(target(&args, beside), &device_name()));
    let channel = HostChannel::new();
    let mut params = serde_json::Map::new();
    params.insert("local".into(), JsonValue::from(host.is_local()));
    channel.set_params(params);
    handle(&channel, &host);
    let assets = AssetBase::Directory(app.join("assets"));
    crate::share_app_assets(assets.clone());
    let options = AppOptions {
        app_id: crate::APP_ID.to_owned(),
        title: "Uraeda".to_owned(),
        size: (1400, 900),
        asset_base: Some(assets),
        // The app is the owner's own, not a module of another's.
        limits: Limits::standalone(),
        host: channel,
        ..AppOptions::default()
    };
    close_on_signals();
    let ran = nsh_platform_linux::run_app(AppSource::Bundle(bundle), options);
    host.stop();
    if ran == nsh_platform_linux::gtk4::glib::ExitCode::SUCCESS {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

/// Whether the machine's GTK is recent enough, said in words when it is not. A GTK that lacks one
/// of the calls the app links fails earlier, as the program loads: the package's launcher says
/// that one (`app/package/uraeda`).
fn gtk_recent_enough() -> Result<(), String> {
    use nsh_platform_linux::gtk4;
    let found = (gtk4::major_version(), gtk4::minor_version());
    if found >= GTK_NEEDED {
        return Ok(());
    }
    Err(format!(
        "this machine has GTK {}.{}, and Uraeda needs GTK {}.{} or newer: update GTK 4 \
         (libgtk-4-1 on Debian and Ubuntu, gtk4 on Fedora and Arch), or the system.",
        found.0, found.1, GTK_NEEDED.0, GTK_NEEDED.1
    ))
}

/// The server the command line names, or this machine's.
fn target(args: &Args, beside: Option<PathBuf>) -> Target {
    if let Some(address) = &args.server {
        return Target::Remote(address.trim_end_matches('/').to_owned());
    }
    // The server's own data folder, as `ura serve` takes it.
    let mut data_dir = args
        .data_dir
        .clone()
        .unwrap_or_else(uraeda_core::repositories::default_data_dir);
    let here = std::env::current_dir().unwrap_or_default();
    if data_dir.is_relative() {
        data_dir = here.join(data_dir);
    }
    let ura = args.ura.clone().unwrap_or_else(|| {
        let sibling = beside.map(|dir| dir.join("ura"));
        sibling
            .filter(|path| path.is_file())
            .unwrap_or_else(|| "ura".into())
    });
    Target::Local(Local::new(LocalOptions {
        ura,
        data_dir,
        port: args.port,
        folder: here,
        environment: Vec::new(),
        start_wait: START,
        stop_wait: STOP,
    }))
}

/// The name the device pairs under: the machine's.
fn device_name() -> String {
    let named = std::fs::read_to_string("/etc/hostname").unwrap_or_default();
    let named = named.trim();
    if named.is_empty() {
        "Uraeda's app".to_owned()
    } else {
        format!("Uraeda on {named}")
    }
}

/// The handlers of the app's calls. Each runs on a thread of its own: a start waits for the
/// server, and a pairing for the human's answer to the secret store.
fn handle(channel: &HostChannel, host: &Arc<Host>) {
    let on = |name: &str, answer: fn(&Host, &JsonValue) -> Result<JsonValue, String>| {
        let host = Arc::clone(host);
        channel.handle(name, move |call: HostCall| {
            let host = Arc::clone(&host);
            std::thread::spawn(move || {
                let result = answer(&host, call.data());
                call.reply(result);
            });
        });
    };
    on("uraeda.server", |host, _| {
        let address = host.server()?;
        Ok(json!({ "address": address, "local": host.is_local() }))
    });
    on("uraeda.token", |host, _| {
        Ok(host.token()?.map_or(JsonValue::Null, JsonValue::from))
    });
    on("uraeda.pair", |host, data| {
        let text = |field: &str| {
            data.get(field)
                .and_then(JsonValue::as_str)
                .map(str::to_owned)
        };
        let pairing = match (text("code"), text("key")) {
            (Some(code), _) => Pairing::Code(code),
            (None, Some(key)) => Pairing::Key(key),
            (None, None) => Pairing::Here,
        };
        host.pair(&pairing).map(JsonValue::from)
    });
    on("uraeda.forget", |host, _| {
        host.forget().map(|()| JsonValue::Null)
    });
}

/// Set by a signal that asks the app to close.
static CLOSING: AtomicBool = AtomicBool::new(false);

extern "C" fn asked_to_close(_: libc::c_int) {
    CLOSING.store(true, Ordering::SeqCst);
}

/// Closes the app on `SIGTERM`, `SIGINT`, and `SIGHUP`, as its window's close does: the server it
/// started stops with it, never left behind by a terminal's Ctrl+C or a session's end. The signal
/// only sets a flag, which the main loop reads five times a second.
fn close_on_signals() {
    use nsh_platform_linux::gtk4::gio::prelude::*;
    use nsh_platform_linux::gtk4::{gio, glib};
    for signal in [libc::SIGTERM, libc::SIGINT, libc::SIGHUP] {
        let handler = asked_to_close as extern "C" fn(libc::c_int);
        // SAFETY: the handler only stores to an atomic, which is safe in a signal handler.
        unsafe { libc::signal(signal, handler as libc::sighandler_t) };
    }
    glib::timeout_add(std::time::Duration::from_millis(200), || {
        if CLOSING.load(Ordering::SeqCst)
            && let Some(app) = gio::Application::default()
        {
            app.quit();
        }
        glib::ControlFlow::Continue
    });
}
