//! `reviews.*`: a review file parses, a request for changes has a comment, and its comments are
//! numbered in order and quote the lines they are on.

use crate::files::review;
use crate::workspace::Problem;

use super::File;

/// Checks a review file's format, its verdict's comments, and each comment's number and quote.
pub(super) fn check_review(file: &File<'_>, problems: &mut Vec<Problem>) {
    let review = match review::parse(file.text) {
        Ok(review) => review,
        Err(review::ReviewError::Frontmatter(_)) => return,
        Err(error) => {
            let line = match &error {
                review::ReviewError::BadAnchor { line, .. } => Some(*line),
                _ => None,
            };
            problems.push(file.problem(line, "reviews.format", error.to_string()));
            return;
        }
    };
    if review.verdict == review::Verdict::ChangesRequested && review.comments.is_empty() {
        problems.push(file.problem(
            None,
            "reviews.comment",
            "a request for changes needs at least one comment",
        ));
    }
    for (index, comment) in review.comments.iter().enumerate() {
        if comment.number as usize != index + 1 {
            problems.push(file.problem(
                Some(comment.line),
                "reviews.numbering",
                format!("C{} should be C{}", comment.number, index + 1),
            ));
        }
        let on_lines = matches!(
            comment.anchor,
            review::Anchor::Lines(..) | review::Anchor::Decision { .. }
        );
        if on_lines && comment.quote.is_empty() {
            problems.push(file.problem(
                Some(comment.line),
                "reviews.quote",
                format!("C{} quotes no line", comment.number),
            ));
        }
    }
}
