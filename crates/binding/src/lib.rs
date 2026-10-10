//! The core's Node binding. Every type it returns is declared in the core, and napi-rs generates
//! its TypeScript declarations in `packages/binding/index.d.ts`.

use std::path::Path;

use napi_derive::napi;
use uraeda_core::temporary_status::{
    FolderStatus, temporary_read_folder as read_folder, temporary_read_specs as read_specs,
};

/// TEMPORARY: replaced by the CLI feature.
///
/// Reads the workflow files of one feature folder.
#[napi]
pub fn temporary_read_folder(path: String) -> napi::Result<FolderStatus> {
    read_folder(Path::new(&path)).map_err(|error| napi::Error::from_reason(error.to_string()))
}

/// TEMPORARY: replaced by the CLI feature.
///
/// Reads every feature folder of a `specs/` folder, newest first.
#[napi]
pub fn temporary_read_specs(path: String) -> napi::Result<Vec<FolderStatus>> {
    read_specs(Path::new(&path)).map_err(|error| napi::Error::from_reason(error.to_string()))
}
