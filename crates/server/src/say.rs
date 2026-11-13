//! What the server prints, on its stdout and its stderr: the one home of the rule that a line
//! printed never stops the server.
//!
//! `println!` and `eprintln!` panic when their stream is closed, as when `ura serve | head -1`
//! read its first line and ended: the next extension's `log` took the server down. A line here
//! is written whole, and dropped when the stream is gone. The crate's lints refuse `println!`
//! and `eprintln!`: use `say!` and `say_err!`,
//! which every module has.

use std::fmt::Arguments;
use std::io::Write;

/// Prints a line on the server's stdout, as `println!` does, dropped when stdout is closed.
macro_rules! say {
    ($($arg:tt)*) => {
        $crate::say::out(format_args!("{}\n", format_args!($($arg)*)))
    };
}

/// Prints a line on the server's stderr, as `eprintln!` does, dropped when stderr is closed.
macro_rules! say_err {
    ($($arg:tt)*) => {
        $crate::say::err(format_args!("{}\n", format_args!($($arg)*)))
    };
}

/// Writes text on stdout, and flushes it: nothing when stdout is closed.
pub(crate) fn out(text: Arguments<'_>) {
    let mut stdout = std::io::stdout().lock();
    let _ = stdout.write_fmt(text).and_then(|()| stdout.flush());
}

/// Writes text on stderr: nothing when stderr is closed.
pub(crate) fn err(text: Arguments<'_>) {
    let _ = std::io::stderr().lock().write_fmt(text);
}
