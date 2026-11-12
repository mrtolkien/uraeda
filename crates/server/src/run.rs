//! `ura serve`: a server that runs until its process is told to stop.

use std::io;

use tokio::signal::unix::{Signal, SignalKind, signal};

use crate::{NotStarted, Options, Server, browser, sign_in};

/// Runs a server until the process gets SIGHUP, as from a closed terminal, SIGINT, or SIGTERM,
/// then stops it. It prints its address once it listens. With `shows_key`, a start whose output
/// a person reads, it prints the access key too when the data folder had none, the only time it
/// is shown: see [`sign_in::key_at_start`]. With `opens`, a person's start at a terminal, it then
/// opens the app in the owner's browser, where the settings and the desktop allow: see
/// [`browser`].
///
/// # Errors
///
/// [`NotStarted`], as [`Server::start`].
pub fn run(options: Options, opens: bool, shows_key: bool) -> Result<(), NotStarted> {
    let failed = |error: io::Error| NotStarted::Failed(error.to_string());
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(failed)?;
    runtime.block_on(async {
        // Heard from before the start: a signal during it stops the server once it has started.
        let mut signals = Signals::listen().map_err(failed)?;
        let server = Server::start(options).await?;
        // In one write: whoever reads the address gets the key with it, and may stop reading.
        let key = shows_key
            .then(|| sign_in::key_at_start(server.shared()))
            .transpose()
            .unwrap_or_else(|problem| {
                eprintln!("uraeda: no access key was made: {problem}");
                None
            })
            .flatten();
        let key = key.map(|key| sign_in::key_lines(&key)).unwrap_or_default();
        print!("Uraeda server on {}\n{key}", server.address());
        if opens {
            browser::open_at_start(&server);
        }
        signals.next().await;
        // A second signal does not wait for the work that stops.
        tokio::spawn(async move {
            signals.next().await;
            std::process::exit(1);
        });
        server.stop().await;
        Ok(())
    })
}

/// The signals that stop the server.
struct Signals([Signal; 3]);

impl Signals {
    /// Starts hearing the three signals.
    fn listen() -> io::Result<Signals> {
        Ok(Signals([
            signal(SignalKind::hangup())?,
            signal(SignalKind::interrupt())?,
            signal(SignalKind::terminate())?,
        ]))
    }

    /// Waits for the next of them.
    async fn next(&mut self) {
        let [hangup, interrupt, terminate] = &mut self.0;
        tokio::select! {
            _ = hangup.recv() => {}
            _ = interrupt.recv() => {}
            _ = terminate.recv() => {}
        }
    }
}
