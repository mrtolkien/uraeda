//! The folders a session's `claude` is given: the skill's plugin, the chat images, the owner's
//! extensions, and a plugin folder for each extension's skills.
//!
//! The skill and the documentation of the extension API are the folders every built-in agent
//! is given, `built_in::Given`: this adds what makes the skill's folder a plugin of Claude
//! Code's, and the extensions' plugins.

use std::fs;
use std::io;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use super::super::built_in::{Given, SKILL_NAME, write_new};
use crate::files::chat_images;
use crate::secret;

/// Where a session's `claude` finds what it is given.
pub(super) struct Folders {
    /// The skill, the owner's extensions folder, and the documentation of the extension API.
    /// The skill's folder is passed to `--plugin-dir`: `.claude-plugin/plugin.json` and
    /// `skills/uraeda/`.
    pub given: Arc<Given>,
    /// The chat images' folder, `<data folder>/images`.
    pub images: PathBuf,
    /// The folder of the extensions' plugins, `<data folder>/extension-plugins`.
    plugins: PathBuf,
    /// Whether the plugin's manifest was written since the server started.
    manifest: OnceLock<()>,
}

impl Folders {
    /// The folders of a server, by what every agent is given and its data folder. Nothing is
    /// made yet.
    pub(super) fn new(given: Arc<Given>, data_dir: &Path) -> Folders {
        Folders {
            given,
            images: data_dir.join(chat_images::FOLDER),
            plugins: data_dir.join("extension-plugins"),
            manifest: OnceLock::new(),
        }
    }

    /// Makes what a process is started with: the images' and extensions' folders, as
    /// `--add-dir` refuses a missing one, the skill's plugin and the documentation, once per
    /// server, and the plugin folders of these extensions' skills, those of extensions removed
    /// taken away. A folder that cannot be made is left to `claude`, which says so.
    pub(super) fn prepare(&self, skills: &[PathBuf]) {
        let _ = fs::create_dir_all(&self.images);
        self.given.prepare();
        self.manifest.get_or_init(|| {
            let _ = write_manifest(&self.given.plugin, SKILL_NAME);
        });
        self.prune_plugins();
        for folder in skills {
            let _ = self.link_plugin(folder);
        }
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
            if !self.given.extensions.join(extension).exists() {
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
