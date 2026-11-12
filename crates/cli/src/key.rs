//! `ura key`: asks the running server for an access key, and shows it, once, for a browser to
//! sign in with. The key is shown here alone: the server keeps its hash, and writes it nowhere.

use std::path::PathBuf;
use std::process::ExitCode;

use uraeda_server::default_data_dir;
use uraeda_server::sign_in::{self, NewKey};

/// Prints an access key of the server whose files are in `data_dir`: its first, or with
/// `replace`, a new one in place of the one there, which signs every browser and device out.
pub fn run(data_dir: Option<PathBuf>, replace: bool) -> Result<ExitCode, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    // A relative folder joins the current one.
    let data_dir = cwd.join(data_dir.unwrap_or_else(default_data_dir));
    let made = sign_in::access_key(&data_dir, replace)?;
    print!("{}", shown(&made));
    Ok(ExitCode::SUCCESS)
}

/// What `ura key` prints.
fn shown(made: &NewKey) -> String {
    let NewKey {
        key,
        replaced,
        address,
    } = made;
    let mut shown = format!(
        "Access key: {key}\n\
         It is shown this once: keep it in a password manager. A browser signs in with it at \
         {address}.\n"
    );
    if *replaced {
        shown.push_str(
            "The old key signs in no more, and every browser and device was signed out: \
             `ura pair` pairs a device again.\n",
        );
    }
    shown
}
