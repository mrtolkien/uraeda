//! The open documents, by URI, and the root they belong to: every capability reads the buffer's
//! text, not the disk, so it follows unsaved edits.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use lsp_types::Uri;

#[derive(Clone)]
pub(crate) struct Documents {
    /// The repository's top level, or the worktree's, holding `specs/`.
    pub root: PathBuf,
    texts: HashMap<Uri, String>,
}

impl Documents {
    pub fn new(root: PathBuf) -> Documents {
        let root = fs::canonicalize(&root).unwrap_or(root);
        Documents {
            root,
            texts: HashMap::new(),
        }
    }

    pub fn open(&mut self, uri: Uri, text: String) {
        self.texts.insert(uri, text);
    }

    pub fn change(&mut self, uri: Uri, text: String) {
        self.texts.insert(uri, text);
    }

    pub fn close(&mut self, uri: &Uri) {
        self.texts.remove(uri);
    }

    pub fn text(&self, uri: &Uri) -> Option<&str> {
        self.texts.get(uri).map(String::as_str)
    }

    /// The text of the file at `path`: its open document's, else the disk's.
    pub fn read(&self, path: &Path) -> Option<String> {
        self.opened(path)
            .map(str::to_string)
            .or_else(|| fs::read_to_string(path).ok())
    }

    /// The text of the open document of the file at `path`, if one is open.
    pub fn opened(&self, path: &Path) -> Option<&str> {
        self.texts
            .iter()
            .find(|(uri, _)| self.path(uri).as_deref() == Some(path))
            .map(|(_, text)| text.as_str())
    }

    /// The file a `file:` URI names, with symbolic links resolved when it exists.
    pub fn path(&self, uri: &Uri) -> Option<PathBuf> {
        file_path(uri).map(|path| canonical(&path))
    }

    /// Whether `path` is under the root's `specs/` folder.
    pub fn in_specs(&self, path: &Path) -> bool {
        path.starts_with(self.root.join("specs"))
    }
}

/// `path` with symbolic links resolved: the file's, else its folder's, else as it is.
fn canonical(path: &Path) -> PathBuf {
    if let Ok(path) = fs::canonicalize(path) {
        return path;
    }
    match (path.parent(), path.file_name()) {
        (Some(parent), Some(name)) => fs::canonicalize(parent)
            .map(|parent| parent.join(name))
            .unwrap_or_else(|_| path.to_path_buf()),
        _ => path.to_path_buf(),
    }
}

/// The `file:` URI of an absolute path, percent-encoding every byte but unreserved ones and `/`.
pub fn file_uri(path: &Path) -> Uri {
    let path = path.to_string_lossy().replace('\\', "/");
    let mut uri = String::from("file://");
    if !path.starts_with('/') {
        uri.push('/');
    }
    for byte in path.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                uri.push(byte as char);
            }
            _ => uri.push_str(&format!("%{byte:02X}")),
        }
    }
    Uri::from_str(&uri).expect("an encoded path is a valid URI")
}

/// The path of a `file:` URI, percent-decoded; `None` for another scheme.
pub(crate) fn file_path(uri: &Uri) -> Option<PathBuf> {
    let rest = uri.as_str().strip_prefix("file://")?;
    let path = rest.get(rest.find('/')?..)?;
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = bytes
            .get(index + 1..index + 3)
            .and_then(|hex| std::str::from_utf8(hex).ok())
            .and_then(|hex| u8::from_str_radix(hex, 16).ok());
        match (bytes[index], hex) {
            (b'%', Some(byte)) => {
                decoded.push(byte);
                index += 3;
            }
            (byte, _) => {
                decoded.push(byte);
                index += 1;
            }
        }
    }
    let path = String::from_utf8(decoded).ok()?;
    // `file:///C:/x` is `C:/x` on Windows.
    let path = match path.as_bytes() {
        [b'/', drive, b':', ..] if cfg!(windows) && drive.is_ascii_alphabetic() => &path[1..],
        _ => &path,
    };
    Some(PathBuf::from(path))
}

/// Line `index` of a text, 0-based, without its line ending.
pub(crate) fn line(text: &str, index: u32) -> Option<&str> {
    text.lines().nth(usize::try_from(index).ok()?)
}

/// The length of a line in UTF-16 code units, LSP's default position encoding.
pub(crate) fn utf16_len(line: &str) -> u32 {
    u32::try_from(line.encode_utf16().count()).unwrap_or(u32::MAX)
}

/// The byte offset in `line` of a UTF-16 column, clamped to the line's end.
pub(crate) fn byte_offset(line: &str, column: u32) -> usize {
    let mut units = 0;
    for (offset, char) in line.char_indices() {
        if units >= column {
            return offset;
        }
        units += u32::try_from(char.len_utf16()).unwrap_or(2);
    }
    line.len()
}
