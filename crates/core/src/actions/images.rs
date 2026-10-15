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

/// Deletes every file under `dir` that is not linked, then `dir` once empty, never following a
/// symbolic link: a link is deleted as a file.
fn prune(root: &Path, dir: &str, linked: &Linked) -> std::io::Result<()> {
    for entry in fs::read_dir(root.join(dir))?.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = format!("{dir}/{}", entry.file_name().to_string_lossy());
        if kind.is_dir() {
            prune(root, &path, linked)?;
        } else if !linked.contains(&path) {
            fs::remove_file(entry.path())?;
        }
    }
    // Fails while the folder holds anything, as it should.
    let _ = fs::remove_dir(root.join(dir));
    Ok(())
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
        prune(&place.root, &images, &Linked::read(&place.root, folder))?;
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
