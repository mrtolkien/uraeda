//! The images a commit of a human's workflow file holds, as the attachments decision says: those
//! of its folder's `images/` that a markdown file of the folder links, the others deleted.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use crate::files::markdown::Document;
use crate::git::Git;
use crate::workspace::resolve;

use super::ActionError;
use super::place::Place;

/// `<folder>/images`.
pub fn images_folder(folder: &str) -> String {
    format!("{folder}/images")
}

/// The files of the folder's markdown files link, by an image or a plain link, from the top level.
fn linked(root: &Path, folder: &str) -> BTreeSet<String> {
    let Ok(entries) = fs::read_dir(root.join(folder)) else {
        return BTreeSet::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(".md"))
        .filter_map(|entry| fs::read_to_string(entry.path()).ok())
        .flat_map(|text| Document::parse(&text).links)
        .filter(|link| !link.wiki)
        .filter_map(|link| resolve(folder, &link.target))
        .collect()
}

/// Whether `<folder>/images` is that folder itself, not reached through a symbolic link: files are
/// never deleted elsewhere.
fn in_place(root: &Path, images: &str) -> bool {
    let (Ok(root), Ok(found)) = (fs::canonicalize(root), fs::canonicalize(root.join(images)))
    else {
        return false;
    };
    found == root.join(images)
}

/// Deletes every file of `<folder>/images/` that no markdown file directly in `<folder>` links, by
/// an image or a plain link, and the folder once empty. Returns `["<folder>/images"]`, the
/// pathspec of the commit, when that folder exists or `HEAD` tracks files under it, else nothing:
/// git refuses a pathspec that matches no file.
pub fn linked_images(place: &Place, folder: &str) -> Result<Vec<String>, ActionError> {
    let images = images_folder(folder);
    let dir = place.root.join(&images);
    if dir.is_dir() && in_place(&place.root, &images) {
        let linked = linked(&place.root, folder);
        for entry in fs::read_dir(&dir)?.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let path = format!("{images}/{}", entry.file_name().to_string_lossy());
            if !kind.is_dir() && !linked.contains(&path) {
                fs::remove_file(entry.path())?;
            }
        }
        // Fails while the folder holds anything, as it should.
        let _ = fs::remove_dir(&dir);
    }
    let tracked = || {
        let git = Git::open(&place.root)?;
        Ok::<bool, ActionError>(match git.head() {
            Some(head) => !git.list_files(head, &images)?.is_empty(),
            None => false,
        })
    };
    if fs::symlink_metadata(&dir).is_ok() || tracked()? {
        Ok(vec![images])
    } else {
        Ok(Vec::new())
    }
}

/// Whether the files of `<folder>/images/` differ from those `HEAD` tracks there.
pub fn images_changed(place: &Place, folder: &str) -> Result<bool, ActionError> {
    let images = images_folder(folder);
    let git = Git::open(&place.root)?;
    let committed = match git.head() {
        Some(head) => git.list_files(head, &images)?,
        None => Vec::new(),
    };
    // Files directly in the folder, as on disk.
    let committed: Vec<String> = committed
        .into_iter()
        .filter(|path| !path[images.len() + 1..].contains('/'))
        .collect();
    let mut on_disk = Vec::new();
    if let Ok(entries) = fs::read_dir(place.root.join(&images)) {
        for entry in entries.flatten() {
            if entry.file_type().is_ok_and(|t| !t.is_dir()) {
                on_disk.push(format!("{images}/{}", entry.file_name().to_string_lossy()));
            }
        }
    }
    on_disk.sort();
    if on_disk != committed {
        return Ok(true);
    }
    let Some(head) = git.head() else {
        return Ok(false);
    };
    for path in &on_disk {
        let bytes = fs::read(place.root.join(path)).ok();
        if bytes != git.read_file(head, path)? {
            return Ok(true);
        }
    }
    Ok(false)
}
