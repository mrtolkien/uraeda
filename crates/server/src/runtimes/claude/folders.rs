//! The folders a session's `claude` is given: the skill's plugin, the chat images, the owner's
//! extensions, and a plugin folder for each extension's skills.
//!
//! The server is one binary, which holds the skill and the documentation of the extension API:
//! it writes both in its data folder, where `claude` reads them, each time it starts.

use std::fs;
use std::io;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use include_dir::Dir;
use uraeda_core::embedded::SKILL;
use uraeda_core::extensions::extensions_dir;

use crate::files::chat_images;
use crate::secret;

/// The documentation of the extension API, as it was when the server was built.
const DOCS: &str = include_str!("../../../../../docs/extensions.md");

/// The plugin the skill loads as.
const PLUGIN: &str = "uraeda";

/// Where a session's `claude` finds what it is given.
pub(super) struct Folders {
    /// The folder passed to `--plugin-dir`: `.claude-plugin/plugin.json` and `skills/uraeda/`.
    pub plugin: PathBuf,
    /// The chat images' folder, `<data folder>/images`.
    pub images: PathBuf,
    /// The owner's extensions folder, `<config folder>/extensions`, where sessions write them.
    pub extensions: PathBuf,
    /// The documentation of the extension API, which sessions are told to read.
    pub docs: PathBuf,
    /// The folder of the extensions' plugins, `<data folder>/extension-plugins`.
    plugins: PathBuf,
    /// Whether the skill and the documentation were written since the server started.
    written: OnceLock<()>,
}

impl Folders {
    /// The folders of a server, by its config and data folders. Nothing is made yet.
    pub(super) fn new(config_dir: &Path, data_dir: &Path) -> Folders {
        Folders {
            plugin: data_dir.join("plugin"),
            images: data_dir.join(chat_images::FOLDER),
            extensions: extensions_dir(config_dir),
            docs: data_dir.join("docs/extensions.md"),
            plugins: data_dir.join("extension-plugins"),
            written: OnceLock::new(),
        }
    }

    /// Makes what a process is started with: the images' and extensions' folders, as
    /// `--add-dir` refuses a missing one, the skill's plugin and the documentation, once per
    /// server, and the plugin folders of these extensions' skills, those of extensions removed
    /// taken away. A folder that cannot be made is left to `claude`, which says so.
    pub(super) fn prepare(&self, skills: &[PathBuf]) {
        let _ = fs::create_dir_all(&self.images);
        let _ = fs::create_dir_all(&self.extensions);
        self.written.get_or_init(|| {
            let _ = self.write_plugin();
            let _ = write_new(&self.docs, DOCS.as_bytes());
        });
        self.prune_plugins();
        for folder in skills {
            let _ = self.link_plugin(folder);
        }
    }

    /// Writes the skill's plugin folder anew, from the skill the server holds: a file an older
    /// server wrote, and this one's skill no longer has, is gone.
    fn write_plugin(&self) -> io::Result<()> {
        let skill = self.plugin.join("skills").join(PLUGIN);
        match fs::remove_dir_all(&skill) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
            _ => {}
        }
        write_dir(&SKILL, &skill)?;
        write_manifest(&self.plugin, PLUGIN)
    }

    /// The plugin folder of the extension whose `skills/` folder is `skills`, `ext-<name>`:
    /// apart from Uraeda's own plugin, `uraeda`, whatever the extension's name.
    pub(super) fn extension_plugin(&self, skills: &Path) -> PathBuf {
        let extension = skills.parent().and_then(Path::file_name);
        let name = extension.unwrap_or_default().to_string_lossy();
        self.plugins.join(format!("ext-{name}"))
    }

    /// Makes the plugin folder of an extension's skills: its `.claude-plugin/plugin.json`, and
    /// `skills`, a link to the extension's `skills/` folder, replaced whole when it points
    /// elsewhere or is no link.
    fn link_plugin(&self, skills: &Path) -> io::Result<()> {
        let plugin = self.extension_plugin(skills);
        let name = plugin.file_name().unwrap_or_default().to_string_lossy();
        write_manifest(&plugin, &name)?;
        let link = plugin.join("skills");
        match fs::read_link(&link) {
            Ok(target) if target == skills => return Ok(()),
            // Not a link, as a folder or file left there: a link cannot be renamed over it.
            Err(error) if error.kind() == io::ErrorKind::InvalidInput => remove(&link)?,
            _ => {}
        }
        // A new link renamed over the old one: another session never sees it missing.
        let next = plugin.join(format!("skills.{}", secret::random(9)));
        symlink(skills, &next)?;
        fs::rename(&next, &link)
    }

    /// Removes the plugin folders, `ext-<name>`, of the extensions no longer in the extensions
    /// folder. Only those: another session may run with the plugin of an extension installed
    /// but off here, or turned off since it opened.
    fn prune_plugins(&self) {
        let Ok(entries) = fs::read_dir(&self.plugins) else {
            return;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(extension) = name
                .to_string_lossy()
                .strip_prefix("ext-")
                .map(str::to_owned)
            else {
                continue;
            };
            if !self.extensions.join(extension).exists() {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
}

/// Removes a folder or a file.
fn remove(path: &Path) -> io::Result<()> {
    fs::remove_dir_all(path).or_else(|_| fs::remove_file(path))
}

/// Writes a plugin's manifest, `.claude-plugin/plugin.json`, with its name.
fn write_manifest(plugin: &Path, name: &str) -> io::Result<()> {
    let manifest = serde_json::json!({ "name": name });
    let path = plugin.join(".claude-plugin/plugin.json");
    write_new(&path, format!("{manifest}\n").as_bytes())
}

/// Writes a file unless it holds these bytes already: sessions opening together write the same.
fn write_new(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if fs::read(path).is_ok_and(|old| old == bytes) {
        return Ok(());
    }
    if let Some(folder) = path.parent() {
        fs::create_dir_all(folder)?;
    }
    fs::write(path, bytes)
}

/// Writes an embedded folder's files under `to`.
fn write_dir(dir: &Dir<'_>, to: &Path) -> io::Result<()> {
    for file in dir.files() {
        write_new(&to.join(file.path()), file.contents())?;
    }
    dir.dirs().try_for_each(|sub| write_dir(sub, to))
}
