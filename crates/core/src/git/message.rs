//! The commit message the Git page offers when none is typed, from what is staged: a single line
//! added to a file, blank lines aside, is `chore: add <the line>`, a new file `chore: add <its name>`, a deleted one
//! `chore: remove <its name>`, any other change to one file `chore: update <its name>`, and
//! several files `chore: update <count> files`.

use gix::index::entry::Stage;

use super::diff::is_binary;
use super::{Git, GitError, read_error};

/// The most characters of a line the message quotes, so its subject stays short.
const LINE_CAP: usize = 60;

impl Git {
    /// The message offered for a commit of `staged`, the paths staged here; `None` when nothing is.
    pub fn default_message(&self, staged: &[String]) -> Result<Option<String>, GitError> {
        let path = match staged {
            [] => return Ok(None),
            [path] => path,
            many => return Ok(Some(format!("chore: update {} files", many.len()))),
        };
        let before = self.at_head(path)?;
        let after = self.staged_blob(path)?;
        Ok(Some(message_of(path, before.as_deref(), after.as_deref())))
    }

    /// The file at `path` as staged, `None` when the index has no entry for it.
    fn staged_blob(&self, path: &str) -> Result<Option<Vec<u8>>, GitError> {
        let index = self
            .repo
            .index_or_empty()
            .map_err(read_error("the index"))?;
        let Some(entry) = index.entries().iter().find(|entry| {
            entry.stage() == Stage::Unconflicted && entry.path(&index) == path.as_bytes()
        }) else {
            return Ok(None);
        };
        let blob = self.repo.find_blob(entry.id).map_err(read_error(path))?;
        Ok(Some(blob.data.clone()))
    }
}

/// The message of a commit of the one file at `path`, from `before` at `HEAD` to `after` staged.
fn message_of(path: &str, before: Option<&[u8]>, after: Option<&[u8]>) -> String {
    let name = path.rsplit('/').next().unwrap_or(path);
    let (before, after) = match (before, after) {
        (None, _) => return format!("chore: add {name}"),
        (_, None) => return format!("chore: remove {name}"),
        (Some(before), Some(after)) => (before, after),
    };
    match added_line(before, after) {
        Some(line) => format!("chore: add {line}"),
        None => format!("chore: update {name}"),
    }
}

/// The line `after` adds to `before`, its markdown markers left out and cut short, when that is
/// all it changes besides blank lines, and the line has text.
fn added_line(before: &[u8], after: &[u8]) -> Option<String> {
    if is_binary(before) || is_binary(after) {
        return None;
    }
    let (old, new) = (with_text(before), with_text(after));
    if new.len() != old.len() + 1 {
        return None;
    }
    // One line inserted: the first line that differs is it, and the lines after it are the same.
    let at = old.iter().zip(&new).take_while(|(a, b)| a == b).count();
    if new[at + 1..] != old[at..] {
        return None;
    }
    let text = without_markers(new[at].trim());
    (!text.is_empty()).then(|| cut(text))
}

/// The lines of `bytes` with text, without their trailing spaces.
fn with_text(bytes: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(bytes)
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.is_empty())
        .map(String::from)
        .collect()
}

/// `line` without the markers markdown starts it with: a heading's, a quote's, a list item's, and
/// a task's box.
fn without_markers(mut line: &str) -> &str {
    loop {
        let rest = line
            .strip_prefix(['#', '>', '-', '*', '+'])
            .or_else(|| {
                ["[ ]", "[x]", "[X]"]
                    .iter()
                    .find_map(|box_| line.strip_prefix(box_))
            })
            .or_else(|| {
                let digits =
                    line.len() - line.trim_start_matches(|c: char| c.is_ascii_digit()).len();
                (digits > 0)
                    .then(|| line[digits..].strip_prefix(['.', ')']))
                    .flatten()
            });
        match rest {
            // A marker is one when a space, or the line's end, follows it: `-1` and `#tag` are text.
            Some(rest) if rest.is_empty() || rest.starts_with([' ', '\t', '#', '>']) => {
                line = rest.trim_start();
            }
            _ => return line,
        }
    }
}

/// `text` cut at a word's end before [`LINE_CAP`] characters, an ellipsis after it.
fn cut(text: &str) -> String {
    if text.chars().count() <= LINE_CAP {
        return text.to_string();
    }
    let end = text
        .char_indices()
        .nth(LINE_CAP)
        .map_or(text.len(), |(at, _)| at);
    let kept = &text[..end];
    let kept = kept.rfind(' ').map_or(kept, |space| &kept[..space]);
    format!("{}…", kept.trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_line_added_is_quoted_without_its_markers() {
        let before = b"# Priorities\n\n## Now\n\n- Global undo\n";
        let after = b"# Priorities\n\n## Now\n\n- Review the UI\n- Global undo\n";
        assert_eq!(
            message_of("specs/PRIORITIES.md", Some(before), Some(after)),
            "chore: add Review the UI"
        );
        let after = b"# Priorities\n\n## Now\n\n- Global undo\n- [ ] Keyboard nav\n";
        assert_eq!(
            message_of("specs/PRIORITIES.md", Some(before), Some(after)),
            "chore: add Keyboard nav"
        );
    }

    #[test]
    fn any_other_change_updates_the_file() {
        let before = b"- Global undo\n";
        assert_eq!(
            message_of(
                "specs/PRIORITIES.md",
                Some(before),
                Some(b"- Global redo\n")
            ),
            "chore: update PRIORITIES.md"
        );
        assert_eq!(
            message_of(
                "specs/PRIORITIES.md",
                Some(before),
                Some(b"- Global undo\n\n")
            ),
            "chore: update PRIORITIES.md"
        );
        assert_eq!(
            message_of(
                "PRIORITIES.md",
                Some(before),
                Some(b"- Global undo\n\n- Redo\n")
            ),
            "chore: add Redo"
        );
        assert_eq!(
            message_of("a/notes.md", None, Some(b"x\n")),
            "chore: add notes.md"
        );
        assert_eq!(
            message_of("a/notes.md", Some(b"x\n"), None),
            "chore: remove notes.md"
        );
    }

    #[test]
    fn markers_go_but_text_stays() {
        assert_eq!(without_markers("## 1. Ship it"), "Ship it");
        assert_eq!(without_markers("> - [x] Done"), "Done");
        assert_eq!(without_markers("-1 degrees"), "-1 degrees");
        assert_eq!(without_markers("#tag"), "#tag");
    }

    #[test]
    fn a_long_line_is_cut_at_a_word() {
        let line = "word ".repeat(20);
        let cut = cut(line.trim());
        assert!(cut.ends_with("word…"), "{cut}");
        assert!(cut.chars().count() <= LINE_CAP + 1);
    }
}
