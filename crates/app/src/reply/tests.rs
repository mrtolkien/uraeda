//! The splitter's cases: a reply sent in pieces, and what each piece finished and left growing.

use super::split::{Growing, Splitter};

/// What a step shows: the blocks it finished, and the one still growing.
#[derive(Debug, PartialEq)]
struct Seen {
    finished: Vec<String>,
    growing: Growing,
}

fn text(text: &str) -> Growing {
    Growing::Text(text.to_owned())
}

fn code(language: &str, text: &str) -> Growing {
    Growing::Code {
        language: language.to_owned(),
        text: text.to_owned(),
    }
}

/// Feeds `pieces` one by one, then ends the reply, and returns what each step showed: the end's
/// last.
fn run(pieces: &[&[u8]]) -> Vec<Seen> {
    let mut splitter = Splitter::default();
    let mut seen: Vec<Seen> = pieces
        .iter()
        .map(|piece| {
            let finished = splitter.push(piece);
            Seen {
                finished,
                growing: splitter.growing(),
            }
        })
        .collect();
    seen.push(Seen {
        finished: splitter.end(),
        growing: splitter.growing(),
    });
    seen
}

fn step(finished: &[&str], growing: Growing) -> Seen {
    Seen {
        finished: finished.iter().map(|block| (*block).to_owned()).collect(),
        growing,
    }
}

#[test]
fn a_paragraph_is_finished_by_a_blank_line() {
    assert_eq!(
        run(&[b"One line,", b" and more.\n", b"\nNext"]),
        [
            step(&[], text("One line,")),
            step(&[], text("One line, and more.\n")),
            step(&["One line, and more.\n"], text("Next")),
            step(&["Next"], text("")),
        ]
    );
}

#[test]
fn a_fence_opened_and_closed_across_pieces_is_code_while_open() {
    assert_eq!(
        run(&[
            b"Run:\n\n``",
            b"`rust\nfn main() {\n\n",
            b"}\n``",
            b"`\nDone."
        ]),
        [
            step(&["Run:\n"], text("``")),
            step(&[], code("rust", "fn main() {\n\n")),
            step(&[], code("rust", "fn main() {\n\n}\n``")),
            step(&["```rust\nfn main() {\n\n}\n```\n"], text("Done.")),
            step(&["Done."], text("")),
        ]
    );
}

#[test]
fn a_fence_left_open_is_finished_by_the_end() {
    assert_eq!(
        run(&[b"~~~\nls -l\n"]),
        [
            step(&[], code("", "ls -l\n")),
            step(&["~~~\nls -l\n"], text("")),
        ]
    );
}

#[test]
fn a_list_grows_across_blank_lines_until_something_else_starts() {
    assert_eq!(
        run(&[
            b"- one\n",
            b"\n- two\n",
            b"  more of two\n\n",
            b"1. three\n\nAfter.\n"
        ]),
        [
            step(&[], text("- one\n")),
            step(&[], text("- one\n\n- two\n")),
            step(&[], text("- one\n\n- two\n  more of two\n\n")),
            step(
                &["- one\n\n- two\n  more of two\n\n1. three\n\n"],
                text("After.\n")
            ),
            step(&["After.\n"], text("")),
        ]
    );
}

#[test]
fn a_fence_inside_a_list_keeps_its_blank_lines() {
    assert_eq!(
        run(&[b"- step:\n\n  ```\n  a\n\n  b\n  ```\n\nEnd\n"]),
        [
            step(&["- step:\n\n  ```\n  a\n\n  b\n  ```\n\n"], text("End\n")),
            step(&["End\n"], text("")),
        ]
    );
}

#[test]
fn a_table_is_one_block_until_a_blank_line() {
    assert_eq!(
        run(&[b"| a | b |\n|---|", b"---|\n| 1 | 2 |\n", b"\n"]),
        [
            step(&[], text("| a | b |\n|---|")),
            step(&[], text("| a | b |\n|---|---|\n| 1 | 2 |\n")),
            step(&["| a | b |\n|---|---|\n| 1 | 2 |\n"], text("")),
            step(&[], text("")),
        ]
    );
}

#[test]
fn a_heading_or_a_fence_ends_the_paragraph_before_it() {
    assert_eq!(
        run(&[b"Intro\n## Plan\nText\n```\nx\n```\n"]),
        [
            step(
                &["Intro\n", "## Plan\n", "Text\n", "```\nx\n```\n"],
                text("")
            ),
            step(&[], text("")),
        ]
    );
}

#[test]
fn an_underline_makes_the_paragraph_a_heading_and_ends_it() {
    assert_eq!(
        run(&[b"Title\n---\nText\n***\n"]),
        [
            step(&["Title\n---\n", "Text\n", "***\n"], text("")),
            step(&[], text("")),
        ]
    );
}

#[test]
fn a_piece_that_ends_inside_a_character_waits_for_the_rest() {
    let word = "café ✓\n\nnext".as_bytes();
    // `é` is two bytes and `✓` three: cut inside each.
    let (one, rest) = word.split_at(4);
    let (two, three) = rest.split_at(4);
    assert_eq!(
        run(&[one, two, three]),
        [
            step(&[], text("caf")),
            step(&[], text("café ")),
            step(&["café ✓\n"], text("next")),
            step(&["next"], text("")),
        ]
    );
}

#[test]
fn a_finished_block_is_read_into_the_cores_tree() {
    let tree = super::tree("A **bold** [link](https://example.com).\n");
    let tree: serde_json::Value = serde_json::from_str(&tree).expect("the tree's JSON");
    let spans = &tree["blocks"][0]["spans"];
    assert_eq!(tree["blocks"][0]["kind"], "paragraph");
    assert_eq!(spans[1]["text"], "bold");
    assert_eq!(spans[1]["strong"], true);
    assert_eq!(spans[3]["link"]["target"], "https://example.com");
}
