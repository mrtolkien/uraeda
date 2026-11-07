//! The undo of the web UI's writes. Each undoable write takes a last optional `undo` token: given
//! one, it runs through the core's `recorded` with its scope, and the change it made waits under the
//! token for `takeChange`, the latest 64 kept. `applyChange` replays a change backwards or forwards,
//! and `committedSince` says whether a commit holds its files since.

use std::collections::VecDeque;
use std::path::Path;
use std::sync::{Mutex, PoisonError};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use napi::bindgen_prelude::{AsyncTask, ToNapiValue, TypeName};
use napi_derive::napi;
use uraeda_core::api::undo::{self, Change, ChangedFile, Direction};
use uraeda_core::api::{self, ApiError};

use super::{Job, job};

/// The changes recorded and not taken yet, by token, the oldest first.
static CHANGES: Mutex<VecDeque<(String, Change)>> = Mutex::new(VecDeque::new());
/// How many changes wait at most: a token never taken goes once 64 newer ones came.
const KEPT: usize = 64;

/// A change as the server hands it over and back: the commit its checkout was at, and each file's
/// bytes before and after, base64-encoded, `null` on the side where it did not exist.
#[napi(object, use_nullable = true)]
#[derive(Clone)]
pub struct ChangeView {
    pub commit: Option<String>,
    pub files: Vec<ChangedFileView>,
}

/// A file of a change, by its path from the top level.
#[napi(object, use_nullable = true)]
#[derive(Clone)]
pub struct ChangedFileView {
    pub path: String,
    pub before: Option<String>,
    pub after: Option<String>,
}

impl From<Change> for ChangeView {
    fn from(change: Change) -> ChangeView {
        let encode = |bytes: Option<Vec<u8>>| bytes.map(|bytes| STANDARD.encode(bytes));
        ChangeView {
            commit: change.commit,
            files: change
                .files
                .into_iter()
                .map(|file| ChangedFileView {
                    path: file.path,
                    before: encode(file.before),
                    after: encode(file.after),
                })
                .collect(),
        }
    }
}

impl TryFrom<ChangeView> for Change {
    type Error = ApiError;

    fn try_from(view: ChangeView) -> Result<Change, ApiError> {
        let decode = |path: &str, bytes: Option<String>| {
            bytes
                .map(|bytes| STANDARD.decode(bytes))
                .transpose()
                .map_err(|_| refused(format!("{path}: its bytes are not base64")))
        };
        let files = view
            .files
            .into_iter()
            .map(|file| {
                Ok(ChangedFile {
                    before: decode(&file.path, file.before)?,
                    after: decode(&file.path, file.after)?,
                    path: file.path,
                })
            })
            .collect::<Result<_, ApiError>>()?;
        Ok(Change {
            commit: view.commit,
            files,
        })
    }
}

fn refused(message: String) -> ApiError {
    ApiError {
        code: "refused",
        message,
        output: None,
    }
}

/// Runs `write`, recording the change it makes under `scope` when a `token` is given, for
/// `takeChange`. A failing write records nothing.
pub(crate) fn recording<T: ToNapiValue + TypeName + Send + 'static>(
    repo: String,
    token: Option<String>,
    scope: impl FnOnce(&Path) -> Result<Vec<String>, ApiError> + Send + 'static,
    write: impl FnOnce(&Path) -> Result<T, ApiError> + Send + 'static,
) -> AsyncTask<Job<T>> {
    job(move || {
        let repo = Path::new(&repo);
        let Some(token) = token else {
            return write(repo);
        };
        let scope = scope(repo)?;
        let (value, change) = undo::recorded(repo, &scope, || write(repo))?;
        keep(token, change);
        Ok(value)
    })
}

/// One of the core's scopes, for [`recording`].
pub(crate) fn scope(
    paths: &'static [&'static str],
) -> impl FnOnce(&Path) -> Result<Vec<String>, ApiError> + Send + 'static {
    move |_| Ok(paths.iter().map(|path| (*path).to_string()).collect())
}

fn keep(token: String, change: Change) {
    let mut changes = CHANGES.lock().unwrap_or_else(PoisonError::into_inner);
    changes.retain(|(kept, _)| *kept != token);
    changes.push_back((token, change));
    while changes.len() > KEPT {
        changes.pop_front();
    }
}

/// The change recorded under `token`, handed over once: `null` when none was, or it was taken.
#[napi]
pub fn take_change(token: String) -> Option<ChangeView> {
    let mut changes = CHANGES.lock().unwrap_or_else(PoisonError::into_inner);
    let index = changes.iter().position(|(kept, _)| *kept == token)?;
    changes.remove(index).map(|(_, change)| change.into())
}

/// Writes back a change's `before` side for `undo`, or its `after` side for `redo`, once every file
/// holds the other. Refused with `conflict: Could not undo: “<subject>” changed since in <file>.`
/// otherwise, nothing written. Resolves with the commit the files' checkout is at.
#[napi(ts_return_type = "Promise<string | null>")]
pub fn apply_change(
    repo: String,
    change: ChangeView,
    #[napi(ts_arg_type = "'undo' | 'redo'")] direction: String,
    subject: String,
) -> AsyncTask<Job<Option<String>>> {
    job(move || {
        let direction = match direction.as_str() {
            "undo" => Direction::Undo,
            "redo" => Direction::Redo,
            other => return Err(refused(format!("no direction {other}"))),
        };
        api::undo::apply_change(Path::new(&repo), &change.try_into()?, direction, &subject)
    })
}

/// Whether a commit since the change holds any of its files otherwise: its undo then asks first.
#[napi(ts_return_type = "Promise<boolean>")]
pub fn committed_since(repo: String, change: ChangeView) -> AsyncTask<Job<bool>> {
    job(move || api::undo::committed_since(Path::new(&repo), &change.try_into()?))
}
