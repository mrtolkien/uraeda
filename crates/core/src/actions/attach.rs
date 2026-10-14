//! Attaching an image to a workflow file, as the attachments decision says: re-encoded, saved in
//! the `images/` folder next to the file, and linked from it. A single-file draft becomes a folder
//! first.

use std::fs;

use crate::files::priorities;
use crate::images::{self, Encoded};
use crate::workspace::resolve;

use super::ActionError;
use super::place::Place;

const PRIORITIES: &str = "specs/PRIORITIES.md";

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

/// Saves an image next to the markdown file `path`, a file directly in a feature's, a bug's, or a
/// draft's folder, or a single-file draft, in `place`. `name` is the image's original file name,
/// `None` for a pasted image, named after `stamp`. The image is checked before anything is written.
pub fn attach(
    place: &Place,
    path: &str,
    bytes: &[u8],
    name: Option<&str>,
    stamp: &str,
) -> Result<Attached, ActionError> {
    let Some((folder, file)) = path.rsplit_once('/') else {
        return Err(not_markdown(path));
    };
    if !file.ends_with(".md") || file.len() == ".md".len() {
        return Err(not_markdown(path));
    }
    let single_draft = matches!(folder, "specs/drafts" | "specs/backlog");
    if single_draft && !place.root.join(path).is_file() {
        return Err(ActionError::Refused(format!("no draft {path}")));
    }

    let stem = name.map(stem).filter(|stem| !stem.is_empty());
    let encoded = images::encode(bytes, name.unwrap_or("pasted image"))
        .map_err(|error| ActionError::Refused(error.to_string()))?;

    let (folder, moved) = if single_draft {
        let moved = into_folder(place, path)?;
        let folder = moved.rsplit_once('/').map_or("", |(folder, _)| folder);
        (folder.to_string(), Some(moved))
    } else {
        (folder.to_string(), None)
    };

    let base = match stem {
        Some(stem) => file_name(stem),
        None => format!("pasted-{stamp}"),
    };
    let image = save(place, &folder, &base, &encoded)?;
    let alt = stem.map_or_else(|| "pasted image".to_string(), escape);
    Ok(Attached {
        path: format!("{folder}/images/{image}"),
        link: format!("![{alt}](images/{image})"),
        moved,
    })
}

fn not_markdown(path: &str) -> ActionError {
    ActionError::Refused(format!(
        "{path} is not a markdown file of a feature, a bug, or a draft"
    ))
}

/// A file name without its folders and its extension.
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

/// Alt text with `[`, `]`, and `\` escaped.
fn escape(text: &str) -> String {
    let mut escaped = String::new();
    for c in text.chars() {
        if matches!(c, '[' | ']' | '\\') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}

/// Writes an image in `<folder>/images/` as `<base>.<extension>`, or `<base>-2`, `<base>-3`, and so
/// on when the name is taken. Returns its file name.
fn save(place: &Place, folder: &str, base: &str, encoded: &Encoded) -> Result<String, ActionError> {
    let failed = |error: std::io::Error| {
        ActionError::Refused(format!("The image could not be saved: {error}."))
    };
    let dir = place.root.join(folder).join("images");
    fs::create_dir_all(&dir).map_err(failed)?;
    let mut number = 1;
    loop {
        let name = match number {
            1 => format!("{base}.{}", encoded.extension),
            _ => format!("{base}-{number}.{}", encoded.extension),
        };
        // `create_new` never overwrites, even when another process writes the same name.
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dir.join(&name))
        {
            Ok(mut file) => {
                use std::io::Write;
                file.write_all(&encoded.bytes).map_err(failed)?;
                return Ok(name);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => number += 1,
            Err(error) => return Err(failed(error)),
        }
    }
}

/// Moves the single-file draft `specs/<drafts|backlog>/<slug>.md` to
/// `specs/<drafts|backlog>/<slug>/proposal.md`, numbering the folder when it exists, and points
/// the priorities entry linking it to the new path. Returns the new path.
fn into_folder(place: &Place, path: &str) -> Result<String, ActionError> {
    let (parent, file) = path.rsplit_once('/').unwrap_or(("specs", path));
    let slug = file.strip_suffix(".md").unwrap_or(file);
    let mut folder = format!("{parent}/{slug}");
    let mut number = 2;
    while place.root.join(&folder).exists() {
        folder = format!("{parent}/{slug}-{number}");
        number += 1;
    }
    let moved = format!("{folder}/proposal.md");
    fs::create_dir_all(place.root.join(&folder))?;
    fs::rename(place.root.join(path), place.root.join(&moved))?;

    let priorities_path = place.root.join(PRIORITIES);
    let Ok(text) = fs::read_to_string(&priorities_path) else {
        return Ok(moved);
    };
    let new_name = format!("{}/proposal.md", folder.rsplit('/').next().unwrap_or(slug));
    let mut edited = text.clone();
    for entry in priorities::parse(&text) {
        let Some(link) = entry.link.as_deref() else {
            continue;
        };
        if resolve("specs", link).as_deref() != Some(path) {
            continue;
        }
        let (target, anchor) = match link.split_once('#') {
            Some((target, anchor)) => (target, format!("#{anchor}")),
            None => (link, String::new()),
        };
        let Some(prefix) = target.strip_suffix(file) else {
            continue;
        };
        let to = format!("{prefix}{new_name}{anchor}");
        if let Some(text) = priorities::retarget(&edited, entry.line, link, &to) {
            edited = text;
        }
    }
    if edited != text {
        fs::write(&priorities_path, edited)?;
    }
    Ok(moved)
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
        assert_eq!(escape("a[b]\\c"), "a\\[b\\]\\\\c");
    }
}
