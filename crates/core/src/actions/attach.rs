//! Attaching an image to a workflow file, as the attachments decision says: re-encoded, saved in
//! the `images/` folder next to the file, and linked from it. A single-file draft becomes a folder
//! first.

use std::fs;
use std::path::Path;

use crate::files::markdown::link_text;
use crate::files::retarget::retarget as retarget_links;
use crate::images::Encoded;

use super::ActionError;
use super::place::Place;

/// The lists that link drafts, from `specs/`.
const LISTS: [&str; 2] = ["specs/PRIORITIES.md", "specs/INBOX.md"];

/// The longest image name, without its extension.
const NAME_LIMIT: usize = 60;

/// An image saved next to a workflow file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Attached {
    /// The image's path, from the top level.
    pub path: String,
    /// The markdown that links it from the file.
    pub link: String,
    /// The file's new path, when a single-file draft became a folder.
    pub moved: Option<String>,
}

/// Saves an image, as [`crate::images::encode`] checked and encoded it, next to the markdown
/// file `path`, a file directly in a feature's, a change's, or a draft's folder, or a single-file
/// draft, in `place`. `name` is the image's original file name, `None` for a pasted image, named
/// after the time `stamp` gives. A failed write leaves the files as they were.
pub fn attach(
    place: &Place,
    path: &str,
    encoded: &Encoded,
    name: Option<&str>,
    stamp: impl FnOnce() -> String,
) -> Result<Attached, ActionError> {
    let Some((folder, file)) = path.rsplit_once('/') else {
        return Err(not_markdown(path));
    };
    if !file.ends_with(".md") || file.len() == ".md".len() {
        return Err(not_markdown(path));
    }
    let single_draft = matches!(folder, "specs/drafts" | "specs/backlog");
    if !place.root.join(path).is_file() {
        return Err(ActionError::Refused(match single_draft {
            true => format!("no draft {path}"),
            false => format!("{path}: no such file"),
        }));
    }

    let (base, alt) = names(name, stamp);

    let (folder, image, moved) = if single_draft {
        let (moved, image) = into_folder(place, path, &base, encoded)?;
        let folder = moved.rsplit_once('/').map_or("", |(folder, _)| folder);
        (folder.to_string(), image, Some(moved))
    } else {
        (
            folder.to_string(),
            save(&place.root, folder, &base, encoded)?,
            None,
        )
    };
    Ok(Attached {
        path: format!("{folder}/images/{image}"),
        link: format!("![{alt}](images/{image})"),
        moved,
    })
}

/// An image's file name without its extension, and its alt text: from its original file name, or,
/// for a pasted image, from the time `stamp` gives.
fn names(name: Option<&str>, stamp: impl FnOnce() -> String) -> (String, String) {
    match name.map(stem) {
        Some(stem) => (file_name(stem), alt(stem)),
        None => (format!("pasted-{}", stamp()), "pasted image".to_string()),
    }
}

/// Saves an image in the `images/` folder of `folder`, named as [`attach`] names it, and gives
/// the markdown that links it from a file of `folder`.
pub(crate) fn save_in(
    place: &Place,
    folder: &str,
    encoded: &Encoded,
    name: Option<&str>,
    stamp: impl FnOnce() -> String,
) -> Result<String, ActionError> {
    let (base, alt) = names(name, stamp);
    let image = save(&place.root, folder, &base, encoded)?;
    Ok(format!("![{alt}](images/{image})"))
}

fn not_markdown(path: &str) -> ActionError {
    ActionError::Refused(format!(
        "{path} is not a markdown file of a feature, a change, or a draft"
    ))
}

/// The spec's refusal for a write that fails on disk.
fn failed(error: std::io::Error) -> ActionError {
    ActionError::Refused(format!("The image could not be saved: {error}."))
}

/// A file name without its folders and its last extension, whatever it is: `.png` has none left.
fn stem(name: &str) -> &str {
    let file = name.rsplit(['/', '\\']).next().unwrap_or(name);
    file.rsplit_once('.').map_or(file, |(stem, _)| stem)
}

/// An image's name: lowercase, every run of characters other than `a-z` and `0-9` turned into one
/// `-`, trimmed of `-`, at most 60 characters, or `image` when nothing is left.
fn file_name(stem: &str) -> String {
    let mut name = String::new();
    for c in stem.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            name.push(c);
        } else if !name.ends_with('-') {
            name.push('-');
        }
    }
    let name: String = name.trim_matches('-').chars().take(NAME_LIMIT).collect();
    let name = name.trim_end_matches('-');
    if name.is_empty() {
        "image".to_string()
    } else {
        name.to_string()
    }
}

