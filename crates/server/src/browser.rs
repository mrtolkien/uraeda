//! The browser a start opens: `ura serve`, typed at a terminal of a desktop, opens the app in the
//! owner's browser, signed in, unless the setting `open_browser` is off or the start says
//! `--no-open`. A start by the Linux app, a service, or a script has no terminal, and opens none.

use std::fs;
use std::io::Write as _;
use std::os::unix::fs::OpenOptionsExt as _;
use std::process::Stdio;

use uraeda_core::settings;

use crate::{Server, sign_in};

/// The page that leads the browser to its one-time sign-in link, in the data folder.
const PAGE: &str = "open.html";

/// What opens an address in the desktop's browser, on an operating system.
fn opener(os: &str) -> Option<&'static str> {
    match os {
        "linux" => Some("xdg-open"),
        "macos" => Some("open"),
        _ => None,
    }
}

/// Whether a start opens a browser: the setting, on unless the owner turned it off, where a
/// desktop can show one. Never over SSH, and on Linux only with a display. `has` says whether
/// the server's environment holds a variable.
pub fn opens(setting: Option<bool>, has: impl Fn(&str) -> bool, os: &str) -> bool {
    let remote = has("SSH_CONNECTION") || has("SSH_TTY");
    let shown = os != "linux" || has("DISPLAY") || has("WAYLAND_DISPLAY");
    setting.unwrap_or(true) && opener(os).is_some() && !remote && shown
}

/// Opens the app in the owner's browser as the server starts, signed in by a one-time link,
/// when [`opens`] says so. A browser that cannot be opened is said, and stops nothing.
pub(crate) fn open_at_start(server: &Server) {
    let shared = server.shared();
    let environment = shared.environment();
    // Settings that cannot be read are said where the settings show: here they open the browser.
    let setting = settings::read(shared.config_dir())
        .ok()
        .and_then(|settings| settings.server.open_browser);
    let os = std::env::consts::OS;
    if !opens(setting, |name| environment.var(name).is_some(), os) {
        return;
    }
    let Some(opener) = opener(os) else {
        return;
    };
    // The link signs a browser in: it goes in a page only the owner reads, never on a command
    // line, which every user of the machine sees.
    let link = format!("{}{}", server.address(), sign_in::link(shared, "/"));
    let page = shared.data_dir().join(PAGE);
    let written = fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&page)
        .and_then(|mut file| {
            let refresh = format!("<meta http-equiv=\"refresh\" content=\"0;url={link}\">");
            write!(
                file,
                "<!doctype html>{refresh}<a href=\"{link}\">Open Uraeda</a>"
            )
        });
    let opened = written.and_then(|()| {
        let mut command = environment.command(opener);
        command
            .arg(&page)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        command.spawn()
    });
    match opened {
        // The opener ends once the browser has the page: it is waited for, off the server's
        // threads, so it leaves no process behind.
        Ok(mut child) => drop(std::thread::spawn(move || child.wait())),
        Err(error) => eprintln!("uraeda: could not open a browser: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::opens;

    #[test]
    fn a_start_opens_a_browser_only_where_a_desktop_shows_one() {
        let desktop = |name: &str| name == "WAYLAND_DISPLAY";
        let over_ssh = |name: &str| matches!(name, "DISPLAY" | "SSH_CONNECTION");
        let none = |_: &str| false;

        // On by default, and off by the owner's setting.
        assert!(opens(None, desktop, "linux"));
        assert!(opens(Some(true), desktop, "linux"));
        assert!(!opens(Some(false), desktop, "linux"));
        // Never over SSH, a forwarded display included, nor on a machine without a display.
        assert!(!opens(None, over_ssh, "linux"));
        assert!(!opens(None, none, "linux"));
        // A Mac always has a desktop; a system with no known opener opens none.
        assert!(opens(None, none, "macos"));
        assert!(!opens(None, desktop, "freebsd"));
    }
}
