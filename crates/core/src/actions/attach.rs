//! Attaching an image to a workflow file, as the attachments decision says: re-encoded, saved in
//! the `images/` folder next to the file, and linked from it. A single proposal file or note file
//! becomes a folder first.

use std::fs;
use std::path::Path;

use crate::files::markdown::link_text;
use crate::files::retarget::retarget as retarget_links;
use crate::images::Encoded;

use super::ActionError;
use super::place::Place;

/// The lists that link proposal files and note files, from `specs/`.
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
    /// The file's new path, when a single proposal file or note file became a folder.
    pub moved: Option<String>,
}

/// Saves an image, as [`crate::images::encode`] checked and encoded it, next to the markdown file
/// `path`, a file directly in a feature's, a change's, a proposal file's, or a note file's folder,
/// or a single proposal file or note file, in `place`. `name` is the image's original file name,
/// `None` for a pasted image, named after the time `stamp` gives. A failed write leaves the files
/// as they were.
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
    let single = matches!(folder, "specs/proposals" | "specs/notes");
    if !place.root.join(path).is_file() {
        return Err(ActionError::Refused(match single {
            true => format!("no proposal or note file {path}"),
            false => format!("{path}: no such file"),
        }));
    }

    let (base, alt) = names(name, stamp);

    let (folder, image, moved) = if single {
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
        "{path} is not a markdown file of a feature, a change, a proposal file, or a note file"
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
    save_bytes(root, folder, base, encoded.extension, &encoded.bytes)
}

