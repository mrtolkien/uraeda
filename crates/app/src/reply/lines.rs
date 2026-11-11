//! What one line of Markdown starts or ends, as CommonMark reads it, for the splitter: only what
//! decides where a block ends, never the block's content, which the core's parser reads.

/// A complete line, without its line break.
#[derive(Clone, Copy)]
pub struct Line<'a> {
    pub text: &'a str,
}

impl<'a> Line<'a> {
    pub fn new(line: &'a str) -> Line<'a> {
        Line {
            text: line.trim_end_matches(['\n', '\r']),
        }
    }

    pub fn is_blank(self) -> bool {
        self.text.trim().is_empty()
    }

    /// Indented as an item's continuation: two spaces, or a tab.
    pub fn is_indented(self) -> bool {
        self.text.starts_with("  ") || self.text.starts_with('\t')
    }

    /// `#` to `######`, then a space or nothing.
    pub fn is_heading(self) -> bool {
        let Some(rest) = indented(self.text) else {
            return false;
        };
        let marks = rest.bytes().take_while(|byte| *byte == b'#').count();
        (1..=6).contains(&marks)
            && rest[marks..]
                .chars()
                .next()
                .is_none_or(|next| next == ' ' || next == '\t')
    }

    /// Three or more `-`, `*`, or `_`, alone with spaces.
    pub fn is_rule(self) -> bool {
        let Some(rest) = indented(self.text) else {
            return false;
        };
        let marks: Vec<char> = rest.chars().filter(|c| !c.is_whitespace()).collect();
        marks.len() >= 3
            && matches!(marks[0], '-' | '*' | '_')
            && marks.iter().all(|mark| *mark == marks[0])
    }

    /// A setext heading's underline: `=` or `-` alone.
    pub fn is_underline(self) -> bool {
        let Some(rest) = indented(self.text) else {
            return false;
        };
        let rest = rest.trim_end();
        !rest.is_empty() && (rest.bytes().all(|b| b == b'=') || rest.bytes().all(|b| b == b'-'))
    }

    /// A list's item: `-`, `*`, or `+`, or a number with `.` or `)`, then a space or nothing.
    pub fn is_item(self) -> bool {
        let Some(rest) = indented(self.text) else {
            return false;
        };
        let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
        let after = match digits {
            0 if rest.starts_with(['-', '*', '+']) => &rest[1..],
            1..=9 if rest[digits..].starts_with(['.', ')']) => &rest[digits + 1..],
            _ => return false,
        };
        after.is_empty() || after.starts_with([' ', '\t'])
    }

    /// Whether it ends the block before it without a blank line: a heading, a fence, or a rule.
    pub fn interrupts(self) -> bool {
        self.is_heading() || fence_opens(self.text).is_some() || self.is_rule()
    }
}

/// The line without the up to three spaces a block's first mark may follow, or `None` when it
/// is indented further, as code.
fn indented(line: &str) -> Option<&str> {
    let spaces = line.bytes().take_while(|byte| *byte == b' ').count();
    (spaces <= 3).then(|| &line[spaces..])
}

/// The marker and length of the fence `line` opens: three or more backticks or tildes, a
/// backtick fence's language holding no backtick.
pub fn fence_opens(line: &str) -> Option<(u8, usize)> {
    let rest = indented(line)?;
    let marker = *rest.as_bytes().first()?;
    if marker != b'`' && marker != b'~' {
        return None;
    }
    let length = rest.bytes().take_while(|byte| *byte == marker).count();
    let info = &rest[length..];
    (length >= 3 && !(marker == b'`' && info.contains('`'))).then_some((marker, length))
}

/// Whether `line` closes a fence of `marker` that is `length` long: as many marks or more, alone.
pub fn fence_closes(line: &str, marker: u8, length: usize) -> bool {
    let Some(rest) = indented(line.trim_end_matches(['\n', '\r'])) else {
        return false;
    };
    let marks = rest.bytes().take_while(|byte| *byte == marker).count();
    marks >= length && rest[marks..].trim().is_empty()
}
