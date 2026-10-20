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

/// Every markdown file of `dir` and of its subfolders, never through a symbolic link.
fn markdown_files(root: &Path, dir: &str, files: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(root.join(dir)) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = format!("{dir}/{name}");
        if kind.is_dir() {
            markdown_files(root, &path, files);
        } else if kind.is_file() && name.ends_with(".md") {
            files.push(path);
        }
    }
}

/// What the markdown files of a folder link: the paths of their links and images, and the
/// targets of their wikilinks and Obsidian embeds, which Obsidian matches by the end of a path.
#[derive(Default)]
struct Linked {
    paths: BTreeSet<String>,
    wiki: Vec<String>,
}

impl Linked {
    fn read(root: &Path, folder: &str) -> Linked {
        let mut files = Vec::new();
        markdown_files(root, folder, &mut files);
        let mut linked = Linked::default();
        for file in files {
            let Ok(text) = fs::read_to_string(root.join(&file)) else {
                continue;
            };
            let dir = file.rsplit_once('/').map_or("", |(dir, _)| dir);
            let document = Document::parse(&text);
            for link in document.links {
                if link.wiki {
                    linked.wiki.push(link.target);
                } else {
                    linked.paths.extend(resolve(dir, &link.target));
                }
            }
            linked.wiki.extend(document.embeds);
        }
        linked.wiki = linked
            .wiki
            .iter()
            .filter_map(|target| target.split(['#', '|']).next())
            .map(|target| target.trim().trim_start_matches('/').to_string())
            .filter(|target| !target.is_empty())
            .collect();
        linked
    }

    /// Whether a file, from the top level, is linked: `![[shot.webp]]` links every
    /// `…/shot.webp`, and `![[images/shot.webp]]` every `…/images/shot.webp`.
    fn contains(&self, path: &str) -> bool {
        self.paths.contains(path)
            || self
                .wiki
                .iter()
                .any(|target| path == target || path.ends_with(&format!("/{target}")))
    }
}

/// Every file under `dir` that is not linked, from the top level, never following a symbolic
/// link: a link is a file.
fn unlinked(
    root: &Path,
    dir: &str,
    linked: &Linked,
    found: &mut Vec<String>,
) -> std::io::Result<()> {
    for entry in fs::read_dir(root.join(dir))?.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = format!("{dir}/{}", entry.file_name().to_string_lossy());
        if kind.is_dir() {
            unlinked(root, &path, linked, found)?;
        } else if !linked.contains(&path) {
            found.push(path);
        }
    }
    Ok(())
}

/// Deletes the files of `paths`, then every folder left empty under `dir`, `dir` included.
fn remove(root: &Path, dir: &str, paths: &[String]) -> std::io::Result<()> {
    for path in paths {
        fs::remove_file(root.join(path))?;
    }
    empty_folders(root, dir);
    Ok(())
}

/// Removes `dir` and its subfolders once empty: a folder that holds anything stays.
fn empty_folders(root: &Path, dir: &str) {
    if let Ok(entries) = fs::read_dir(root.join(dir)) {
        for entry in entries.flatten() {
            if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                empty_folders(
                    root,
                    &format!("{dir}/{}", entry.file_name().to_string_lossy()),
                );
            }
        }
    }
    // Fails while the folder holds anything, as it should.
    let _ = fs::remove_dir(root.join(dir));
}

/// Every image under `<folder>/images/` that no markdown file of `<folder>` or of its subfolders
/// links, by an image, a link, a wikilink, or an embed: those a commit of the folder deletes. In
/// order, from the top level. Nothing when `<folder>/images` is no folder of its own, as when it
/// is reached through a symbolic link.
pub fn unlinked_images(root: &Path, folder: &str) -> Vec<String> {
    let images = images_folder(folder);
    let mut found = Vec::new();
    if root.join(&images).is_dir() && in_place(root, &images) {
        let _ = unlinked(root, &images, &Linked::read(root, folder), &mut found);
    }
    found.sort();
    found
}

/// The unlinked images of every folder draft and folder of the backlog: `specs/drafts/<slug>/` and
/// `specs/backlog/<slug>/`.
pub fn unlinked_in_drafts(root: &Path) -> Vec<String> {
    let mut found = Vec::new();
    for parent in ["specs/backlog", "specs/drafts"] {
        let Ok(entries) = fs::read_dir(root.join(parent)) else {
            continue;
        };
        let mut folders: Vec<String> = entries
            .flatten()
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .map(|entry| format!("{parent}/{}", entry.file_name().to_string_lossy()))
            .collect();
        folders.sort();
        for folder in folders {
            found.extend(unlinked_images(root, &folder));
        }
    }
    found
}

/// Deletes the images [`unlinked_in_drafts`] finds, and the `images/` folders they leave empty.
/// Returns them.
pub fn delete_unlinked_in_drafts(root: &Path) -> Result<Vec<String>, ActionError> {
    let found = unlinked_in_drafts(root);
    for path in &found {
        let folder = path.split("/images/").next().unwrap_or_default();
        remove(root, &images_folder(folder), std::slice::from_ref(path))?;
    }
    Ok(found)
}

/// Whether `<folder>/images` is that folder itself, not reached through a symbolic link: files are
/// never deleted elsewhere.
pub(crate) fn in_place(root: &Path, images: &str) -> bool {
    let (Ok(root), Ok(found)) = (fs::canonicalize(root), fs::canonicalize(root.join(images)))
    else {
        return false;
    };
    found == root.join(images)
}

/// Deletes every file under `<folder>/images/` that no markdown file of `<folder>` or of its
/// subfolders links, by an image, a link, a wikilink, or an embed, and the folders left empty.
/// Returns `["<folder>/images"]`, the pathspec of the commit, when that folder exists, or the
/// index or `HEAD` holds files under it, else nothing: git refuses a pathspec that matches no
/// file, and a file a refused commit staged must be unstaged with the others.
pub fn linked_images(place: &Place, folder: &str) -> Result<Vec<String>, ActionError> {
    let images = images_folder(folder);
    let dir = place.root.join(&images);
    if dir.is_dir() && in_place(&place.root, &images) {
        let found = unlinked_images(&place.root, folder);
        remove(&place.root, &images, &found)?;
    }
    let git = Git::open(&place.root)?;
    let tracked = match git.head() {
        Some(head) => !git.list_files(head, &images)?.is_empty(),
        None => false,
    };
    if fs::symlink_metadata(&dir).is_ok() || tracked || git.in_index(&images)? {
        Ok(vec![images])
    } else {
        Ok(Vec::new())
    }
}

/// Whether the files under `<folder>/images/` differ from those `HEAD` tracks there, as the
/// commit would stage them: ignored files left out, and symbolic links compared as links.
pub fn images_changed(place: &Place, folder: &str) -> Result<bool, ActionError> {
    Ok(Git::open(&place.root)?.differs_from_head(&images_folder(folder))?)
}
