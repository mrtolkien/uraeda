//! Where the checks may open a window: only on a display no screen shows, which the dev shell's
//! `hidden-display` gives, with a session bus of its own.

use std::process::Command;

/// What this file sets for the process a check runs in.
const INSIDE: &str = "URAEDA_OUTSIDE_CHECK";

/// Runs `check` in a process of its own, on a hidden display of its own, with data, cache, and
/// configuration folders of its own: GTK, WebKit, and NSH then read and write nothing of whoever
/// runs the tests, and a click of one check never lands on another's window. That process is
/// this test again, named `test`, started through `hidden-display`: a plain `cargo nextest run`
/// opens no window on a real display.
///
/// Without `hidden-display`, outside the dev shell, the check is skipped, and says so. On CI that
/// is a failure: the checks would pass there without running.
pub fn on_hidden_display(test: &str, check: impl FnOnce()) {
    if std::env::var_os(INSIDE).is_some() {
        return check();
    }
    let home = tempfile::tempdir().expect("a temporary folder");
    let status = Command::new("hidden-display")
        .arg(std::env::current_exe().expect("the test binary's path"))
        .args(["--exact", test, "--nocapture"])
        .env(INSIDE, "1")
        .env("XDG_DATA_HOME", home.path().join("data"))
        .env("XDG_CACHE_HOME", home.path().join("cache"))
        .env("XDG_CONFIG_HOME", home.path().join("config"))
        .status();
    match status {
        Ok(status) => assert!(status.success(), "`{test}` failed on the hidden display"),
        Err(error) if std::env::var_os("CI").is_some() => {
            panic!("`hidden-display` did not start, so `{test}` cannot run: {error}")
        }
        Err(error) => eprintln!(
            "skipped `{test}`: it opens a window, and `hidden-display` did not start ({error}). \
             Run it in the dev shell: nix develop -c cargo nextest run -p uraeda-app --test outside"
        ),
    }
}
