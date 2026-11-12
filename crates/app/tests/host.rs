//! The Linux host's own work, below its window: it finds the server of its data folder, or starts
//! `ura serve` and waits for it, starts it again when it stopped, and stops only the one it
//! started; and it pairs this device once, and keeps its token in the system's secret store.
//!
//! Each test runs the real `ura serve`, built once, on temporary folders, with the agents' commands
//! stood in for. The secret store's test runs on the hidden display's own session bus, where a
//! stand-in of the Secret Service answers: never the owner's keyring.
#![cfg(all(target_os = "linux", feature = "host"))]

#[path = "outside/display.rs"]
mod display;
#[path = "../../server/tests/support/machine.rs"]
#[allow(
    dead_code,
    reason = "this file uses only the stand-ins and their `PATH`"
)]
mod machine;
#[path = "host/secret_service.rs"]
mod secret_service;
#[path = "host/stand_in.rs"]
mod stand_in;

use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use uraeda_app::host::{Host, Pairing, Target};
use uraeda_app::server_start::{Local, LocalOptions, Running, START, STOP};

/// `ura`, built for these tests in a target folder of its own, `target/host-tests/`: in the
/// workspace's, a build of `uraeda-cli` alone resolves the features of the crates it shares with
/// this test otherwise, and each of the two builds undid the other's, for 35 s each time.
fn ura() -> PathBuf {
    static BUILT: OnceLock<PathBuf> = OnceLock::new();
    BUILT
        .get_or_init(|| {
            let exe = std::env::current_exe().expect("the test's path");
            // target/<profile>/deps/<test>: the workspace's target folder is three levels up.
            let target = exe
                .ancestors()
                .nth(3)
                .expect("the target folder")
                .join("host-tests");
            let cargo = std::env::var_os("CARGO").unwrap_or_else(|| "cargo".into());
            let built = Command::new(cargo)
                .args([
                    "build",
                    "-q",
                    "-p",
                    "uraeda-cli",
                    "--bin",
                    "ura",
                    "--target-dir",
                ])
                .arg(&target)
                .status()
                .expect("cargo runs");
            assert!(built.success(), "`ura` builds");
            target.join("debug").join("ura")
        })
        .clone()
}

/// A test's folders: a home, the config folder, the data folders, and the agents' stand-ins.
struct Folders {
    home: tempfile::TempDir,
}

impl Folders {
    fn new() -> Folders {
        let home = tempfile::TempDir::new().expect("a temporary folder");
        for folder in ["config", "stand-ins", "here"] {
            fs::create_dir(home.path().join(folder)).expect("a folder");
        }
        machine::stand_ins(&home.path().join("stand-ins"));
        Folders { home }
    }

    fn path(&self, name: &str) -> PathBuf {
        self.home.path().join(name)
    }

    /// What a server the app starts runs with: this test's home, config folder, and stand-ins.
    fn environment(&self) -> Vec<(OsString, OsString)> {
        let path = machine::path(&[], &self.path("stand-ins"));
        vec![
            ("HOME".into(), self.home.path().into()),
            ("PATH".into(), path.into()),
            ("URAEDA_CONFIG_DIR".into(), self.path("config").into()),
        ]
    }

    /// The app's way to the server of the data folder `data`.
    fn local(&self, data: &str) -> Local {
        Local::new(self.options(data))
    }

    /// How the app reaches the server of the data folder `data`, with the app's own waits.
    fn options(&self, data: &str) -> LocalOptions {
        LocalOptions {
            ura: ura(),
            data_dir: self.path(data),
            port: Some(0),
            folder: self.path("here"),
            environment: self.environment(),
            start_wait: START,
            stop_wait: STOP,
        }
    }

    /// `ura serve` on the data folder `data`, started by the test, as the owner would.
    fn serve(&self, data: &str) -> Server {
        let mut command = Command::new(ura());
        command
            .args(["serve", "--port", "0", "--data-dir"])
            .arg(self.path(data))
            .current_dir(self.path("here"))
            .envs(self.environment())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        Server(command.spawn().expect("`ura serve` starts"))
    }
}

/// A server the test started, killed with the test.
struct Server(Child);

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Whether the process `pid` runs: it is there, and not ended and waiting to be reaped.
fn runs(pid: u32) -> bool {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
    // `<pid> (<name>) <state> ...`: the state follows the name's closing parenthesis.
    let state = stat
        .rsplit_once(") ")
        .and_then(|(_, rest)| rest.chars().next());
    state.is_some_and(|state| state != 'Z' && state != 'X')
}

