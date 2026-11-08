//! Installing your extensions: a folder linked, a git repository cloned and pinned to a commit,
//! moved to a newer commit only when asked, and removed. Nothing here runs an extension's code.
//! A new extension is written off, `on = []`, before its folder appears, so a running server
//! never loads it anywhere before `ura` writes where it is on.

use std::fs;
use std::path::{Path, PathBuf};

use toml_edit::{DocumentMut, Item, Value};

use super::{BUILT_INS, Extension, MANIFEST, SOURCE, extensions_dir, load, manifest, read};
use crate::api::ApiError;
use crate::git::{Git, ObjectId, clone_pinned};
use crate::settings::{change_path, refused, set};

/// A newer commit of an installed extension, fetched, not checked out yet.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pending {
    /// The commit it is pinned to.
    pub from: String,
    /// The commit its branch or tag is at now: `from` when nothing is new.
    pub to: String,
    /// What changed from `from` to `to`, as `git diff` prints it: empty when nothing is new.
    pub diff: String,
}

/// Installs the extension at `source`, a folder, relative to `cwd`, or a git URL: a folder in
/// your extensions folder is left as it is, any other is linked there; a URL is cloned there,
/// pinned. Refuses a built-in extension's name, one installed already, and a manifest with a fatal
/// problem. A new extension is off until [`super::set_on`] says where it is on.
pub fn add(config_dir: &Path, source: &str, cwd: &Path) -> Result<Extension, ApiError> {
    let dir = extensions_dir(config_dir);
    fs::create_dir_all(&dir)
        .map_err(|error| refused(format!("cannot create {}: {error}", dir.display())))?;
    let folder = cwd.join(source);
    let name = if folder.is_dir() {
        link(config_dir, &dir, &folder)?
    } else {
        clone(config_dir, &dir, &url(source))?
    };
    installed(config_dir, &name)
}

/// Fetches the branch or tag the installed extension `name` follows, and returns the commit it
/// would move to, with the diff.
pub fn update(config_dir: &Path, name: &str) -> Result<Pending, ApiError> {
    let (git, from) = pinned(config_dir, name)?;
    let to = git.fetch_pinned(&from.1)?;
    let diff = if to == from.0 {
        String::new()
    } else {
        git.patch(from.0, to)?
    };
    Ok(Pending {
        from: from.0.to_string(),
        to: to.to_string(),
        diff,
    })
}

/// Moves the installed extension `name` to the commit `to`, which [`update`] fetched.
pub fn apply(config_dir: &Path, name: &str, to: &str) -> Result<(), ApiError> {
    let (git, (_, git_ref)) = pinned(config_dir, name)?;
    let commit = git.resolve(&format!("{to}^{{commit}}")).ok_or_else(|| {
        refused(format!(
            "{name} has no commit {to}: run ura extension update"
        ))
    })?;
    git.checkout_detached(commit)?;
    let extension = installed(config_dir, name)?;
    let url = extension
        .source
        .map(|source| source.url)
        .unwrap_or_default();
    write_source(Path::new(&extension.folder), &url, commit, &git_ref)
}

/// Removes the extension `name`: its folder, or only the link to it. Its settings stay.
pub fn remove(config_dir: &Path, name: &str) -> Result<(), ApiError> {
    if BUILT_INS.contains(&name) {
        return Err(refused(format!(
            "{name} is built in: turn it off in Settings, Extensions"
        )));
    }
    let path = extensions_dir(config_dir).join(name);
    let metadata = fs::symlink_metadata(&path)
        .ok()
        .filter(|_| is_folder_name(name))
        .ok_or_else(|| refused(format!("no extension named {name}")))?;
    let removed = if metadata.is_symlink() {
        fs::remove_file(&path)
    } else if metadata.is_dir() {
        fs::remove_dir_all(&path)
    } else {
        return Err(refused(format!("no extension named {name}")));
    };
    removed.map_err(|error| refused(format!("cannot remove {}: {error}", path.display())))
}

/// A URL `git clone` takes: a host and a path without a scheme, as `github.com/gary/deploy`, is
/// given `https://`.
fn url(source: &str) -> String {
    let host = source.split('/').next().unwrap_or_default();
    let bare = !source.contains(':') && !host.starts_with('.') && host.contains('.');
    if bare && source.contains('/') {
        format!("https://{source}")
    } else {
        source.to_owned()
    }
}

