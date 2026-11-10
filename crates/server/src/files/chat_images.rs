//! The chat's images, in `<data folder>/images/`: written as the core encoded them, never into a
//! repository, and readable by their owner only.

use std::fs::{self, DirBuilder, OpenOptions};
use std::io::{self, Write};
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};

use serde::Serialize;
use uraeda_core::images::Encoded;

use crate::secret;
use crate::shared::Shared;

/// A chat image: its file name in the images folder, and its size in pixels.
#[derive(Debug, Serialize)]
pub(crate) struct ChatImage {
    pub height: u32,
    pub id: String,
    pub width: u32,
}

/// The images of `<data folder>/images/`, by their ids.
pub(crate) struct ChatImages {
    dir: PathBuf,
}

impl ChatImages {
    /// The chat images of the server's data folder. The folder is created by the first save.
    pub(crate) fn of(shared: &Shared) -> ChatImages {
        ChatImages {
            dir: shared.data_dir().join("images"),
        }
    }

    /// Writes an image the core encoded, under a new id, readable by its owner only.
    ///
    /// # Errors
    ///
    /// The refusal, with the system's error, of a write that fails: it leaves no partial file.
    pub(crate) fn save(&self, encoded: &Encoded) -> Result<ChatImage, String> {
        let id = format!("{}.{}", uuid(), encoded.extension);
        let path = self.dir.join(&id);
        if let Err(error) = self.write(&path, &encoded.bytes) {
            let _ = fs::remove_file(&path);
            return Err(format!("refused: The image could not be saved: {error}."));
        }
        Ok(ChatImage {
            height: encoded.height,
            id,
            width: encoded.width,
        })
    }

    /// Writes a new file, never over another, in the folder it creates when missing.
    fn write(&self, path: &Path, bytes: &[u8]) -> io::Result<()> {
        DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&self.dir)?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)?;
        file.write_all(bytes)
    }

    /// The image's path, when the id is one and its file exists.
    pub(crate) fn path(&self, id: &str) -> Option<PathBuf> {
        let path = self.dir.join(id);
        (is_id(id) && path.is_file()).then_some(path)
    }

    /// Deletes an image: one already gone is no error.
    pub(crate) fn remove(&self, id: &str) -> io::Result<()> {
        if !is_id(id) {
            return Ok(());
        }
        match fs::remove_file(self.dir.join(id)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        }
    }
}

/// The MIME type of a chat image, by its id.
pub(crate) fn kind(id: &str) -> &'static str {
    match id.ends_with(".gif") {
        true => "image/gif",
        false => "image/webp",
    }
}

/// Whether a text is an image's id: a UUID in small letters and the extension the core gave it.
/// Nothing else names a file of the data folder.
fn is_id(id: &str) -> bool {
    let Some((uuid, extension)) = id.split_once('.') else {
        return false;
    };
    let groups: Vec<&str> = uuid.split('-').collect();
    let hex = |group: &&str| {
        let digit = |byte: u8| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte);
        group.bytes().all(digit)
    };
    let lengths: Vec<usize> = groups.iter().map(|group| group.len()).collect();
    lengths == [8, 4, 4, 4, 12] && groups.iter().all(hex) && matches!(extension, "webp" | "gif")
}

/// A new random UUID, version 4, in small letters.
fn uuid() -> String {
    let mut bytes = secret::random_bytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..]
    )
}
