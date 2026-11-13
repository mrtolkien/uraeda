//! The patch between two texts, in the unified format with 3 lines of context, as git writes a
//! file's diff: lines compared with git's Myers and its slider heuristics (gitoxide's copy of
//! imara-diff, the library gix compares blobs with). The core's file diffs and an editor's patch
//! between the text typed and the file on disk are both written here.

use std::fmt::Write as _;
use std::ops::Range;

use gix_imara_diff::{Algorithm, Diff, InternedInput, Token};

/// The lines of context around a change.
const CONTEXT: u32 = 3;

/// The unified diff of two versions of the text at `path`, as a file's diff is written: what an
/// editor shows between the text typed and the file as it is now on disk.
pub fn text_patch(path: &str, before: &str, after: &str) -> String {
    unified(path, Some(before.as_bytes()), Some(after.as_bytes()))
}

/// The unified diff of two texts, `None` a side without the file.
pub fn unified(path: &str, before: Option<&[u8]>, after: Option<&[u8]>) -> String {
    let side = |prefix: &str, side: Option<&[u8]>| match side {
        Some(_) => format!("{prefix}/{path}"),
        None => "/dev/null".to_string(),
    };
    let mut text = format!("--- {}\n+++ {}\n", side("a", before), side("b", after));
    let input = InternedInput::new(before.unwrap_or_default(), after.unwrap_or_default());
    let mut diff = Diff::compute(Algorithm::Myers, &input);
    diff.postprocess_lines(&input);
    let mut hunk: Option<Hunk> = None;
    for change in diff.hunks() {
        // A change more than twice the context after the last starts a hunk of its own.
        let apart = |open: &Hunk| change.before.start - open.next > 2 * CONTEXT;
        if let Some(open) = hunk.take_if(|open| apart(open)) {
            open.write(&input, &mut text);
        }
        let open = hunk.get_or_insert_with(|| Hunk::at(&change.before, &change.after));
        open.context(&input, open.next..change.before.start);
        open.lines(&input, &input.before, change.before.clone(), '-');
        open.lines(&input, &input.after, change.after, '+');
        open.next = change.before.end;
    }
    if let Some(open) = hunk {
        open.write(&input, &mut text);
    }
    text
}

/// A hunk being gathered: where it starts on each side, its lines so far, and the next line of
/// the text before to write as context.
struct Hunk {
    before: Range<u32>,
    after: Range<u32>,
    next: u32,
    body: String,
}

impl Hunk {
    /// A hunk for a first change, its context before included.
    fn at(before: &Range<u32>, after: &Range<u32>) -> Self {
        let start = before.start.saturating_sub(CONTEXT);
        let after_start = after.start.saturating_sub(CONTEXT);
        Hunk {
            before: start..start,
            after: after_start..after_start,
            next: start,
            body: String::new(),
        }
    }

    /// Adds lines of the text before as context: they are on both sides.
    fn context(&mut self, input: &InternedInput<&[u8]>, lines: Range<u32>) {
        self.before.end += lines.end - lines.start;
        self.after.end += lines.end - lines.start;
        self.lines(input, &input.before, lines, ' ');
    }

    /// Adds lines of one side with their prefix, a last line without a newline marked as git
    /// marks it.
    fn lines(
        &mut self,
        input: &InternedInput<&[u8]>,
        tokens: &[Token],
        lines: Range<u32>,
        prefix: char,
    ) {
        match prefix {
            '-' => self.before.end += lines.end - lines.start,
            '+' => self.after.end += lines.end - lines.start,
            _ => {}
        }
        for token in &tokens[lines.start as usize..lines.end as usize] {
            let line = input.interner[*token];
            self.body.push(prefix);
            self.body.push_str(&String::from_utf8_lossy(line));
            if !line.ends_with(b"\n") {
                self.body.push_str("\n\\ No newline at end of file\n");
            }
        }
    }

    /// Writes the hunk as git does: the context after its last change, its header, an empty side
    /// starting at the line before, so a whole file added reads `@@ -0,0 +1,2 @@`, then its lines.
    fn write(mut self, input: &InternedInput<&[u8]>, text: &mut String) {
        let last = u32::try_from(input.before.len()).unwrap_or(u32::MAX);
        self.context(input, self.next..(self.next + CONTEXT).min(last));
        let side = |lines: &Range<u32>| {
            let length = lines.end - lines.start;
            (lines.start + u32::from(length != 0), length)
        };
        let ((before, removed), (after, added)) = (side(&self.before), side(&self.after));
        let _ = writeln!(text, "@@ -{before},{removed} +{after},{added} @@");
        text.push_str(&self.body);
    }
}