/// Ends the process `pid` at once, as a crash would: its status file stays.
fn crash(pid: u32) {
    let killed = Command::new("kill")
        .args(["-KILL", &pid.to_string()])
        .status();
    assert!(
        killed.is_ok_and(|status| status.success()),
        "{pid} is killed"
    );
    wait_until("the server's process ends", || !runs(pid));
}

fn wait_until(what: &str, mut done: impl FnMut() -> bool) {
    let started = Instant::now();
    while !done() {
        assert!(
            started.elapsed() < Duration::from_secs(30),
            "{what}: waited 30 s"
        );
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// Whether the server at `address` answers: a request without a session gets its 401.
fn answers(running: &Running) -> bool {
    let answer = ureq::get(&format!("{}/session", running.address)).call();
    matches!(answer, Err(ureq::Error::StatusCode(401)))
}

// US1, and the edge case "the server stops while the app is open": the app starts one again.
#[test]
fn the_app_starts_a_server_when_none_runs() {
    let folders = Folders::new();

    // None runs: the app starts one, and waits until it answers.
    let local = folders.local("data");
    let started = local.ensure().expect("a server starts");
    assert!(started.owned, "the app owns the server it started");
    assert!(answers(&started), "{} answers", started.address);
    // Asked again, it finds the same one: one data folder has one server.
    let found = local.ensure().expect("the server is found");
    assert_eq!((found.pid, found.owned), (started.pid, true));

    // The server stops while the app is open, its status file left behind: the app starts another.
    crash(started.pid);
    let again = local.ensure().expect("a server starts again");
    assert_ne!(again.pid, started.pid);
    assert!(again.owned && answers(&again));

    // The last window closes: the app stops the server it started, which removes its status file.
    local.stop();
    wait_until("the owned server stops", || !runs(again.pid));
    assert!(!folders.path("data/run/server.json").exists());

    // A server the owner started is found, used, and never stopped by the app.
    let theirs = folders.serve("theirs");
    let status = folders.path("theirs/run/server.json");
    wait_until("the owner's server writes its status", || status.exists());
    let local = folders.local("theirs");
    let found = local.ensure().expect("the owner's server is found");
    assert_eq!((found.pid, found.owned), (theirs.0.id(), false));
    assert!(answers(&found));
    local.stop();
    std::thread::sleep(Duration::from_millis(300));
    assert!(runs(theirs.0.id()), "the owner's server still runs");
}

// US5: a device pairs once, and its token is kept by the system, never in a file.
#[test]
fn a_device_pairs_once_and_its_token_is_in_the_secret_store_not_a_file() {
    display::on_hidden_display(
        "a_device_pairs_once_and_its_token_is_in_the_secret_store_not_a_file",
        || {
            let store = secret_service::serve();
            let folders = Folders::new();
            let host = Host::new(Target::Local(folders.local("data")), "Test laptop");
            let address = host.server().expect("a server starts");

            // Never paired: no token, and the app pairs itself with its own server.
            assert_eq!(host.token().expect("the store answers"), None);
            let token = host.pair(&Pairing::Here).expect("the app pairs");
            assert_eq!(
                host.token().expect("the store answers"),
                Some(token.clone())
            );
            assert_eq!(store.secrets(), vec![token.clone()]);

            // A new run of the app reads the token back, and pairs no second device.
            let next = Host::new(Target::Local(folders.local("data")), "Test laptop");
            assert_eq!(next.server().expect("the server"), address);
            assert_eq!(
                next.token().expect("the store answers"),
                Some(token.clone())
            );
            let file = fs::read_to_string(folders.path("data/sign-in.json")).expect("its file");
            assert_eq!(file.matches("\"Test laptop\"").count(), 1, "{file}");

            // Its secret is in no file of the app's or the server's folders.
            let secret = token.split_once('.').expect("<id>.<secret>").1;
            let holding = files(folders.home.path())
                .into_iter()
                .filter(|path| fs::read(path).is_ok_and(|bytes| holds(&bytes, secret)));
            assert_eq!(holding.collect::<Vec<_>>(), Vec::<PathBuf>::new());

            // Revoked, it is forgotten: the next start pairs again.
            next.forget().expect("the store forgets");
            assert_eq!(next.token().expect("the store answers"), None);
            assert_eq!(store.secrets(), Vec::<String>::new());
            host.stop();
        },
    );
}

/// Every file under `folder`.
fn files(folder: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    entries
        .flatten()
        .flat_map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                files(&path)
            } else {
                vec![path]
            }
        })
        .collect()
}

