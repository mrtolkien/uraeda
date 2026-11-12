//! The chat's images, in `<data folder>/images/`: written as the core encoded them, never into a
//! repository, and readable by their owner only.

use std::fs::{self, DirBuilder, OpenOptions};
use std::io::{self, Write};
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};

use uraeda_core::images::Encoded;
use uraeda_protocol::ChatImage;

use crate::secret;
use crate::shared::Shared;

/// The chat images' folder, in a data folder.
pub(crate) const FOLDER: &str = "images";

/// The images of `<data folder>/images/`, by their ids.
pub(crate) struct ChatImages {
    dir: PathBuf,
}

impl ChatImages {
    /// The chat images of the server's data folder. The folder is created by the first save.
    pub(crate) fn of(shared: &Shared) -> ChatImages {
        ChatImages {
            dir: shared.data_dir().join(FOLDER),
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

    /// An image's bytes, as the core encoded them: none when the id is none, or its file is
    /// gone.
    pub(crate) fn read(&self, id: &str) -> Option<Vec<u8>> {
        fs::read(self.path(id)?).ok()
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
pub(crate) fn is_id(id: &str) -> bool {
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

/// How long an image no message holds is kept, for a composer to send it.
const UNSENT_KEPT: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);

/// Deletes the chat images no message holds, unless written in the last day: a composer may
/// hold one, not sent yet. A file that cannot be read or deleted is left for the next start,
/// and a cleanup that fails never stops the server.
pub(crate) fn clean(shared: &Shared) {
    let held = match shared.get::<crate::runner::Store>().images_in_use() {
        Ok(held) => held,
        Err(error) => return say_err!("uraeda: the chat images were not cleaned: {error}"),
    };
    let images = ChatImages::of(shared);
    let Ok(files) = std::fs::read_dir(&images.dir) else {
        return;
    };
    let now = shared.now();
    for file in files.flatten() {
        let Ok(id) = file.file_name().into_string() else {
            continue;
        };
        if !is_id(&id) || held.contains(&id) {
            continue;
        }
        let written = file.metadata().and_then(|file| file.modified());
        let old = written.is_ok_and(|written| {
            now.duration_since(written)
                .is_ok_and(|age| age >= UNSENT_KEPT)
        });
        if old {
            let _ = images.remove(&id);
        }
    }
}
