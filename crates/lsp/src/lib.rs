//! `ura lsp`: Uraeda's language server, serving workflow files to editors over the Language Server
//! Protocol. It reads the open buffers' text and calls only the core, so every editor gets the same
//! rules as `ura check`.
//!
//! [`server`] runs the loop and routes each request and notification to the module of its
//! capability: [`diagnostics`], [`completion`], [`symbols`], [`actions`], [`hints`], and the
//! custom [`requests`]; [`documents`] holds the open texts.

mod actions;
mod completion;
mod diagnostics;
mod documents;
mod hints;
mod requests;
mod server;
mod symbols;

pub use documents::file_uri;

/// Any error that stops the server.
pub type Error = Box<dyn std::error::Error + Send + Sync>;

/// Serves one client on `connection` until it sends `exit`, or the connection closes.
pub fn run(connection: lsp_server::Connection) -> Result<(), Error> {
    server::run(connection)
}

/// Serves one client over stdin and stdout, as `ura lsp` does.
pub fn stdio() -> Result<(), Error> {
    let (connection, io_threads) = lsp_server::Connection::stdio();
    run(connection)?;
    io_threads.join()?;
    Ok(())
}
