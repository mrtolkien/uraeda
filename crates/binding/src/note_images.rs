//! A note's image taken out of its proposal file, over the proposal file read at `previous`.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::api::undo;
use uraeda_core::files::inbox::Inbox;

use super::Job;
use super::undo::recording;

/// Takes the image at `image` out of the note file or proposal file at `file`, both from the top
/// level: the lines linking it go, and its file stays. Refused as a conflict when the file changed
/// since it was read at `previous`.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn remove_note_image(
    repo: String,
    file: String,
    image: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(
        repo,
        undo,
        {
            let scope = undo::note_image(&file);
            move |_: &Path| Ok(scope)
        },
        move |repo: &Path| api::remove_note_image(repo, &file, &image, &previous),
    )
}
