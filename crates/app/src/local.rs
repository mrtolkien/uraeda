//! The Mac app's way to its own machine's server, as the Linux host's channel gives it on Linux
//! (`host.rs`): the server of the data folder, found through its status file or started
//! (`server_start.rs`), the device's token for it in the login keychain, its pairing with that
//! server, and the server it started stopped as the app quits.
//!
//! On a Mac the app runs in Native Shell's own runner, which has no host channel of the app's: the
//! TSX asks these functions instead (`app/screens/shell/host.ts`, `macHost`). Off the Mac app they
//! reject, in words that say so.

use nsh_core::prelude::*;

/// This machine's server, the device's token for it, and its pairing: the Mac app's.
#[module]
pub(crate) struct Local;

#[module(flat)]
impl Local {
    /// The address of this Mac's server, once it answers: found through its data folder's status
    /// file, or started from the `ura` beside the app, else the one the login shell finds. Rejects
    /// when it cannot start, with the end of its log, and off the Mac app.
    pub(crate) async fn local_server() -> Result<String, String> {
        imp::server().await
    }

    /// The device's token for this Mac's server, kept in the login keychain, or `null` when it was
    /// never paired. Rejects off the Mac app.
    pub(crate) async fn local_token() -> Result<Option<String>, String> {
        imp::token().await
    }

    /// Pairs the device with this Mac's server, with the `code` `ura pair` printed, the access
    /// `key`, or neither, when the app asks its own server for a code itself; keeps the token in
    /// the login keychain, and answers it. Rejects with the server's own words.
    pub(crate) async fn local_pair(
        code: Option<String>,
        key: Option<String>,
    ) -> Result<String, String> {
        imp::pair(code, key).await
    }

    /// Forgets the device's token, which the server no longer knows.
    pub(crate) async fn local_forget() -> Result<(), String> {
        imp::forget().await
    }

    /// Stops the server the app started, if any, as the app quits: one it found running is left.
    pub(crate) fn local_stop() {
        imp::stop();
    }
}

#[cfg(not(all(target_os = "macos", feature = "host")))]
mod imp {
    /// Why nothing answers on another build than the Mac app's.
    const NONE: &str = "Only the Mac app finds its server this way.";

    pub(super) async fn server() -> Result<String, String> {
        Err(NONE.to_owned())
    }

    pub(super) async fn token() -> Result<Option<String>, String> {
        Err(NONE.to_owned())
    }

    pub(super) async fn pair(
        _code: Option<String>,
        _key: Option<String>,
    ) -> Result<String, String> {
        Err(NONE.to_owned())
    }

    pub(super) async fn forget() -> Result<(), String> {
        Err(NONE.to_owned())
    }

    pub(super) fn stop() {}
}

#[cfg(all(target_os = "macos", feature = "host"))]
mod imp {
    use std::ffi::OsString;
    use std::path::{Path, PathBuf};
    use std::process::{Command, Stdio};
    use std::sync::{Mutex, OnceLock, PoisonError};
    use std::time::{Duration, Instant};

    use nsh_core::prelude::blocking;
    use security_framework::passwords;

    use crate::pairing;
    use crate::server_start::{Local, LocalOptions, START, STOP};

    /// The keychain's service of the app's items: its id.
    const SERVICE: &str = crate::APP_ID;

    /// The keychain's answer for an item it does not hold, `errSecItemNotFound`.
    const NOT_FOUND: i32 = -25300;

    /// How long the login shell has to say its `PATH`.
    const SHELL: Duration = Duration::from_secs(5);

