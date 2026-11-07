//! The colour themes: the shipped ones and the user's files in the config folder's `themes/`,
//! resolved, each file's problems with their lines. Reading never rejects.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::themes::{self, Themes};

use super::{Job, job};

/// The themes folder of the config folder `dir`, the path the server watches.
#[napi]
pub fn themes_folder(dir: String) -> String {
    themes::themes_dir(Path::new(&dir))
        .to_string_lossy()
        .into_owned()
}

/// The shipped themes and the themes of the config folder `dir`, with every file's problems.
#[napi(ts_return_type = "Promise<Themes>")]
pub fn read_themes(dir: String) -> AsyncTask<Job<Themes>> {
    job(move || Ok(themes::read(Path::new(&dir))))
}
