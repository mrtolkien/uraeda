//! The fake Storybook as a program of its own, which the previews' tests run as their preview
//! command: see `uraeda_server::sandbox::storybook`. `ura fake-storybook` is the same, for the
//! sandbox.

use std::process::ExitCode;

fn main() -> ExitCode {
    uraeda_server::sandbox::storybook::run(std::env::args().skip(1))
}
