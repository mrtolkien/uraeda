//! A note's image taken out of its proposal file, over the proposal file read at `previous`.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::api::undo;
use uraeda_core::files::inbox::Inbox;

use super::Job;
use super::undo::recording_keeping;

/// Takes the image at `image` out of the note file or proposal file at `file`, both from the top
/// level: the lines linking it go, and its file stays. Refused as a conflict when the file changed
/// since it was read at `previous`. The image is kept with the change: the next commit deletes it
/// unlinked, and the undo writes it back.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn remove_note_image(
    repo: String,
    file: String,
    image: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording_keeping(
        repo,
        undo,
        {
            let scope = undo::note_image(&file);
            move |_: &Path| Ok(scope)
        },
        vec![image.clone()],
        move |repo: &Path| api::remove_note_image(repo, &file, &image, &previous),
    )
}
