//! The app's start of its server when the server is slow, silent, or deaf, with a stand-in of
//! `ura` (`ura-stand-in`): it logs each start, and becomes the real `ura serve-app` only once the
//! test opens its gate. The guarantees are about a process the app started, so each test runs
//! one: none waits on the app's own minute.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use std::time::{Duration, Instant};

use uraeda_app::server_start::Local;

use super::{Folders, answers, runs, ura, wait_until};

const STAND_IN: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/host/ura-stand-in");

/// How long a call waits for the stand-in to answer, in the tests that let it time out.
const SHORT: Duration = Duration::from_millis(200);

/// A test's folders, and its stand-in's starts: what it left running is killed with the test.
struct StandIn {
    folders: Folders,
}

impl StandIn {
    fn new() -> StandIn {
        StandIn {
            folders: Folders::new(),
        }
    }

    /// The app's way to its server, started through the stand-in: `deaf` to its stop or not,
    /// with the app's own waits unless given.
    fn local(&self, deaf: bool, waits: Option<Duration>) -> Local {
        let mut options = self.folders.options("data");
        options.ura = STAND_IN.into();
        let file = |name: &str| self.folders.path(name).into_os_string();
        options.environment.extend([
            ("STAND_IN_STARTS".into(), file("starts")),
            ("STAND_IN_GATE".into(), file("gate")),
            ("STAND_IN_URA".into(), ura().into_os_string()),
        ]);
        if deaf {
            options
                .environment
                .push(("STAND_IN_DEAF".into(), "1".into()));
        }
        if let Some(wait) = waits {
            (options.start_wait, options.stop_wait) = (wait, wait);
        }
        Local::new(options)
    }

    /// The process of each start of the stand-in, in order.
    fn starts(&self) -> Vec<u32> {
        let logged = fs::read_to_string(self.folders.path("starts")).unwrap_or_default();
        logged.lines().flat_map(str::parse).collect()
    }

    /// Lets the stand-ins become the real server.
    fn open_gate(&self) {
        fs::write(self.folders.path("gate"), "").expect("the gate opens");
    }
}

impl Drop for StandIn {
    /// Kills what a failed test left running: only the processes this test's stand-in logged.
    fn drop(&mut self) {
        for pid in self.starts().into_iter().filter(|pid| runs(*pid)) {
            let _ = Command::new("kill")
                .args(["-KILL", &pid.to_string()])
                .status();
        }
    }
}

/// Whether the process `pid` is gone, reaped by whoever started it.
fn gone(pid: u32) -> bool {
    !Path::new(&format!("/proc/{pid}")).exists()
}

// The window closes while the first start still waits for its server, which reads every
// repository: the app closes at once, and its server ends with it. Held under the start's lock,
// the close waited out the start's whole minute, and a question to the host froze with it.
#[test]
fn the_app_closes_at_once_while_its_server_starts() {
    let stand_in = StandIn::new();
    let local = Arc::new(stand_in.local(false, None));
    let starting = {
        let local = Arc::clone(&local);
        std::thread::spawn(move || local.ensure())
    };
    wait_until("the server starts", || !stand_in.starts().is_empty());
    let pid = stand_in.starts()[0];

    let asked = Instant::now();
    let running = local.running();
    local.stop();
    let taken = asked.elapsed();

    assert_eq!(running, None, "nothing answers yet");
    assert!(taken < Duration::from_secs(5), "closed in {taken:?}");
    assert!(gone(pid), "the server the app started ended with it");
    let refused = starting.join().expect("the start ends").unwrap_err();
    assert!(refused.contains("closing"), "{refused}");
    assert_eq!(stand_in.starts(), vec![pid], "and none started after");
}

// A server that takes longer than the app waits is still the app's: "Try again" waits for the
// same one, and the app stops it as it closes. Replaced by a second one, the first was no longer
// the app's to stop, and two servers started on one data folder.
#[test]
fn a_server_slow_to_answer_is_waited_for_again_and_never_replaced() {
    let stand_in = StandIn::new();
    let local = stand_in.local(false, Some(SHORT));

    let late = local.ensure().unwrap_err();
    assert!(late.contains("did not answer"), "{late}");
    // "Try again", while it still starts.
    local.ensure().unwrap_err();
    assert_eq!(stand_in.starts().len(), 1, "one server was started");

    stand_in.open_gate();
    let mut found = None;
    wait_until("the server answers", || {
        found = local.ensure().ok();
        found.is_some()
    });
    let running = found.expect("the server");
    assert_eq!(
        stand_in.starts(),
        vec![running.pid],
        "the one started first"
    );
    assert!(running.owned && answers(&running), "{running:?}");

    local.stop();
    assert!(gone(running.pid), "the app stopped its server");
}

// A server that hangs while it stops is killed once its time is up: the app never leaves behind
// what it started.
#[test]
fn a_server_deaf_to_its_stop_is_killed_as_the_app_closes() {
    let stand_in = StandIn::new();
    let local = stand_in.local(true, Some(SHORT));
    local.ensure().unwrap_err();
    let pid = stand_in.starts()[0];

    local.stop();

    assert!(gone(pid), "killed, and reaped");
}
