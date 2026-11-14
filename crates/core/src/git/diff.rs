//! A file's diff, from `HEAD` to the working tree or across a commit, and the files a commit
//! changed: blobs read through gix, lines compared with gix's diff (imara-diff, git's Myers with
//! its slider heuristics), written in the unified format with 3 lines of context.

use gix::object::tree::diff::ChangeDetached;

use super::{Git, GitError, ObjectId, read_error};

impl Git {
    /// The paths of the files that differ between the commits `from` and `to`, from the top level:
    /// a renamed file's old path and new one, a copy's new path alone, its source unchanged, no
    /// folder.
    pub fn changed_paths(&self, from: ObjectId, to: ObjectId) -> Result<Vec<String>, GitError> {
        let what = to.to_hex_with_len(7).to_string();
        let changes = self
            .repo
            .diff_tree_to_tree(
                Some(&self.tree(from)?),
                Some(&self.tree(to)?),
                gix::diff::Options::default(),
            )
            .map_err(read_error(what.as_str()))?;
        let mut paths = Vec::new();
        for change in &changes {
            if change.entry_mode().is_tree() {
                continue;
            }
            if let ChangeDetached::Rewrite {
                source_location,
                copy: false,
                ..
            } = change
            {
                paths.push(source_location.to_string());
            }
            paths.push(change.location().to_string());
        }
        Ok(paths)
    }

    /// The first line of the commit `id`'s message, trimmed.
    pub fn subject(&self, id: ObjectId) -> Result<String, GitError> {
        let what = id.to_hex_with_len(7).to_string();
        let commit = self
            .repo
            .find_commit(id)
            .map_err(read_error(what.as_str()))?;
        let message = String::from_utf8_lossy(commit.message_raw_sloppy());
        Ok(message
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_string())
    }
}

// A patch is written without git, by the readers of a text alone: an editor's, in a browser too.
pub use uraeda_text::patch::text_patch;
