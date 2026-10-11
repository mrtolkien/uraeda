//! Review files: `spec-review.md`, `plan-review.md`, and `assessment-review.md`.

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

/// Where a comment points: lines of the reviewed file under a heading, or the whole file.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Anchor {
    Lines(usize, usize, String),
    General,
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
        "line {line}: \"{heading}\" is not \"Lines N–M, under \\\"<heading>\\\"\", \"Line N, under \\\"<heading>\\\"\", or \"General\""
    )]
    BadAnchor { line: usize, heading: String },
}

fn anchor(text: &str) -> Option<Anchor> {
    if text == "General" {
        return Some(Anchor::General);
    }
    let (lines, heading) = text.split_once(", under \"")?;
    let heading = heading.strip_suffix('"')?.to_string();
    let range = lines
        .strip_prefix("Lines ")
        .or_else(|| lines.strip_prefix("Line "))?;
    let (start, end) = match range.split_once(['–', '-']) {
        Some((start, end)) => (start.trim().parse().ok()?, end.trim().parse().ok()?),
        None => {
            let line = range.trim().parse().ok()?;
            (line, line)
        }
    };
    (start <= end && start > 0).then_some(Anchor::Lines(start, end, heading))
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
