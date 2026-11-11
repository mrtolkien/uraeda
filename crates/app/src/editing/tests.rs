use super::{Editing, OutlineHeading};

fn take(text: &str, index: u32, side: &str) -> String {
    Editing::take_conflict(text.to_string(), index, side.to_string())
}

const TWO: &str = "start\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> origin/main\nmiddle\n\
                   <<<<<<< HEAD\na\n||||||| base\nold\n=======\nb\nc\n>>>>>>> origin/main\nend\n";

#[test]
fn a_conflict_takes_a_side_or_both_and_leaves_the_rest() {
    let blocks = Editing::conflict_blocks(TWO.to_string());
    let found: Vec<_> = blocks.iter().map(|b| (b.line, b.ours, b.theirs)).collect();
    assert_eq!(found, [(1, 1, 1), (7, 1, 2)]);
    let cases = [
        (0, "ours", "start\nmine\nmiddle\n"),
        (0, "theirs", "start\ntheirs\nmiddle\n"),
        (0, "both", "start\nmine\ntheirs\nmiddle\n"),
        // The base section diff3 adds is dropped.
        (1, "ours", "middle\na\nend\n"),
        (1, "theirs", "middle\nb\nc\nend\n"),
    ];
    for (index, side, part) in cases {
        let taken = take(TWO, index, side);
        assert!(taken.contains(part), "{index} {side}: {taken}");
        assert_eq!(Editing::conflict_blocks(taken).len(), 1, "{index} {side}");
    }
    // No such block, or no such side: the text as it was.
    assert_eq!(take(TWO, 2, "ours"), TWO);
    assert_eq!(take(TWO, 0, "mine"), TWO);
}

#[test]
fn a_conflict_keeps_the_file_s_line_endings() {
    let crlf = "<<<<<<< HEAD\r\nmine\r\n=======\r\ntheirs\r\n>>>>>>> b\r\n";
    assert_eq!(take(crlf, 0, "both"), "mine\r\ntheirs\r\n");
    // A block at the end of a file without a last line break leaves none.
    let last = "x\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> b";
    assert_eq!(take(last, 0, "theirs"), "x\ntheirs");
}

#[test]
fn an_incomplete_or_nested_block_is_no_conflict() {
    for text in [
        "<<<<<<< HEAD\nmine\n=======\ntheirs\n",
        "<<<<<<< HEAD\nmine\n>>>>>>> b\n",
        "<<<<<<<< not a marker\n=======\n>>>>>>> b\n",
    ] {
        assert_eq!(Editing::conflict_blocks(text.to_string()), [], "{text:?}");
    }
    // A quoted opening marker before a real block: the block opens at the last one.
    let quoted = "<<<<<<< quoted\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> b\n";
    let blocks = Editing::conflict_blocks(quoted.to_string());
    assert_eq!(blocks.iter().map(|b| b.line).collect::<Vec<_>>(), [1]);
}

#[test]
fn an_outline_lists_the_headings_and_their_lines() {
    let text = "---\ntitle: x\n---\n# Spec\n\nWords.\n\n```md\n# not a heading\n```\n\n## Why *it* matters\n";
    let outline = Editing::outline(text.to_string());
    let heading = |level, title: &str, line| OutlineHeading {
        level,
        title: title.to_string(),
        line,
    };
    assert_eq!(
        outline,
        [heading(1, "Spec", 3), heading(2, "Why it matters", 11)]
    );
}
