//! `ura serve`: a server that runs until its process is told to stop.

use std::io;

use tokio::signal::unix::{Signal, SignalKind, signal};

use crate::{NotStarted, Options, Server};

/// Runs a server until the process gets SIGHUP, as from a closed terminal, SIGINT, or SIGTERM,
/// then stops it. It prints its address once it listens.
///
/// # Errors
///
/// [`NotStarted`], as [`Server::start`].
pub fn run(options: Options) -> Result<(), NotStarted> {
    let failed = |error: io::Error| NotStarted::Failed(error.to_string());
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(failed)?;
    runtime.block_on(async {
        // Heard from before the start: a signal during it stops the server once it has started.
        let mut signals = Signals::listen().map_err(failed)?;
        let server = Server::start(options).await?;
        println!("Uraeda server on {}", server.address());
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