/// Links `folder` into the extensions folder `dir` under its manifest's name, or, when it is in
/// `dir` already, leaves it; returns its name.
fn link(config_dir: &Path, dir: &Path, folder: &Path) -> Result<String, ApiError> {
    let parent = folder
        .parent()
        .and_then(|parent| parent.canonicalize().ok());
    let file_name = folder.file_name().map(|name| name.to_string_lossy());
    if let (Some(parent), Some(name)) = (parent, file_name)
        && dir.canonicalize().ok() == Some(parent)
    {
        let extension = installed(config_dir, &name)?;
        fatal(&extension)?;
        return Ok(extension.name);
    }
    let folder = folder
        .canonicalize()
        .map_err(|error| refused(format!("cannot read {}: {error}", folder.display())))?;
    let name = checked(dir, &folder)?;
    turn_off(config_dir, &name)?;
    symlink(&folder, &dir.join(&name))
        .map_err(|error| refused(format!("cannot link {name}: {error}")))?;
    Ok(name)
}

/// Clones `url` into a hidden folder of `dir`, which the extensions' reads skip, checks its
/// manifest, and moves it to its name; returns its name. The hidden folders an earlier add left,
/// stopped before it cleaned up, are removed first. When the move fails, the settings `on` is
/// as it was before.
fn clone(config_dir: &Path, dir: &Path, url: &str) -> Result<String, ApiError> {
    remove_unfinished(dir);
    let temporary = dir.join(format!(".adding-{}", std::process::id()));
    let added = (|| {
        let pinned = clone_pinned(url, &temporary)?;
        let name = checked(dir, &temporary)?;
        write_source(&temporary, url, pinned.commit, &pinned.branch)?;
        let before = turn_off(config_dir, &name)?;
        if let Err(error) = fs::rename(&temporary, dir.join(&name)) {
            // The failure to tell is the move's: an undo that fails too leaves the extension off.
            let _ = undo_turn_off(config_dir, &name, before);
            return Err(refused(format!("cannot move {name} in place: {error}")));
        }
        Ok(name)
    })();
    if added.is_err() {
        let _ = fs::remove_dir_all(&temporary);
    }
    added
}

