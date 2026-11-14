//! The vault's files, following its links to folders, each folder once: a link that loops is
//! walked no further.

use std::collections::HashSet;
use std::path::Path;

/// The relative paths of the files under `root` that `keep` accepts, sorted. `keep` is asked of
/// every folder too, with a trailing `/`, before it is walked: `.obsidian/`, `.trash/`. A broken
/// link is skipped.
pub fn files(root: &Path, keep: impl Fn(&str) -> bool) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    walk(root, "", &keep, &mut seen, &mut out);
    out.sort();
    out
}

fn walk(
    dir: &Path,
    prefix: &str,
    keep: &impl Fn(&str) -> bool,
    seen: &mut HashSet<std::path::PathBuf>,
    out: &mut Vec<String>,
) {
    let Ok(real) = std::fs::canonicalize(dir) else {
        return;
    };
    if !seen.insert(real) {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        let relative = format!("{prefix}{name}");
        // Follows a link: a broken one has no metadata, and is skipped.
        let Ok(meta) = std::fs::metadata(entry.path()) else {
            continue;
        };
        if meta.is_dir() {
            let folder = format!("{relative}/");
            if keep(&folder) {
                walk(&entry.path(), &folder, keep, seen, out);
            }
        } else if keep(&relative) {
            out.push(relative);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn follows_links_once_and_skips_what_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("v");
        std::fs::create_dir_all(root.join("a/b")).unwrap();
        std::fs::create_dir_all(root.join(".trash")).unwrap();
        std::fs::write(root.join("a/b/n.md"), "").unwrap();
        std::fs::write(root.join(".trash/x.md"), "").unwrap();
        std::os::unix::fs::symlink(root.join("a"), root.join("a/b/loop")).unwrap();
        std::os::unix::fs::symlink(root.join("gone"), root.join("broken")).unwrap();
        let found = files(&root, |p| !p.starts_with('.'));
        assert_eq!(found, ["a/b/n.md"]);
    }
}
