//! The custom `uraeda/*` requests: reads the standard requests do not cover, answered from the open
//! text when the file is open, else from disk.

use lsp_types::Uri;
use serde::Deserialize;
use uraeda_core::check::{self, Field};

use crate::documents::Documents;

/// The params of a request about one file.
#[derive(Deserialize)]
pub(crate) struct FileParams {
    pub uri: Uri,
}

/// `uraeda/fields`.
pub(crate) const FIELDS: &str = "uraeda/fields";

/// `uraeda/fields { uri }`: the file's frontmatter fields, with their lines, values, and allowed
/// values.
pub(crate) fn fields(documents: &Documents, params: FileParams) -> Vec<Field> {
    fields_of(documents, &params.uri)
}

/// The fields of a file under `specs/`: from its open text, else from disk; none elsewhere.
pub(crate) fn fields_of(documents: &Documents, uri: &Uri) -> Vec<Field> {
    let Some(path) = documents.path(uri).filter(|path| documents.in_specs(path)) else {
        return Vec::new();
    };
    match documents.text(uri) {
        Some(text) => check::fields(&documents.root, &path, text),
        None => check::fields_on_disk(&documents.root, &path),
    }
}
