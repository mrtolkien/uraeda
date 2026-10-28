//! A note's image taken out of its proposal file, over the proposal file read at `previous`, and
//! taken back.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::actions::inbox::RemovedImage;
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;

use super::{Job, job};

/// An image's removal's answer: the inbox, and what `restoreNoteImage` takes back.
#[napi(object)]
pub struct NoteImageRemoved {
    pub inbox: Inbox,
    pub removed: RemovedImage,
}

/// Takes the image at `image` out of the proposal file at `proposal file`, both from the top level:
/// the lines linking it go, and its file stays. Refused as a conflict when the proposal file
/// changed since it was read at `previous`.
#[napi(ts_return_type = "Promise<NoteImageRemoved>")]
pub fn remove_note_image(
    repo: String,
    file: String,
    image: String,
    previous: String,
) -> AsyncTask<Job<NoteImageRemoved>> {
    job(move || {
        let (inbox, removed) = api::remove_note_image(Path::new(&repo), &file, &image, &previous)?;
        Ok(NoteImageRemoved { inbox, removed })
    })
}

/// Takes back an image's removal: its lines go back where they were, over the proposal file as it
/// is now. Refused once the lines there changed, or the proposal file links the image again.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn restore_note_image(repo: String, removed: RemovedImage) -> AsyncTask<Job<Inbox>> {
    job(move || api::restore_note_image(Path::new(&repo), &removed))
}