/// An image's alt text: its name with every run of spaces and line breaks turned into one space,
/// escaped, or `image` when nothing is left.
fn alt(stem: &str) -> String {
    let text = stem.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.is_empty() {
        "image".to_string()
    } else {
        link_text(&text)
    }
}

/// Writes an image in `<folder>/images/` as `<base>.<extension>`, or `<base>-2`, `<base>-3`, and so
/// on when the name is taken, in the working tree `root`. Returns its file name. Never writes
/// through a symbolic link.
pub(crate) fn save(
    root: &Path,
    folder: &str,
    base: &str,
    encoded: &Encoded,
) -> Result<String, ActionError> {
    let dir = root.join(folder).join("images");
    fs::create_dir_all(&dir).map_err(failed)?;
    let root = fs::canonicalize(root).map_err(failed)?;
    if fs::canonicalize(&dir).map_err(failed)? != root.join(folder).join("images") {
        return Err(ActionError::Refused(format!(
            "The image could not be saved: {folder}/images goes through a symbolic link."
        )));
    }
    let mut number = 1;
    loop {
        let name = match number {
            1 => format!("{base}.{}", encoded.extension),
            _ => format!("{base}-{number}.{}", encoded.extension),
        };
        // `create_new` never overwrites, even when another process writes the same name, and never
        // follows a symbolic link: a link takes the name.
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dir.join(&name))
        {
            Ok(mut file) => {
                use std::io::Write;
                if let Err(error) = file.write_all(&encoded.bytes) {
                    let _ = fs::remove_file(dir.join(&name));
                    return Err(failed(error));
                }
                return Ok(name);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => number += 1,
            Err(error) => return Err(failed(error)),
        }
    }
}

/// Moves the single-file draft `specs/<drafts|backlog>/<slug>.md` to
/// `specs/<drafts|backlog>/<slug>/proposal.md`, numbering the folder when it exists, with the image
/// in its `images/`, and points the links of the priorities and the inbox to the new path. Claims
/// the folder, saves the image, moves the draft, then edits the lists: a failure undoes what was
/// done. Returns the new path and the image's file name.
fn into_folder(
    place: &Place,
    path: &str,
    base: &str,
    encoded: &Encoded,
) -> Result<(String, String), ActionError> {
    let (parent, file) = path.rsplit_once('/').unwrap_or(("specs", path));
    let slug = file.strip_suffix(".md").unwrap_or(file);
    let mut folder = format!("{parent}/{slug}");
    let mut number = 2;
    // `create_dir` claims a free name even when another process claims one at the same time.
    loop {
        match fs::create_dir(place.root.join(&folder)) {
            Ok(()) => break,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                folder = format!("{parent}/{slug}-{number}");
                number += 1;
            }
            Err(error) => return Err(failed(error)),
        }
    }
    let moved = format!("{folder}/proposal.md");
    let result = save(&place.root, &folder, base, encoded).and_then(|image| {
        fs::rename(place.root.join(path), place.root.join(&moved)).map_err(failed)?;
        if let Err(error) = retarget(place, path, &moved) {
            let _ = fs::rename(place.root.join(&moved), place.root.join(path));
            return Err(error);
        }
        Ok((moved, image))
    });
    // The folder is removed only once the draft is back in its place.
    if result.is_err() && place.root.join(path).is_file() {
        let _ = fs::remove_dir_all(place.root.join(&folder));
    }
    result
}

/// Points the links of the priorities and of the inbox to the draft `from` at `to`, leaving both
/// files as they were when a write fails.
pub(crate) fn retarget(place: &Place, from: &str, to: &str) -> Result<(), ActionError> {
    let mut written: Vec<(std::path::PathBuf, String)> = Vec::new();
    let result = (|| {
        for list in LISTS {
            let file = place.root.join(list);
            let text = match fs::read_to_string(&file) {
                Ok(text) => text,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => return Err(failed(error)),
            };
            let edited = retarget_links(&text, from, to);
            if edited == text {
                continue;
            }
            written.push((file.clone(), text));
            fs::write(&file, edited).map_err(failed)?;
        }
        Ok(())
    })();
    if result.is_err() {
        for (file, text) in written {
            let _ = fs::write(file, text);
        }
    }
    result
}
