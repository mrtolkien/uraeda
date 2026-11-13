//! The Linux host, `uraeda`: the window the app's TSX runs in, and what the TSX asks of the
//! machine through it, over NSH's host channel (`host.call` in TSX, `window.rs`):
//!
//! - `uraeda.server`: the server, `{ address, local }`, once it answers. On this machine it is
//!   found through its status file, or started (`server_start.rs`); with `--server`, it is the
//!   address given.
//! - `uraeda.token`: the device's token for that server, kept in the system's secret store
//!   (`secrets.rs`), or `null`.
//! - `uraeda.pair`, `{ code }` or `{ key }`, or `{}` on this machine: pairs the device, keeps its
//!   token, and answers it (`pairing.rs`).
//! - `uraeda.forget`: forgets the token, which the server no longer knows.
//!
//! An extension's page runs in a view of its own, with a channel of its own: it reaches none of
//! these.

mod secrets;
mod window;

pub use window::{Args, run};

use std::sync::{Mutex, MutexGuard, PoisonError};

use crate::pairing;
use crate::server_start::Local;

/// The server the app works with.
pub enum Target {
    /// This machine's, of a data folder: found or started.
    Local(Local),
    /// Another machine's, at its address: `https://mac.tail1234.ts.net`.
    Remote(String),
}

/// How the device pairs.
pub enum Pairing {
    /// On the server's own machine: the app asks its server for a code itself.
    Here,
    /// With the code `ura pair` printed.
    Code(String),
    /// With the access key.
    Key(String),
}

/// The app's server, and the device's token for it.
pub struct Host {
    target: Target,
    /// The name the device pairs under: "Uraeda on <the machine's name>".
    name: String,
    /// A token paired while no secret store answered: held for this run alone, and unpaired as
    /// the app closes, so no file ever holds it and no device is left behind.
    held: Mutex<Option<String>>,
}

impl Host {
    pub fn new(target: Target, name: &str) -> Host {
        Host {
            target,
            name: name.to_owned(),
            held: Mutex::new(None),
        }
    }

    /// The server's address, once it answers: this machine's is started when none runs.
    ///
    /// # Errors
    ///
    /// When this machine's server cannot start, in words that say why.
    pub fn server(&self) -> Result<String, String> {
        match &self.target {
            Target::Local(local) => local.ensure().map(|running| running.address),
            Target::Remote(address) => Ok(address.clone()),
        }
    }

    /// Whether the server is this machine's.
    pub fn is_local(&self) -> bool {
        matches!(self.target, Target::Local(_))
    }

    /// The token kept for the server, if any.
    ///
    /// # Errors
    ///
    /// When the system's secret store does not answer.
    pub fn token(&self) -> Result<Option<String>, String> {
        if let Some(held) = self.held().clone() {
            return Ok(Some(held));
        }
        match secrets::read(&self.key()) {
            Ok(token) => Ok(token),
            // No secret store on this desktop: the device pairs for this run alone.
            Err(problem) => {
                eprintln!("uraeda: {problem} The device pairs for this run alone.");
                Ok(None)
            }
        }
    }

    /// Pairs the device, keeps its token in the secret store, and gives it.
    ///
    /// # Errors
    ///
    /// The server's refusal, in its words, or the store's.
    pub fn pair(&self, pairing: &Pairing) -> Result<String, String> {
        let address = self.server()?;
        let token = match (pairing, &self.target) {
            (Pairing::Here, Target::Local(local)) => {
                let running = local.ensure()?;
                let code = pairing::code(&address, &running.token)?;
                pairing::pair(&address, &pairing::Given::Code(&code), &self.name)?
            }
            (Pairing::Here, Target::Remote(_)) => {
                return Err("This app pairs itself only with its own machine's server.".to_owned());
            }
            (Pairing::Code(code), _) => {
                pairing::pair(&address, &pairing::Given::Code(code), &self.name)?
            }
            (Pairing::Key(key), _) => {
                pairing::pair(&address, &pairing::Given::Key(key), &self.name)?
            }
        };
        if let Err(problem) = secrets::keep(&self.key(), &token) {
            eprintln!("uraeda: {problem} The device is paired for this run alone.");
            *self.held() = Some(token.clone());
        }
        Ok(token)
    }

    /// Forgets the token: the server no longer knows it.
    ///
    /// # Errors
    ///
    /// As `token`.
    pub fn forget(&self) -> Result<(), String> {
        if self.held().take().is_some() {
            return Ok(());
        }
        secrets::forget(&self.key())
    }

    /// Stops the server the app started, if any: the last window closed.
    pub fn stop(&self) {
        // This machine's server is asked where it runs, never started: it stops after this.
        let address = match &self.target {
            Target::Local(local) => local.running().map(|running| running.address),
            Target::Remote(address) => Some(address.clone()),
        };
        if let (Some(held), Some(address)) = (self.held().take(), address) {
            pairing::unpair(&address, &held);
        }
        if let Target::Local(local) = &self.target {
            local.stop();
        }
    }

    fn held(&self) -> MutexGuard<'_, Option<String>> {
        self.held.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// What names the server in the secret store: its address, or this machine's data folder,
    /// whose server's port may change from one start to the next.
    fn key(&self) -> String {
        match &self.target {
            Target::Local(local) => format!("local {}", local.data_dir().display()),
            Target::Remote(address) => address.trim_end_matches('/').to_owned(),
        }
    }
}
