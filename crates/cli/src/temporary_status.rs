// TEMPORARY: replaced by the CLI feature.
//! `ura status <folder>`: the status of each workflow file in a feature folder.

use std::path::Path;
use std::process::ExitCode;

use uraeda_core::temporary_status::{FolderStatus, temporary_read_folder};

// TEMPORARY: replaced by the CLI feature.
/// Prints the folder's statuses. Exits with 1 when the folder cannot be read or a file is invalid.
pub fn temporary_status(folder: &Path) -> ExitCode {
    match temporary_read_folder(folder) {
        Ok(status) if status.files.is_empty() => {
            println!("No workflow files in {}", folder.display());
            ExitCode::SUCCESS
        }
        Ok(status) => {
            print!("{}", temporary_render(&status));
            if status.files.iter().any(|file| file.problem.is_some()) {
                ExitCode::FAILURE
            } else {
                ExitCode::SUCCESS
            }
        }
        Err(error) => {
            eprintln!("ura: {error}");
            ExitCode::FAILURE
        }
    }
}

// TEMPORARY: replaced by the CLI feature.
/// One line per file: its name, padded to the longest name plus two spaces, then its status, or
/// `invalid: ` and its problem.
pub fn temporary_render(status: &FolderStatus) -> String {
    let width = status
        .files
        .iter()
        .map(|file| file.file.len())
        .max()
        .unwrap_or(0)
        + 2;
    status
        .files
        .iter()
        .map(|file| {
            let value = match (&file.status, &file.problem) {
                (Some(status), _) => status.as_str().to_string(),
                (None, problem) => format!("invalid: {}", problem.as_deref().unwrap_or("")),
            };
            format!("{:width$}{value}\n", file.file)
        })
        .collect()
}
