//! Review files: `spec-review.md` and `plan-review.md`.

use super::frontmatter::{self, FrontmatterError};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Pending,
    Approved,
    ChangesRequested,
}

impl Verdict {
    pub fn as_str(&self) -> &'static str {
        match self {
            Verdict::Pending => "pending",
            Verdict::Approved => "approved",
            Verdict::ChangesRequested => "changes-requested",
        }
    }

    fn from_str(value: &str) -> Option<Verdict> {
        [
            Verdict::Pending,
            Verdict::Approved,
            Verdict::ChangesRequested,
        ]
        .into_iter()
        .find(|verdict| verdict.as_str() == value)
    }
}

/// Where a comment points: lines of the reviewed file under a heading, lines of a decision's
/// file, or the whole file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Anchor {
    Lines(usize, usize, String),
    /// Lines of `specs/decisions/<name>.md` at the review's commit, or at the merge base with the
    /// default branch when the branch `removed` them.
    Decision {
        name: String,
        start: usize,
        end: usize,
        heading: String,
        removed: bool,
    },
    General,
}

/// `lines 19–20`, or `line 19`.
fn lines(start: usize, end: usize) -> String {
    if start == end {
        format!("line {start}")
    } else {
        format!("lines {start}–{end}")
    }
}

impl std::fmt::Display for Anchor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Anchor::General => write!(f, "General"),
            Anchor::Lines(start, end, heading) if start == end => {
                write!(f, "Line {start}, under \"{heading}\"")
            }
            Anchor::Lines(start, end, heading) => {
                write!(f, "Lines {start}–{end}, under \"{heading}\"")
            }
            Anchor::Decision {
                name,
                start,
                end,
                heading,
                removed,
            } => {
                let removed = if *removed { " removed" } else { "" };
                let lines = lines(*start, *end);
                write!(f, "Decision {name}, {lines}{removed}, under \"{heading}\"")
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Comment {
    pub number: u32,
    pub anchor: Anchor,
    /// The lines quoted, without their `> `.
    pub quote: Vec<String>,
    pub text: String,
    /// The line of the comment's heading.
    pub line: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Review {
    pub verdict: Verdict,
    pub commit: String,
    pub summary: Option<String>,
    pub comments: Vec<Comment>,
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
pub enum ReviewError {
    #[error("{0}")]
    Frontmatter(#[from] FrontmatterError),
    #[error("no verdict field")]
    NoVerdict,
    #[error("verdict \"{0}\" is not one of pending, approved, changes-requested")]
    UnknownVerdict(String),
    #[error("no commit field")]
    NoCommit,
    #[error(
        "line {line}: \"{heading}\" is not \"Lines N–M, under \\\"<heading>\\\"\", \"Line N, under \\\"<heading>\\\"\", \"Decision <name>, lines N–M, under \\\"<heading>\\\"\", or \"General\""
    )]
    BadAnchor { line: usize, heading: String },
    #[error("no comment C{0}")]
    NoComment(u32),
}

/// `C2: General`, a review's level-2 heading, as its number and anchor text.
pub(crate) fn comment_heading(text: &str) -> Option<(u32, &str)> {
    let (number, anchor) = text.strip_prefix('C')?.split_once(':')?;
    Some((number.parse().ok()?, anchor.trim()))
}

fn anchor(text: &str) -> Option<Anchor> {
    if text == "General" {
        return Some(Anchor::General);
    }
    if let Some(rest) = text.strip_prefix("Decision ") {
        return decision_anchor(rest);
    }
    let (lines, heading) = text.split_once(", under \"")?;
    let heading = heading.strip_suffix('"')?.to_string();
    let (start, end) = range(lines, ["Lines ", "Line "])?;
    Some(Anchor::Lines(start, end, heading))
}

/// `task-storage, lines 19–20 removed, under "Rules"`, after `Decision `.
fn decision_anchor(text: &str) -> Option<Anchor> {
    let (name, rest) = text.split_once(", ")?;
    let (lines, heading) = rest.split_once(", under \"")?;
    let heading = heading.strip_suffix('"')?.to_string();
    let (lines, removed) = match lines.strip_suffix(" removed") {
        Some(lines) => (lines, true),
        None => (lines, false),
    };
    let (start, end) = range(lines, ["lines ", "line "])?;
    (!name.is_empty() && !name.contains(char::is_whitespace)).then(|| Anchor::Decision {
        name: name.to_string(),
        start,
        end,
        heading,
        removed,
    })
}

/// `Lines 50–52` or `Line 50`, with either prefix of `prefixes`, as the first and last line.
fn range(text: &str, prefixes: [&str; 2]) -> Option<(usize, usize)> {
    let range = text
        .strip_prefix(prefixes[0])
        .or_else(|| text.strip_prefix(prefixes[1]))?;
    let (start, end) = match range.split_once(['–', '-']) {
        Some((start, end)) => (start.trim().parse().ok()?, end.trim().parse().ok()?),
        None => {
            let line = range.trim().parse().ok()?;
            (line, line)
        }
    };
    (start <= end && start > 0).then_some((start, end))
}

/// Parses a review file.
pub fn parse(text: &str) -> Result<Review, ReviewError> {
    let front = frontmatter::parse(text)?;
    let verdict = front.text("verdict").ok_or(ReviewError::NoVerdict)?;
    let verdict =
        Verdict::from_str(verdict).ok_or_else(|| ReviewError::UnknownVerdict(verdict.into()))?;
    let commit = front
        .raw("commit")
        .filter(|commit| !commit.is_empty())
        .ok_or(ReviewError::NoCommit)?
        .to_string();
    let mut summary = String::new();
    let mut comments: Vec<Comment> = Vec::new();
    let mut body = String::new();
    let body_start = front.end_line;
    for (number, line) in text.lines().enumerate().skip(body_start) {
        let number = number + 1;
        if line.starts_with("# ") {
            continue;
        }
        if let Some(rest) = line.strip_prefix("## C") {
            if let Some(comment) = comments.last_mut() {
                comment.text = body.trim().to_string();
            }
            body.clear();
            let (id, heading) = rest.split_once(':').unwrap_or((rest, ""));
            let heading = heading.trim();
            let (Ok(id), Some(anchor)) = (id.parse(), anchor(heading)) else {
                return Err(ReviewError::BadAnchor {
                    line: number,
                    heading: format!("C{rest}"),
                });
            };
            comments.push(Comment {
                number: id,
                anchor,
                quote: Vec::new(),
                text: String::new(),
                line: number,
            });
            continue;
        }
        match comments.last_mut() {
            None => {
                summary.push_str(line);
                summary.push('\n');
            }
            Some(comment) if body.trim().is_empty() && line.starts_with('>') => {
                let quoted = line.strip_prefix('>').unwrap_or(line);
                comment
                    .quote
                    .push(quoted.strip_prefix(' ').unwrap_or(quoted).to_string());
            }
            Some(_) => {
                body.push_str(line);
                body.push('\n');
            }
        }
    }
    if let Some(comment) = comments.last_mut() {
        comment.text = body.trim().to_string();
    }
    let summary = summary.trim();
    Ok(Review {
        verdict,
        commit,
        summary: (!summary.is_empty()).then(|| summary.to_string()),
        comments,
    })
}

/// Writes a review file.
pub fn render(review: &Review, title: &str) -> String {
    let mut text = format!(
        "---\nverdict: {}\ncommit: {}\n---\n\n# {title}\n\n",
        review.verdict.as_str(),
        review.commit
    );
    if let Some(summary) = &review.summary {
        text.push_str(summary);
        text.push_str("\n\n");
    }
    for comment in &review.comments {
        text.push_str(&format!("## C{}: {}\n\n", comment.number, comment.anchor));
        if !comment.quote.is_empty() {
            for line in &comment.quote {
                if line.is_empty() {
                    text.push_str(">\n");
                } else {
                    text.push_str(&format!("> {line}\n"));
                }
            }
            text.push('\n');
        }
        text.push_str(&comment.text);
        text.push_str("\n\n");
    }
    text.truncate(text.trim_end().len());
    text.push('\n');
    text
}

/// The title of a review file, from its `# ` line.
fn title_of(text: &str) -> String {
    text.lines()
        .find_map(|line| line.strip_prefix("# "))
        .unwrap_or_default()
        .trim()
        .to_string()
}

/// Replaces the text of comment `number`, its anchor and quote kept.
pub fn edit_comment(text: &str, number: u32, comment: &str) -> Result<String, ReviewError> {
    let mut review = parse(text)?;
    let found = review
        .comments
        .iter_mut()
        .find(|c| c.number == number)
        .ok_or(ReviewError::NoComment(number))?;
    found.text = comment.trim().to_string();
    Ok(render(&review, &title_of(text)))
}

/// Removes comment `number`, and numbers the others from C1 again. `None` when no comment is left,
/// so the review file goes.
pub fn remove_comment(text: &str, number: u32) -> Result<Option<String>, ReviewError> {
    let mut review = parse(text)?;
    let before = review.comments.len();
    review.comments.retain(|c| c.number != number);
    if review.comments.len() == before {
        return Err(ReviewError::NoComment(number));
    }
    if review.comments.is_empty() {
        return Ok(None);
    }
    for (index, comment) in review.comments.iter_mut().enumerate() {
        comment.number = index as u32 + 1;
    }
    Ok(Some(render(&review, &title_of(text))))
}
