//! Whether Native Shell's `DiffView` can read a patch. It draws nothing for one it cannot, and says
//! nothing: `Diff` asks here first, and shows a patch that fails as its plain text, with the cause.
//! The rules are those of NSH's reader, unchanged in 0.5.0 (`nsh-base/src/diff/patch.rs`): every
//! hunk's header is `@@ -a,b +c,d @@`, and its lines are as many as the header counts.

use nsh_core::prelude::*;

/// Reading a patch as `DiffView` does.
#[module]
pub(crate) struct Patches;

#[module(flat)]
impl Patches {
    /// Why `DiffView` cannot read `patch`, in words with its line, "line 4: the hunk ends early",
    /// or an empty text when it can.
    pub(crate) fn patch_problem(patch: String) -> String {
        problem(&patch).unwrap_or_default()
    }
}

fn problem(patch: &str) -> Option<String> {
    let mut lines = patch.split('\n').collect::<Vec<_>>();
    if patch.ends_with('\n') {
        lines.pop();
    }
    let mut at = 0;
    while at < lines.len() {
        let line = lines[at].strip_suffix('\r').unwrap_or(lines[at]);
        at += 1;
        if !line.starts_with("@@ ") {
            continue;
        }
        let header = at;
        let Some((mut old, mut new)) = counts(line) else {
            return Some(format!("line {header}: the hunk's header cannot be read"));
        };
        while let Some(&next) = lines.get(at) {
            if old == 0 && new == 0 && !next.starts_with('\\') {
                break;
            }
            let (less_old, less_new) = match next.as_bytes().first() {
                Some(b'\\') => (0, 0),
                Some(b'+') => (0, 1),
                Some(b'-') => (1, 0),
                Some(b' ') | None => (1, 1),
                Some(b'\r') if next == "\r" => (1, 1),
                _ => {
                    return Some(format!(
                        "line {}: a line of a hunk starts with none of + - or a space",
                        at + 1
                    ));
                }
            };
            if less_old > old || less_new > new {
                return Some(format!(
                    "line {}: the hunk at line {header} has more lines than its header counts",
                    at + 1
                ));
            }
            (old, new) = (old - less_old, new - less_new);
            at += 1;
        }
        if old > 0 || new > 0 {
            return Some(format!("line {at}: the hunk at line {header} ends early"));
        }
    }
    None
}

/// The old and new counts of a hunk's header, `@@ -3,2 +4 @@`, a count left out being 1.
fn counts(line: &str) -> Option<(usize, usize)> {
    let body = line.strip_prefix("@@ ")?;
    let mut ranges = body[..body.find(" @@")?].split_whitespace();
    let (Some(old), Some(new), None) = (ranges.next(), ranges.next(), ranges.next()) else {
        return None;
    };
    let count = |range: &str| -> Option<usize> {
        let (start, count) = range.split_once(',').unwrap_or((range, "1"));
        start.parse::<usize>().ok()?;
        count.parse().ok()
    };
    Some((
        count(old.strip_prefix('-')?)?,
        count(new.strip_prefix('+')?)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::problem;

    #[test]
    fn a_patch_diff_view_reads_has_no_problem_and_a_broken_one_names_its_line() {
        let good = "--- a/a.md\n+++ b/a.md\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n";
        assert_eq!(problem(good), None);
        assert_eq!(problem(""), None);
        let short = "--- a/a.md\n+++ b/a.md\n@@ -1,3 +1,3 @@\n a\n-b\n+c\n";
        assert_eq!(
            problem(short).as_deref(),
            Some("line 6: the hunk at line 3 ends early")
        );
        let header = "@@ -1 +x @@\n-a\n";
        assert_eq!(
            problem(header).as_deref(),
            Some("line 1: the hunk's header cannot be read")
        );
        let stray = "@@ -1,2 +1,2 @@\n a\n*b\n";
        assert!(problem(stray).is_some_and(|why| why.starts_with("line 3:")));
    }
}
