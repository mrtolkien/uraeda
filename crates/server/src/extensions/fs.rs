//! `uraeda:fs`: the owner's files, read and written whole, on the extension's own thread.
//!
//! An extension is the owner's code and reaches any path the owner does, as it did through
//! Node's `fs` (ruling R224). Only whole files and folders: a path that is neither, as a
//! pipe, is refused, since reading one could hold the VM's thread for ever. A file is read up
//! to [`MOST_BYTES`]: the server holds it whole before the VM's limit applies.

use std::fs;
use std::io::{Read as _, Write as _};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Value, json};

use super::graph::normal;

/// The largest file an extension reads at once, as `fetch` reads the largest answer: it is held
/// whole in the server's memory before the VM's own limit of 256 MiB applies.
const MOST_BYTES: u64 = 64 * 1024 * 1024;

/// Runs the operation `fs.<op>`.
pub(super) fn op(op: &str, payload: &Value) -> Result<Value, String> {
    let text = |field: &str| {
        let value = payload[field].as_str();
        value.ok_or_else(|| format!("uraeda:fs: `{field}` must be a text"))
    };
    match op {
        "join" => Ok(json!(join(&payload["parts"])?)),
        "relative" => Ok(json!(relative(text("from")?, text("to")?))),
        "parent" => Ok(json!(shown(Path::new(text("path")?).parent()))),
        "name" => Ok(json!(shown(
            Path::new(text("path")?).file_name().map(Path::new)
        ))),
        "rename" => {
            let (from, to) = (absolute(text("from")?)?, absolute(text("to")?)?);
            fs::rename(&from, &to).map_err(|error| failed("rename", &from, &error))?;
            Ok(Value::Null)
        }
        _ => on_path(op, &absolute(text("path")?)?, payload),
    }
}

/// The operations on one absolute path.
fn on_path(op: &str, path: &Path, payload: &Value) -> Result<Value, String> {
    let done = |result: std::io::Result<()>, doing: &str| {
        let result = result.map(|()| Value::Null);
        result.map_err(|error| failed(doing, path, &error))
    };
    let given = |field: &str| payload[field].as_str().unwrap_or_default();
    match op {
        "readText" => {
            let bytes = read(path)?;
            let text = String::from_utf8(bytes);
            text.map(Value::String)
                .map_err(|_| format!("{} is not UTF-8 text", path.display()))
        }
        "readBytes" => Ok(json!(STANDARD.encode(read(path)?))),
        "writeText" => done(write(path, given("text").as_bytes(), false), "write"),
        "appendText" => done(write(path, given("text").as_bytes(), true), "write"),
        "writeBytes" => {
            let bytes = STANDARD.decode(given("bytes"));
            let bytes = bytes.map_err(|error| format!("uraeda:fs: {error}"))?;
            done(write(path, &bytes, false), "write")
        }
        "list" => list(path),
        "stat" => Ok(stat(path)),
        "makeFolder" => done(fs::create_dir_all(path), "make"),
        "remove" => done(remove(path), "remove"),
        _ => Err(format!("uraeda:fs has no `{op}`")),
    }
}

/// A path an operation takes: absolute, since the server's own folder means nothing to an
/// extension.
fn absolute(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    if path.is_absolute() {
        Ok(path.to_owned())
    } else {
        Err(format!("{} is not an absolute path", path.display()))
    }
}

fn failed(doing: &str, path: &Path, error: &std::io::Error) -> String {
    format!("cannot {doing} {}: {}", path.display(), error.kind())
}

