//! The app's two modules a page is built with, `uraeda/ui` and `uraeda/page`: `app/ui/` and
//! `app/extensions/` of the checkout the server was built from, held in its binary, and written
//! as it starts to the data folder's `extensions/modules/`, where [`pages`](super::pages) builds
//! from. So a page gets the components and the page API of the app this server ships with.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use include_dir::{Dir, include_dir};

/// `app/ui/`, the component library, as `ui/`, and `app/extensions/`, the page API, as
/// `extensions/`: the layout of `app/`, which the modules' relative imports follow.
static MODULES: [(&str, Dir<'static>); 2] = [
    ("ui", include_dir!("$CARGO_MANIFEST_DIR/../../app/ui")),
    (
        "extensions",
        include_dir!("$CARGO_MANIFEST_DIR/../../app/extensions"),
    ),
];

/// Writes the modules to `folder`, anew: each file the binary holds, and no other left there, as
/// one an older server wrote. The app's tests and their pages stay out: no page builds them.
///
/// # Errors
///
/// When a file cannot be written: a page that imports the modules then fails its build, and says
/// so.
pub(super) fn write(folder: &Path) -> io::Result<()> {
    let mut held = Vec::new();
    for (name, dir) in &MODULES {
        let mut dirs = vec![dir];
        while let Some(dir) = dirs.pop() {
            for file in dir.files().filter(|file| is_module(file.path())) {
                let path = folder.join(name).join(file.path());
                write_new(&path, file.contents())?;
                held.push(path);
            }
            dirs.extend(dir.dirs().filter(|dir| is_module(dir.path())));
        }
    }
    remove_others(folder, &held);
    Ok(())
}

/// Whether a file or a folder of the modules is code a page may be built with: not a test, and
/// not a test's page.
fn is_module(path: &Path) -> bool {
    let name = path.file_name().map(|name| name.to_string_lossy());
    !name.is_some_and(|name| name == "__checks__" || name.contains(".test."))
}

/// Writes a file unless it holds these bytes already.
fn write_new(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if fs::read(path).is_ok_and(|old| old == bytes) {
        return Ok(());
    }
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder)?;
    }
    fs::write(path, bytes)
}

/// Removes the files under a folder that are not among `held`, and the folders left empty.
fn remove_others(folder: &Path, held: &[PathBuf]) {
    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            remove_others(&path, held);
            let _ = fs::remove_dir(&path);
        } else if !held.contains(&path) {
            let _ = fs::remove_file(&path);
        }
    }
}