/// Writes `bytes` in `<folder>/images/` as `<base>.<extension>`, or `<base>`, without an extension,
/// numbered as [`save`] numbers it when the name is taken. Returns its file name.
pub(crate) fn save_bytes(
    root: &Path,
    folder: &str,
    base: &str,
    extension: &str,
    bytes: &[u8],
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
        let numbered = match number {
            1 => base.to_string(),
            _ => format!("{base}-{number}"),
        };
        let name = match extension {
            "" => numbered,
            extension => format!("{numbered}.{extension}"),
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
                if let Err(error) = file.write_all(bytes) {
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

/// Moves the single proposal file `specs/proposals/<slug>.md` to
/// `specs/proposals/<slug>/proposal.md`, or the note file `specs/notes/<slug>.md` to
/// `specs/notes/<slug>/note.md`, numbering the folder when it exists, with the image in its
/// `images/`, and points the links of the priorities and the inbox to the new path. Claims the
/// folder, saves the image, moves the file, then edits the lists: a failure undoes what was done.
/// Returns the new path and the image's file name.
fn into_folder(
    place: &Place,
    path: &str,
    base: &str,
    encoded: &Encoded,
) -> Result<(String, String), ActionError> {
    let (folder, moved) = claim(place, path)?;
    let result = save(&place.root, &folder, base, encoded).and_then(|image| {
        fs::rename(place.root.join(path), place.root.join(&moved)).map_err(failed)?;
        if let Err(error) = retarget(place, path, &moved) {
            let _ = fs::rename(place.root.join(&moved), place.root.join(path));
            return Err(error);
        }
        Ok((moved, image))
    });
    // The folder is removed only once the file is back in its place.
    if result.is_err() && place.root.join(path).is_file() {
        let _ = fs::remove_dir_all(place.root.join(&folder));
    }
    result
}

/// Whether `path` is a single proposal file or note file, `specs/proposals/<slug>.md` or
/// `specs/notes/<slug>.md`, which an image makes a folder.
pub(crate) fn is_single(path: &str) -> bool {
    path.rsplit_once('/')
        .is_some_and(|(folder, _)| matches!(folder, "specs/proposals" | "specs/notes"))
}

/// Claims the folder the single file `path` becomes, named after it, numbered when the name is
/// taken. Returns the folder and the path of its main file.
fn claim(place: &Place, path: &str) -> Result<(String, String), ActionError> {
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
    let main = if parent == "specs/notes" {
        "note.md"
    } else {
        "proposal.md"
    };
    let moved = format!("{folder}/{main}");
    Ok((folder, moved))
}

/// Moves the single file `path` into a folder of its own, as an attached image does, without an
/// image, and points the lists' links to it at its new path, or none of it. Returns the new path.
pub(crate) fn to_folder(place: &Place, path: &str) -> Result<String, ActionError> {
    let (folder, moved) = claim(place, path)?;
    let result = fs::rename(place.root.join(path), place.root.join(&moved))
        .map_err(failed)
        .and_then(|()| {
            if let Err(error) = retarget(place, path, &moved) {
                let _ = fs::rename(place.root.join(&moved), place.root.join(path));
                return Err(error);
            }
            Ok(())
        });
    if let Err(error) = result {
        if place.root.join(path).is_file() {
            let _ = fs::remove_dir_all(place.root.join(&folder));
        }
        return Err(error);
    }
    Ok(moved)
}

/// The Undo of [`to_folder`]: the folder's main file `moved` back to the single file `path`, the
/// lists' links with it, while the folder holds only it and an empty `images/`, and nothing stands
/// at `path`. Returns whether it moved it back.
pub(crate) fn to_file(place: &Place, moved: &str, path: &str) -> Result<bool, ActionError> {
    let Some((folder, main)) = moved.rsplit_once('/') else {
        return Ok(false);
    };
    let images = place.root.join(folder).join("images");
    let only_main = fs::read_dir(place.root.join(folder))?
        .flatten()
        .all(|entry| entry.file_name() == main || entry.file_name() == "images");
    let images_empty =
        !images.exists() || (images.is_dir() && fs::read_dir(&images)?.next().is_none());
    if !only_main || !images_empty || place.root.join(path).exists() {
        return Ok(false);
    }
    fs::rename(place.root.join(moved), place.root.join(path))?;
    // Out of its folder, where [`retarget`] reaches no file.
    let back = |text: &str| crate::files::retarget::moved(text, moved, path);
    if let Err(error) = edit_lists(place, back) {
        let _ = fs::rename(place.root.join(path), place.root.join(moved));
        return Err(error);
    }
    let _ = fs::remove_dir(&images);
    let _ = fs::remove_dir(place.root.join(folder));
    Ok(true)
}

/// Points the links of the priorities and of the inbox to the file `from` at `to`, leaving both
/// files as they were when a write fails.
pub(crate) fn retarget(place: &Place, from: &str, to: &str) -> Result<(), ActionError> {
    edit_lists(place, |text| retarget_links(text, from, to))
}

/// Writes each list, the priorities and the inbox, as `edit` gives it, leaving both as they were
/// when a write fails.
fn edit_lists(place: &Place, edit: impl Fn(&str) -> String) -> Result<(), ActionError> {
    let mut written: Vec<(std::path::PathBuf, String)> = Vec::new();
    let result = (|| {
        for list in LISTS {
            let file = place.root.join(list);
            let text = match fs::read_to_string(&file) {
                Ok(text) => text,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
                Err(error) => return Err(failed(error)),
            };
            let edited = edit(&text);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        assert_eq!(
            stem("Screenshot 2026-10-14 at 10.35.12.png"),
            "Screenshot 2026-10-14 at 10.35.12"
        );
        assert_eq!(stem("/home/me/shots/login.png"), "login");
        assert_eq!(stem("C:\\shots\\login.png"), "login");
        assert_eq!(stem("login"), "login");
        assert_eq!(
            file_name("Screenshot 2026-10-14 at 10.35.12"),
            "screenshot-2026-10-14-at-10-35-12"
        );
        assert_eq!(file_name("Écran"), "cran");
        assert_eq!(file_name("--"), "image");
        assert_eq!(file_name(&format!("{}-b", "a".repeat(59))), "a".repeat(59));
        assert_eq!(link_text("a[b]\\c"), "a\\[b\\]\\\\c");
        assert_eq!(stem(".png"), "");
        assert_eq!(alt(""), "image");
        assert_eq!(alt(" a \n\t b "), "a b");
    }
}
