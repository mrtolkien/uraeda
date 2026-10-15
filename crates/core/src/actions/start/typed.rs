//! A change typed as a text: its title, its proposal, and the writes of its proposal and images.

use std::fs;
use std::path::Path;

use crate::actions::attach;
use crate::images::Encoded;

use super::plan::Plan;
use super::{Start, StartError, partial};

/// The longest title, in characters: a longer first line is cut there.
const TITLE_LIMIT: usize = 80;

/// A typed text, read as a proposal.
pub(super) struct Typed {
    /// The first written line, trimmed, without heading marks, and cut at 80 characters.
    pub(super) title: String,
    /// The text under the title: the whole first line, unmarked, when it was cut, then the rest as
    /// typed.
    body: String,
}

impl Typed {
    /// The title is the first line holding more than spaces and heading marks, without them; the
    /// text after it is kept as typed, trimmed at its ends. `None` when no line holds more.
    pub(super) fn read(text: &str) -> Option<Typed> {
        let mut offset = 0;
        let line = text.split_inclusive('\n').find(|line| {
            let written = !unmarked(line).is_empty();
            if !written {
                offset += line.len();
            }
            written
        })?;
        let first = unmarked(line);
        let rest = trim_ends(&text[offset + line.len()..]);
        let title: String = first.chars().take(TITLE_LIMIT).collect();
        let title = title.trim_end().to_string();
        let body = match (title.len() < first.len(), rest.is_empty()) {
            (true, true) => first.to_string(),
            (true, false) => format!("{first}\n\n{rest}"),
            (false, _) => rest.to_string(),
        };
        Some(Typed { title, body })
    }

    /// The slug proposed for it: the short slug of its title's words.
    pub(super) fn proposed_slug(&self) -> String {
        crate::slug::propose(&self.title)
    }

    /// The proposal: the title as its heading, the body, then a link to each image, by its file
    /// name in the change's `images/` folder.
    fn proposal(&self, images: &[String]) -> String {
        let mut parts = vec![format!("# {}", self.title)];
        if !self.body.is_empty() {
            parts.push(self.body.clone());
        }
        for (index, image) in images.iter().enumerate() {
            parts.push(format!("![Image {}](images/{image})", index + 1));
        }
        parts.join("\n\n") + "\n"
    }
}

/// A line trimmed, without the marks of a heading typed as one: `## Title` is `Title`.
fn unmarked(line: &str) -> &str {
    let line = line.trim();
    let rest = line.trim_start_matches('#');
    if rest.is_empty() || rest.starts_with(char::is_whitespace) {
        rest.trim_start()
    } else {
        line
    }
}

/// A text without its leading blank lines and its trailing spaces and line breaks: the first
/// written line keeps its indent.
fn trim_ends(text: &str) -> &str {
    let mut start = 0;
    for line in text.split_inclusive('\n') {
        if !line.trim().is_empty() {
            break;
        }
        start += line.len();
    }
    text[start..].trim_end()
}

impl Start<'_> {
    /// Writes a typed change's images, `image-1`, `image-2`, and so on, in its folder's `images/`,
    /// then its proposal linking them, in `target_root`.
    pub(super) fn write_text(
        &self,
        typed: &Typed,
        plan: &Plan,
        images: &[Encoded],
        target_root: &Path,
        done: &[String],
    ) -> Result<(), StartError> {
        let left = || vec![plan.write_left.clone(), plan.commit_left()];
        let mut names = Vec::new();
        for (index, image) in images.iter().enumerate() {
            let base = format!("image-{}", index + 1);
            let name = attach::save(target_root, &plan.destination, &base, image)
                .map_err(|error| partial(done, left(), error))?;
            names.push(name);
        }
        let folder = target_root.join(&plan.destination);
        fs::create_dir_all(&folder)
            .and_then(|()| fs::write(folder.join("proposal.md"), typed.proposal(&names)))
            .map_err(|error| partial(done, left(), error))
    }
}