/// Removes the hidden `.adding-*` folders of `dir`, each a clone an add never moved in place.
fn remove_unfinished(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(Result::ok) {
        let unfinished = entry.file_name().to_string_lossy().starts_with(".adding-");
        if unfinished && entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

/// The name of the extension in `folder`, from its manifest, once it is checked: refused when it
/// is a built-in extension's, installed already in `dir`, or the manifest has a fatal problem.
fn checked(dir: &Path, folder: &Path) -> Result<String, ApiError> {
    let text = load(&folder.join(MANIFEST)).map_err(refused)?;
    let document = text.parse::<DocumentMut>().ok();
    let name = document
        .as_ref()
        .and_then(|document| document.get("name"))
        .and_then(Item::as_str)
        .unwrap_or_default()
        .to_owned();
    if BUILT_INS.contains(&name.as_str()) {
        return Err(refused(format!("{name} is taken by a built-in extension")));
    }
    let extension = manifest::parse(&name, &text, Some(folder));
    fatal(&extension)?;
    if fs::symlink_metadata(dir.join(&name)).is_ok() {
        return Err(refused(format!(
            "{name} is already installed: run ura extension update {name}"
        )));
    }
    Ok(name)
}

/// Refuses an extension with a fatal problem, with the first one's file, line, and message.
fn fatal(extension: &Extension) -> Result<(), ApiError> {
    match extension.problems.iter().find(|problem| problem.is_fatal) {
        Some(problem) => Err(refused(problem.text())),
        None => Ok(()),
    }
}

/// What the settings held of an extension before [`turn_off`]: its `on`, if any, and whether it
/// had a table at all.
struct Before {
    on: Option<Item>,
    had_table: bool,
}

/// Writes the extension `name` off, `on = []`, before its folder appears; returns what it was.
fn turn_off(config_dir: &Path, name: &str) -> Result<Before, ApiError> {
    let mut before = Before {
        on: None,
        had_table: false,
    };
    change_path(config_dir, &["extensions", name], |table| {
        before.had_table = !table.is_empty();
        before.on = table.get("on").cloned();
        set(table, "on", Value::Array(toml_edit::Array::new()));
        Ok(())
    })?;
    Ok(before)
}

/// Puts back what [`turn_off`] changed: the old `on`, or no table for `name` when it had none.
fn undo_turn_off(config_dir: &Path, name: &str, before: Before) -> Result<(), ApiError> {
    if !before.had_table {
        return change_path(config_dir, &["extensions"], |table| {
            table.remove(name);
            Ok(())
        })
        .map(drop);
    }
    change_path(config_dir, &["extensions", name], |table| {
        match before.on {
            Some(on) => {
                table.insert("on", on);
            }
            None => {
                table.remove("on");
            }
        }
        Ok(())
    })
    .map(drop)
}

/// The installed extension `name`, as [`read`] lists it: refused when there is none.
fn installed(config_dir: &Path, name: &str) -> Result<Extension, ApiError> {
    read(config_dir)
        .extensions
        .into_iter()
        .find(|extension| extension.name == name && !extension.is_built_in)
        .ok_or_else(|| refused(format!("no extension named {name}")))
}

/// The clone of the installed extension `name`, with the commit it is pinned to and the branch or
/// tag it follows: refused for a built-in extension, a folder without `.ura-source`, and a
/// symbolic link, whatever its folder holds: a linked clone is the owner's to move.
fn pinned(config_dir: &Path, name: &str) -> Result<(Git, (ObjectId, String)), ApiError> {
    if BUILT_INS.contains(&name) {
        return Err(refused(format!(
            "{name} is built in: it updates with Uraeda"
        )));
    }
    let extension = installed(config_dir, name)?;
    if extension.is_linked || is_link(config_dir, name) {
        return Err(refused(format!(
            "{name} is linked: update its folder yourself"
        )));
    }
    let source = extension.source.ok_or_else(|| {
        refused(format!(
            "{name}'s {SOURCE} cannot be read: remove it and add it again"
        ))
    })?;
    let git = Git::open(&PathBuf::from(&extension.folder))?;
    let commit = git
        .resolve(&format!("{}^{{commit}}", source.commit))
        .or_else(|| git.head())
        .ok_or_else(|| refused(format!("{name} has no commit checked out")))?;
    Ok((git, (commit, source.git_ref)))
}

/// Whether your extension `name` is a symbolic link in the extensions folder, linked by `ura
/// extension add` or by hand: `ura` never fetches into it, even when it holds a `.ura-source`.
pub fn is_link(config_dir: &Path, name: &str) -> bool {
    is_folder_name(name)
        && fs::symlink_metadata(extensions_dir(config_dir).join(name))
            .is_ok_and(|metadata| metadata.is_symlink())
}

/// Writes `.ura-source` in `folder`.
fn write_source(folder: &Path, url: &str, commit: ObjectId, git_ref: &str) -> Result<(), ApiError> {
    let mut document = DocumentMut::new();
    document["url"] = toml_edit::value(url);
    document["commit"] = toml_edit::value(commit.to_string());
    document["ref"] = toml_edit::value(git_ref);
    fs::write(folder.join(SOURCE), document.to_string())
        .map_err(|error| refused(format!("cannot write {SOURCE}: {error}")))
}

/// Whether `name` is a folder's own name in the extensions folder, not a path out of it.
fn is_folder_name(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('.') && !name.contains(['/', '\\'])
}

#[cfg(unix)]
fn symlink(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

#[cfg(windows)]
fn symlink(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(target, link)
}

#[cfg(test)]
mod tests {
    use super::url;

    #[test]
    fn a_host_without_a_scheme_is_cloned_over_https() {
        let rows = [
            (
                "github.com/gary/uraeda-deploy",
                "https://github.com/gary/uraeda-deploy",
            ),
            (
                "https://github.com/gary/deploy",
                "https://github.com/gary/deploy",
            ),
            (
                "git@github.com:gary/deploy.git",
                "git@github.com:gary/deploy.git",
            ),
            ("file:///tmp/deploy", "file:///tmp/deploy"),
            ("./missing/folder", "./missing/folder"),
            ("../deploy", "../deploy"),
            ("deploy", "deploy"),
        ];
        for (source, expected) in rows {
            assert_eq!(url(source), expected, "{source}");
        }
    }
}
