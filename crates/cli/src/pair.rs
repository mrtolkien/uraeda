//! `ura pair`: asks the running server for a one-time code, and shows it with a QR code, for a
//! device to pair with.

use std::fmt::Write as _;
use std::path::PathBuf;
use std::process::ExitCode;

use qrcodegen::{QrCode, QrCodeEcc};
use uraeda_core::repositories::default_data_dir;
use uraeda_server::sign_in::{self, Pairing};

use crate::output;

/// The light modules around a QR code, which a reader needs to find it.
const MARGIN: i32 = 4;

/// What draws the QR code on a terminal: black on white, whatever the terminal's own colours.
const BLACK_ON_WHITE: &str = "\x1b[30;47m";
const RESET: &str = "\x1b[0m";

/// Prints a pairing code of the server whose files are in `data_dir`: the code, the address a
/// device reaches the server at, and a QR code holding both.
pub fn run(data_dir: Option<PathBuf>) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    // A relative folder joins the current one.
    let data_dir = cwd.join(data_dir.unwrap_or_else(default_data_dir));
    let pairing = sign_in::pairing_code(&data_dir)?;
    print!("{}", shown(&pairing, output::colours())?);
    Ok(ExitCode::SUCCESS)
}

/// What a device opens or scans to pair: the server's address, with the code after `#`, which a
/// browser keeps to itself and never sends.
fn link(pairing: &Pairing) -> String {
    format!("{}/pair#{}", pairing.address, pairing.code)
}

/// What `ura pair` prints.
fn shown(pairing: &Pairing, colours: bool) -> Result<String, String> {
    let Pairing {
        code,
        minutes,
        address,
    } = pairing;
    let link = link(pairing);
    let picture = QrCode::encode_text(&link, QrCodeEcc::Medium)
        .map_err(|_| format!("{address} is too long an address for a QR code"))?;
    let mut shown = String::new();
    let _ = writeln!(shown, "Pairing code: {code}");
    let _ = writeln!(
        shown,
        "It pairs one device, once, within {minutes} minutes."
    );
    let _ = writeln!(
        shown,
        "On the device, scan this, or enter the code at {address}\n"
    );
    shown.push_str(&drawn(&picture, colours));
    Ok(shown)
}

/// A QR code as lines of text: each character is two modules, one above the other, so a module
/// is as wide as it is high in a terminal.
fn drawn(picture: &QrCode, colours: bool) -> String {
    let dark = |x: i32, y: i32| picture.get_module(x, y);
    let (start, end) = (-MARGIN, picture.size() + MARGIN);
    let mut drawn = String::new();
    for y in (start..end).step_by(2) {
        let row = (start..end).map(|x| match (dark(x, y), dark(x, y + 1)) {
            (true, true) => '█',
            (true, false) => '▀',
            (false, true) => '▄',
            (false, false) => ' ',
        });
        let row: String = row.collect();
        let _ = if colours {
            writeln!(drawn, "{BLACK_ON_WHITE}{row}{RESET}")
        } else {
            writeln!(drawn, "{row}")
        };
    }
    drawn
}
