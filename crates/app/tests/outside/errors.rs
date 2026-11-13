//! What a page's engine says when the page breaks. NSH's GTK view has no error callback: the
//! engine writes each error to the process's log, under the target `js`, on its own thread. So
//! the host listens to the log, and knows the page from the thread.

use std::sync::mpsc::{self, Receiver, Sender};
use std::thread::ThreadId;

use log::{Level, LevelFilter, Log, Metadata, Record};

/// The log target of an engine's reports about the page it runs.
const TARGET: &str = "js";

/// One error of a page: the engine that ran it, and NSH's text, which starts with `bundle failed:`,
/// `uncaught exception:`, or `stopped:`.
#[derive(Debug)]
pub struct Report {
    pub engine: ThreadId,
    pub text: String,
}

struct Listener(Sender<Report>);

impl Log for Listener {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        metadata.target() == TARGET && metadata.level() == Level::Error
    }

    fn log(&self, record: &Record<'_>) {
        if self.enabled(record.metadata()) {
            let _ = self.0.send(Report {
                engine: std::thread::current().id(),
                text: record.args().to_string(),
            });
        }
    }

    fn flush(&self) {}
}

/// Listens to the process's log, which has one listener: the errors of every page, in order.
pub fn listen() -> Receiver<Report> {
    let (sender, receiver) = mpsc::channel();
    log::set_boxed_logger(Box::new(Listener(sender))).expect("the process's only logger");
    log::set_max_level(LevelFilter::Error);
    receiver
}
