//! A feature or a change typed as a text: its title, its proposal, and the writes of its proposal
//! and images.

use std::fs;

use crate::actions::attach;
use crate::files::lines;
use crate::images::Encoded;

use super::plan::Plan;
use super::{Start, StartError, partial};

/// The longest title, in characters, "…" included: a longer first line is cut under it.
const TITLE_LIMIT: usize = 80;

/// A typed text, read as a proposal.
pub(super) struct Typed {
    /// The first written line, trimmed, without heading marks, and cut under 80 characters.
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
        let title = cut(first);
        let body = match (title != first, rest.is_empty()) {
            (true, true) => first.to_string(),
            (true, false) => format!("{first}\n\n{rest}"),
            (false, _) => rest.to_string(),
        };
        Some(Typed { title, body })
    }

    /// Whether the text under the title holds `line`, a line of a list in markdown: its plain
    /// words, without its marker or its indent, as a typed line's, their spaces collapsed.
    pub(super) fn holds(&self, line: &str) -> bool {
        let (words, _) = lines::plain(unlisted(line));
        words.is_empty()
            || self
                .body
                .lines()
                .any(|typed| lines::one_line(unlisted(typed)) == words)
    }

    /// The slug proposed for it: the short slug of its title's words.
    pub(super) fn proposed_slug(&self) -> String {
        crate::slug::propose(&self.title)
    }

    /// The proposal: a feature's research effort in its frontmatter, the title as its heading, the
    /// body, then a link to each image, by its file name in the folder's `images/`.
    fn proposal(&self, images: &[String], discovery: Option<&str>) -> String {
        let mut parts = vec![format!("# {}", self.title)];
        if !self.body.is_empty() {
            parts.push(self.body.clone());
        }
        for (index, image) in images.iter().enumerate() {
            parts.push(format!("![Image {}](images/{image})", index + 1));
        }
        let text = parts.join("\n\n") + "\n";
        match discovery {
            Some(level) => crate::files::proposal::set_discovery(&text, level)
                .expect("a level checked as the text was read"),
            None => text,
        }
    }
}

/// A line cut at its last whole word, with "…", to hold at most [`TITLE_LIMIT`] characters, or at
/// the limit's last character when its words are longer: whole when it fits.
fn cut(line: &str) -> String {
    if line.chars().count() <= TITLE_LIMIT {
        return line.to_string();
    }
    // The characters before "…", and whether the next one starts a word of its own.
    let kept: String = line.chars().take(TITLE_LIMIT - 1).collect();
    let whole = line[kept.len()..].starts_with(char::is_whitespace);
    let words = match kept.rfind(char::is_whitespace) {
        Some(_) if whole => kept.as_str(),
        Some(end) => &kept[..end],
        None => kept.as_str(),
    };
    format!("{}…", words.trim_end())
}

/// A line of a list trimmed, without its marker: `- [x] Item` and `1. Item` are `[x] Item` and
/// `Item`.
fn unlisted(line: &str) -> &str {
    let line = line.trim();
    let digits = line.trim_start_matches(|c: char| c.is_ascii_digit());
    let rest = if digits.len() < line.len() {
        digits.strip_prefix(['.', ')'])
    } else {
        line.strip_prefix(['-', '*', '+'])
    };
    match rest {
        Some(rest) if rest.is_empty() || rest.starts_with(char::is_whitespace) => rest.trim(),
        _ => line,
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
    /// Writes a typed start's images, `image-1`, `image-2`, and so on, in its folder's `images/`,
    /// then its proposal linking them, a feature's research effort first, on the default branch.
    pub(super) fn write_text(
        &self,
        typed: &Typed,
        plan: &Plan,
        images: &[Encoded],
        discovery: Option<&str>,
    ) -> Result<(), StartError> {
        let left = || {
            vec![
                plan.write_left.clone(),
                plan.commit_left(self.default),
                plan.branch_left(self.run.switch),
            ]
        };
        let mut names = Vec::new();
        for (index, image) in images.iter().enumerate() {
            let base = format!("image-{}", index + 1);
            let name =
                attach::save(self.root, &plan.destination, &base, image).map_err(|error| {
                    // Nothing saved yet: a plain refusal, which switches back.
                    if names.is_empty() {
                        StartError::Refused(error.to_string())
                    } else {
                        let done = [format!(
                            "the images {} in {}/images/",
                            names.join(", "),
                            plan.destination
                        )];
                        partial(&done, left(), error)
                    }
                })?;
            names.push(name);
        }
        let folder = self.root.join(&plan.destination);
        fs::create_dir_all(&folder)
            .and_then(|()| {
                fs::write(
                    folder.join("proposal.md"),
                    typed.proposal(&names, discovery),
                )
            })
            .map_err(|error| partial(&[], left(), error))
    }
}
