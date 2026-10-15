//! `uraeda.attachImage`: saves an image next to a workflow file, and gives its link.

use std::path::PathBuf;

use lsp_server::ResponseError;
use lsp_types::Uri;
use serde::Deserialize;
use serde_json::Value;
use uraeda_core::api;
use uraeda_core::images::{self, ImageError};

use super::{
    Done, NOT_WORKFLOW, Outcome, absolute, core, on_default_branch, priorities_path, relative,
};
use crate::documents::Documents;
use crate::requests::refused;

/// The command's progress: the image's file name, or a pasted image.
pub(super) fn title(args: &Value) -> String {
    let name = args.get("name").and_then(Value::as_str);
    format!("Adding {}…", name.unwrap_or("pasted image"))
}

#[derive(Deserialize)]
pub(super) struct AttachImageArgs {
    uri: Uri,
    /// The image file to attach, absolute: a temporary file for the clipboard's image.
    path: PathBuf,
    /// The image's file name, `None` for a pasted image.
    name: Option<String>,
}

/// The image file's bytes, read before any checkout is reached, which may add a worktree. A file
/// over the core's 20 MB is refused by its size, with the core's text, without reading it. The
/// OS's error code is left out: "No such file or directory", not "... (os error 2)".
fn read_image(args: &AttachImageArgs) -> Result<Vec<u8>, ResponseError> {
    let unread = |error: std::io::Error| {
        let error = error.to_string();
        let error = error.split(" (os error ").next().unwrap_or_default();
        refused(format!(
            "{} could not be read: {error}.",
            args.path.display()
        ))
    };
    let size = std::fs::metadata(&args.path).map_err(unread)?.len();
    if size > images::MAX_BYTES as u64 {
        let name = args.name.as_deref().unwrap_or("pasted image").into();
        let bytes = usize::try_from(size).unwrap_or(usize::MAX);
        return Err(refused(ImageError::Size { name, bytes }.to_string()));
    }
    std::fs::read(&args.path).map_err(unread)
}

/// `uraeda.attachImage { uri, path, name? }`: saves the image file at `path` next to the file, a
/// single-file draft becoming a folder first, and returns its link, to insert where the editor's
/// cursor was. Writes the file only when a draft moves; commits nothing.
pub(super) fn attach_image(
    documents: &Documents,
    args: AttachImageArgs,
) -> Result<Done, ResponseError> {
    let root = &documents.root;
    let path = relative(documents, &args.uri).ok_or_else(|| refused(NOT_WORKFLOW))?;
    // The feature's or the change's folder, None for a draft; checked without writing anything.
    let folder = if path.starts_with("specs/drafts/") || path.starts_with("specs/backlog/") {
        on_default_branch(documents, &path)?;
        None
    } else {
        let folder = path
            .strip_prefix("specs/")
            .map(|rest| rest.strip_prefix("changes/").unwrap_or(rest))
            .and_then(|rest| rest.split_once('/'))
            .filter(|(_, name)| !name.contains('/'))
            .map(|(folder, _)| folder)
            .ok_or_else(|| {
                refused(format!(
                    "{path} is not a markdown file of a feature, a change, or a draft"
                ))
            })?;
        Some(folder)
    };
    let bytes = read_image(&args)?;
    let attached = core(api::attach_image(root, &path, &bytes, args.name.as_deref()))?;
    // The checkout the core wrote in: the default branch's for a draft, else the feature's or the
    // change's, reached by now.
    let checkout = match folder {
        None => core(api::default_root(root))?,
        Some(folder) => PathBuf::from(core(api::work_dir(root, folder))?),
    };
    let mut written = vec![absolute(checkout.join(&attached.path))];
    if let Some(moved) = &attached.moved {
        written.push(absolute(checkout.join(moved)));
        written.push(absolute(checkout.join(priorities_path())));
    }
    // A draft is the default branch's: from another branch's checkout, the link goes into the
    // default branch's file, which opens in place of this copy (the git decision).
    let file = attached.moved.as_deref().unwrap_or(&path);
    let elsewhere = std::fs::canonicalize(&checkout).ok() != std::fs::canonicalize(root).ok();
    let opened = (attached.moved.is_some() || elsewhere).then(|| absolute(checkout.join(file)));
    Ok(Done {
        link: Some(attached.link),
        ..Done::from(Outcome { opened, written })
    })
}