fn holds(bytes: &[u8], text: &str) -> bool {
    bytes
        .windows(text.len())
        .any(|window| window == text.as_bytes())
}

// The sign-in decision: secrets are stored only as hashes. A server the app starts writes its
// output in `run/server.log`, a file the app keeps: no access key, no device's token, and no
// session rests there or in any other file of the owner's folders. The host token alone is in a
// file, the status file, by design (it is how a second start on this machine hands over), and
// only its owner reads it.
#[test]
fn nothing_that_signs_in_rests_in_a_file_but_the_host_token() {
    use std::os::unix::fs::PermissionsExt as _;
    display::on_hidden_display(
        "nothing_that_signs_in_rests_in_a_file_but_the_host_token",
        || {
            let _store = secret_service::serve();
            let folders = Folders::new();
            let host = Host::new(Target::Local(folders.local("data")), "Test laptop");
            let address = host.server().expect("a server starts");
            let device = host.pair(&Pairing::Here).expect("the app pairs");

            // A first start by the app made no key: nothing to log, nothing to lose.
            let log = fs::read_to_string(folders.path("data/run/server.log")).expect("its log");
            assert!(!log.contains("ura_"), "the log holds a key: {log}");

            // The owner asks for a key, for a browser: it is shown, and signs a browser in.
            let asked = Command::new(ura())
                .arg("key")
                .arg("--data-dir")
                .arg(folders.path("data"))
                .envs(folders.environment())
                .output()
                .expect("`ura key` runs");
            let printed = String::from_utf8(asked.stdout).expect("text");
            assert!(asked.status.success(), "{printed}");
            let key = printed
                .lines()
                .find_map(|line| line.strip_prefix("Access key: "))
                .expect(&printed)
                .to_owned();
            let signed = ureq::post(&format!("{address}/session"))
                .header("Content-Type", "application/json")
                .send(format!("{{\"key\":\"{key}\"}}"))
                .expect("the key signs in");
            let cookie = signed.headers().get("set-cookie").expect("a cookie");
            let cookie = cookie
                .to_str()
                .expect("text")
                .split(';')
                .next()
                .expect("its value");
            let session = cookie.split_once('.').expect("<id>.<secret>").1.to_owned();
            // A first key ends nothing: the app's own device still signs in.
            let devices = ureq::get(&format!("{address}/session"))
                .header("Authorization", &format!("Bearer {device}"))
                .call();
            assert!(
                devices.is_ok(),
                "the app's device was signed out: {devices:?}"
            );

            let token =
                fs::read_to_string(folders.path("data/run/server.json")).expect("the status file");
            let token: serde_json::Value = serde_json::from_str(&token).expect("JSON");
            let token = token["token"].as_str().expect("the host token").to_owned();
            let secrets = [
                (
                    "the access key",
                    key.strip_prefix("ura_").expect("ura_").to_owned(),
                ),
                (
                    "the device's token",
                    device.split_once('.').expect("<id>.").1.to_owned(),
                ),
                ("the session", session),
                ("the host token", token),
            ];
            let mut found = Vec::new();
            for (name, secret) in &secrets {
                for path in files(folders.home.path()) {
                    if fs::read(&path).is_ok_and(|bytes| holds(&bytes, secret)) {
                        found.push((
                            *name,
                            path.strip_prefix(folders.home.path()).unwrap().to_owned(),
                        ));
                    }
                }
            }
            assert_eq!(
                found,
                [("the host token", PathBuf::from("data/run/server.json"))]
            );
            let mode = |path: &str| {
                let metadata = fs::metadata(folders.path(path)).expect("it is there");
                metadata.permissions().mode() & 0o777
            };
            assert_eq!(
                (mode("data/run"), mode("data/run/server.json")),
                (0o700, 0o600)
            );
            host.stop();
        },
    );
}

// A start that fails shows the end of its own log, never the lines an earlier start left.
#[test]
fn a_failed_start_shows_its_own_lines_alone() {
    let folders = Folders::new();
    fs::create_dir_all(folders.path("data/run")).expect("its folder");
    let earlier = "Access key, shown once: ura_left-by-an-earlier-start\n";
    fs::write(folders.path("data/run/server.log"), earlier).expect("an earlier log");
    fs::write(folders.path("data/sign-in.json"), "{").expect("a broken sign-in file");

    let failed = folders.local("data").ensure().expect_err("the start fails");

    assert!(failed.contains("cannot read"), "{failed}");
    assert!(!failed.contains("ura_left"), "{failed}");
}