fn shown(path: Option<&Path>) -> String {
    path.map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Why a path that is there and is no file cannot be read or written whole.
fn whole(path: &Path) -> Result<(), String> {
    match fs::metadata(path) {
        Ok(metadata) if !metadata.is_file() => Err(format!("{} is not a file", path.display())),
        _ => Ok(()),
    }
}

/// A file's bytes, up to [`MOST_BYTES`]: a larger one is refused before anything is held, and
/// one that grows past it as it is read too.
fn read(path: &Path) -> Result<Vec<u8>, String> {
    whole(path)?;
    let over = || {
        let most = MOST_BYTES / 1024 / 1024;
        format!(
            "{} is over {most} MB, the most an extension reads at once",
            path.display()
        )
    };
    let unread = |error| failed("read", path, &error);
    let file = fs::File::open(path).map_err(unread)?;
    let size = file.metadata().map_err(unread)?.len();
    if size > MOST_BYTES {
        return Err(over());
    }
    let mut bytes = Vec::with_capacity(usize::try_from(size).unwrap_or_default());
    file.take(MOST_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(unread)?;
    match bytes.len() as u64 > MOST_BYTES {
        true => Err(over()),
        false => Ok(bytes),
    }
}

fn write(path: &Path, bytes: &[u8], append: bool) -> std::io::Result<()> {
    whole(path).map_err(std::io::Error::other)?;
    let mut options = fs::OpenOptions::new();
    options.create(true).write(true);
    if append {
        options.append(true);
    } else {
        options.truncate(true);
    }
    options.open(path)?.write_all(bytes)
}

/// A folder's entries, by name: each a `file`, a `folder`, a `link`, or `other`.
fn list(path: &Path) -> Result<Value, String> {
    let entries = fs::read_dir(path).map_err(|error| failed("list", path, &error))?;
    let mut rows: Vec<(String, &str)> = entries
        .filter_map(Result::ok)
        .map(|entry| {
            let kind = entry.file_type().map_or("other", |kind| {
                if kind.is_symlink() {
                    "link"
                } else if kind.is_dir() {
                    "folder"
                } else if kind.is_file() {
                    "file"
                } else {
                    "other"
                }
            });
            (entry.file_name().to_string_lossy().into_owned(), kind)
        })
        .collect();
    rows.sort();
    let rows = rows.into_iter();
    Ok(rows
        .map(|(name, kind)| json!({ "name": name, "kind": kind }))
        .collect())
}

/// What a path leads to, a link followed: null when nothing is there.
fn stat(path: &Path) -> Value {
    let Ok(metadata) = fs::metadata(path) else {
        return Value::Null;
    };
    let kind = if metadata.is_dir() {
        "folder"
    } else if metadata.is_file() {
        "file"
    } else {
        "other"
    };
    let modified = metadata.modified().ok();
    let modified = modified.and_then(|time| time.duration_since(UNIX_EPOCH).ok());
    let modified = modified.map(|since| u64::try_from(since.as_millis()).unwrap_or(u64::MAX));
    json!({ "kind": kind, "size": metadata.len(), "modified": modified })
}

/// Removes a file, a link, or a folder with everything in it. Nothing there is no failure.
fn remove(path: &Path) -> std::io::Result<()> {
    let removed = match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path),
        Ok(_) => fs::remove_file(path),
        Err(error) => Err(error),
    };
    match removed {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

/// The parts joined into one path, without its `.` and `..` parts: an absolute part starts
/// over, as a shell's `cd` would.
fn join(parts: &Value) -> Result<String, String> {
    let parts = parts.as_array().map(Vec::as_slice).unwrap_or_default();
    let mut joined = PathBuf::new();
    for part in parts {
        let part = part.as_str();
        joined.push(part.ok_or("uraeda:fs: a path's parts must be texts")?);
    }
    Ok(normal(&joined).to_string_lossy().into_owned())
}

/// The path from one folder to a path, as written: no link is followed.
fn relative(from: &str, to: &str) -> String {
    let (from, to) = (normal(Path::new(from)), normal(Path::new(to)));
    let (from, to): (Vec<Component>, Vec<Component>) =
        (from.components().collect(), to.components().collect());
    let shared = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let mut path = PathBuf::new();
    for _ in shared..from.len() {
        path.push("..");
    }
    path.extend(&to[shared..]);
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{MOST_BYTES, op};

    // The break it catches: a read that allocates the whole file in the server's memory, outside
    // the VM's limit, where a large file takes the server down with every extension and session.
    // The file is sparse: it takes no room on the disk.
    #[test]
    fn a_file_over_the_limit_is_refused_before_it_is_read() {
        let folder = tempfile::TempDir::new().unwrap();
        let (large, small) = (folder.path().join("large"), folder.path().join("small"));
        std::fs::File::create(&large)
            .unwrap()
            .set_len(MOST_BYTES + 1)
            .unwrap();
        std::fs::write(&small, "fits").unwrap();

        for read in ["readText", "readBytes"] {
            let refused = op(read, &json!({ "path": large })).unwrap_err();
            assert_eq!(
                refused,
                format!(
                    "{} is over 64 MB, the most an extension reads at once",
                    large.display()
                )
            );
        }
        assert_eq!(op("readText", &json!({ "path": small })), Ok(json!("fits")));
    }
}