    /// The server of the data folder: one for the app's run, made at its first call.
    fn local() -> &'static Local {
        static LOCAL: OnceLock<Local> = OnceLock::new();
        LOCAL.get_or_init(|| {
            let path = login_path();
            let home = std::env::home_dir().unwrap_or_else(|| PathBuf::from("/"));
            Local::new(LocalOptions {
                ura: ura(path.as_deref(), &home),
                data_dir: uraeda_core::repositories::default_data_dir(),
                port: None,
                // An app opened from the Finder runs in `/`: the server runs in the home folder,
                // as from a new terminal.
                folder: home,
                // The server runs `git` and the agents' commands: an app opened from the Finder
                // has the system's short `PATH`, so the server gets the login shell's.
                environment: path
                    .map(|path| vec![(OsString::from("PATH"), path)])
                    .unwrap_or_default(),
                start_wait: START,
                stop_wait: STOP,
            })
        })
    }

    /// A token paired while the keychain refused it: held for this run alone, and unpaired as the
    /// app quits, so no file ever holds it.
    fn held() -> std::sync::MutexGuard<'static, Option<String>> {
        static HELD: Mutex<Option<String>> = Mutex::new(None);
        HELD.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// The `PATH` of the person's login shell, as a terminal has it, or `None` when it says none
    /// in time.
    fn login_path() -> Option<OsString> {
        let shell = std::env::var_os("SHELL").unwrap_or_else(|| "/bin/zsh".into());
        let mut child = Command::new(shell)
            .args(["-l", "-c", "printenv PATH"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()?;
        let begun = Instant::now();
        while begun.elapsed() < SHELL {
            if let Ok(Some(_)) = child.try_wait() {
                let output = child.wait_with_output().ok()?;
                let text = String::from_utf8_lossy(&output.stdout).trim().to_owned();
                return (!text.is_empty()).then(|| OsString::from(text));
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        let _ = child.kill();
        let _ = child.wait();
        None
    }

    /// The `ura` that serves: the one in the app's bundle, beside its program, else the first the
    /// login shell's `PATH` finds, else the usual places of an install, else `ura` itself.
    fn ura(path: Option<&std::ffi::OsStr>, home: &Path) -> PathBuf {
        let beside = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.canonicalize().ok())
            .and_then(|exe| exe.parent().map(|dir| dir.join("ura")));
        let searched: Vec<PathBuf> = path
            .map(|path| {
                std::env::split_paths(path)
                    .map(|dir| dir.join("ura"))
                    .collect()
            })
            .unwrap_or_default();
        let usual = [
            home.join(".cargo/bin/ura"),
            home.join(".nix-profile/bin/ura"),
            PathBuf::from("/opt/homebrew/bin/ura"),
            PathBuf::from("/usr/local/bin/ura"),
            PathBuf::from("/run/current-system/sw/bin/ura"),
        ];
        beside
            .into_iter()
            .chain(searched)
            .chain(usual)
            .find(|candidate| candidate.is_file())
            .unwrap_or_else(|| PathBuf::from("ura"))
    }

    /// What names the server in the keychain: its data folder, whose server's port may change.
    fn account() -> String {
        format!("local {}", local().data_dir().display())
    }

    /// The name the device pairs under: the Mac's.
    fn device_name() -> String {
        let named = Command::new("/usr/sbin/scutil")
            .args(["--get", "ComputerName"])
            .stderr(Stdio::null())
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
            .unwrap_or_default();
        if named.is_empty() {
            "Uraeda on this Mac".to_owned()
        } else {
            format!("Uraeda on {named}")
        }
    }

    /// Runs `work` on a thread of the runtime's: a start waits for the server, the keychain for its
    /// prompt.
    async fn off_thread<T: Send + 'static>(
        work: impl FnOnce() -> Result<T, String> + Send + 'static,
    ) -> Result<T, String> {
        blocking(work)
            .await
            .map_err(|error| format!("The app's call stopped: {error}"))?
    }

    pub(super) async fn server() -> Result<String, String> {
        off_thread(|| local().ensure().map(|running| running.address)).await
    }

    pub(super) async fn token() -> Result<Option<String>, String> {
        off_thread(|| {
            if let Some(token) = held().clone() {
                return Ok(Some(token));
            }
            match passwords::get_generic_password(SERVICE, &account()) {
                Ok(bytes) => Ok(Some(String::from_utf8_lossy(&bytes).into_owned())),
                Err(error) if error.code() == NOT_FOUND => Ok(None),
                // A keychain that refuses: the device pairs for this run alone.
                Err(error) => {
                    eprintln!("uraeda: the keychain refused the token: {error}");
                    Ok(None)
                }
            }
        })
        .await
    }

    pub(super) async fn pair(code: Option<String>, key: Option<String>) -> Result<String, String> {
        off_thread(move || {
            let running = local().ensure()?;
            let address = running.address;
            let name = device_name();
            let token = match (code, key) {
                (Some(code), _) => pairing::pair(&address, &pairing::Given::Code(&code), &name)?,
                (None, Some(key)) => pairing::pair(&address, &pairing::Given::Key(&key), &name)?,
                (None, None) => {
                    let code = pairing::code(&address, &running.token)?;
                    pairing::pair(&address, &pairing::Given::Code(&code), &name)?
                }
            };
            if let Err(error) =
                passwords::set_generic_password(SERVICE, &account(), token.as_bytes())
            {
                eprintln!("uraeda: the keychain refused the token: {error}. Paired for this run.");
                *held() = Some(token.clone());
            }
            Ok(token)
        })
        .await
    }

    pub(super) async fn forget() -> Result<(), String> {
        off_thread(|| {
            if held().take().is_some() {
                return Ok(());
            }
            match passwords::delete_generic_password(SERVICE, &account()) {
                Ok(()) => Ok(()),
                Err(error) if error.code() == NOT_FOUND => Ok(()),
                Err(error) => Err(format!("The keychain refused to forget the token: {error}")),
            }
        })
        .await
    }

    pub(super) fn stop() {
        let local = local();
        if let (Some(held), Some(running)) = (held().take(), local.running()) {
            pairing::unpair(&running.address, &held);
        }
        // The server is asked to end at once; the app does not wait for it to have ended, which
        // the platform gives a quit 200 ms for.
        let stopping = std::thread::spawn(move || local.stop());
        let asked = Instant::now();
        while !stopping.is_finished() && asked.elapsed() < Duration::from_millis(150) {
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}
