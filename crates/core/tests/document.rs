mod common;

use std::path::{Path, PathBuf};

use uraeda_core::files::document::{
    Block, BlockKind, CalloutKind, Document, ItemMarker, LineRange, parse, plain,
};

/// Each block as its kind, parent, and lines.
fn shape(doc: &Document) -> Vec<(&'static str, Option<u32>, u32, u32)> {
    doc.blocks
        .iter()
        .map(|b| (b.kind.as_str(), b.parent, b.start_line, b.end_line))
        .collect()
}

fn only(doc: &Document, kind: BlockKind) -> Vec<&Block> {
    doc.blocks.iter().filter(|b| b.kind == kind).collect()
}

#[test]
fn blocks_have_their_source_lines() {
    let doc = parse(
        "---\nstatus: x\n---\n\n# T\n\nA\nB\n\n- one\n- two\n",
        "specs/f",
    );

    assert_eq!(doc.frontmatter_lines, Some(LineRange { start: 1, end: 3 }));
    assert_eq!(
        shape(&doc),
        [
            ("heading", None, 5, 5),
            ("paragraph", None, 7, 8),
            ("list", None, 10, 11),
            ("item", Some(2), 10, 10),
            ("item", Some(2), 11, 11),
        ]
    );
    assert_eq!(doc.text(1), "A B");
}

#[test]
fn callouts_have_their_kind() {
    let doc = parse(
        "> [!IMPORTANT]\n>\n> Spec to review.\n\n> [!QUESTION]\n> Which one?\n\n> plain\n",
        "specs",
    );

    let callouts = only(&doc, BlockKind::Callout);
    assert_eq!(callouts.len(), 2);
    assert_eq!(callouts[0].callout_kind, Some(CalloutKind::Important));
    assert_eq!(callouts[1].callout_kind, Some(CalloutKind::Question));
    assert_eq!((callouts[1].start_line, callouts[1].end_line), (5, 6));
    let question_body: Vec<String> = doc
        .children(callouts[1].id)
        .map(|b| plain(&b.spans))
        .collect();
    assert_eq!(question_body, ["Which one?"]);
    let inside: Vec<String> = doc
        .children(callouts[0].id)
        .map(|b| plain(&b.spans))
        .collect();
    assert_eq!(inside, ["Spec to review."]);
    assert_eq!(only(&doc, BlockKind::Quote).len(), 1);
}

#[test]
fn typed_bullets_and_list_callouts_set_the_marker() {
    let doc = parse(
        "- [pro] fast\n- [con] slow\n- [?] why\n- [!] mind it\n- ! careful\n- ? unsure\n- & aside\n- plain\n- [ ] todo\n- [x] done\n",
        "specs",
    );

    let items: Vec<(Option<ItemMarker>, String, Option<bool>)> = only(&doc, BlockKind::Item)
        .iter()
        .map(|b| (b.marker, plain(&b.spans), b.checked))
        .collect();
    assert_eq!(
        items,
        [
            (Some(ItemMarker::Pro), "fast".to_string(), None),
            (Some(ItemMarker::Con), "slow".to_string(), None),
            (Some(ItemMarker::Question), "why".to_string(), None),
            (Some(ItemMarker::Important), "mind it".to_string(), None),
            (Some(ItemMarker::Warning), "careful".to_string(), None),
            (Some(ItemMarker::Ask), "unsure".to_string(), None),
            (Some(ItemMarker::Note), "aside".to_string(), None),
            (Some(ItemMarker::Plain), "plain".to_string(), None),
            (Some(ItemMarker::Task), "todo".to_string(), Some(false)),
            (Some(ItemMarker::Task), "done".to_string(), Some(true)),
        ]
    );
}

#[test]
fn nested_items_hang_under_their_item() {
    let doc = parse(
        "- **A. One.**\n  - [pro] good\n  - [con] bad\n- **B. Two.**\n",
        "specs",
    );

    let items = only(&doc, BlockKind::Item);
    assert_eq!(items.len(), 4);
    let inner_list = doc.blocks[items[1].parent.unwrap() as usize].clone();
    assert_eq!(inner_list.parent, Some(items[0].id));
    assert_eq!((items[0].start_line, items[0].end_line), (1, 3));
    assert!(items[0].spans[0].strong);
    assert_eq!(plain(&items[0].spans), "A. One.");
}

#[test]
fn loose_items_take_their_first_paragraph() {
    let doc = parse("- first\n\n  second\n\n- other\n", "specs");

    let items = only(&doc, BlockKind::Item);
    assert_eq!(plain(&items[0].spans), "first");
    let children: Vec<String> = doc.children(items[0].id).map(|b| plain(&b.spans)).collect();
    assert_eq!(children, ["second"]);
}

#[test]
fn tables_have_rows_and_cells() {
    let doc = parse("| A | B |\n| :- | -: |\n| 1 | 2 |\n", "specs");

    assert_eq!(only(&doc, BlockKind::Table).len(), 1);
    let rows = only(&doc, BlockKind::Row);
    assert_eq!(
        rows.iter().map(|r| r.header).collect::<Vec<_>>(),
        [Some(true), Some(false)]
    );
    let cells: Vec<(String, Option<String>)> = only(&doc, BlockKind::Cell)
        .iter()
        .map(|c| (plain(&c.spans), c.align.clone()))
        .collect();
    assert_eq!(
        cells,
        [
            ("A".to_string(), Some("left".to_string())),
            ("B".to_string(), Some("right".to_string())),
            ("1".to_string(), Some("left".to_string())),
            ("2".to_string(), Some("right".to_string())),
        ]
    );
    assert_eq!((rows[1].start_line, rows[1].end_line), (3, 3));
}

#[test]
fn code_and_html_keep_their_text() {
    let doc = parse(
        "```rust\nfn main() {}\n```\n\n<div>x</div>\n\n---\n",
        "specs",
    );

    let code = only(&doc, BlockKind::Code)[0];
    assert_eq!(code.language.as_deref(), Some("rust"));
    assert_eq!(code.text.as_deref(), Some("fn main() {}\n"));
    assert_eq!((code.start_line, code.end_line), (1, 3));
    let html = only(&doc, BlockKind::Html)[0];
    assert_eq!(html.text.as_deref(), Some("<div>x</div>\n"));
    assert_eq!(only(&doc, BlockKind::Rule).len(), 1);
}

#[test]
fn spans_carry_their_marks_and_links() {
    let doc = parse(
        "**b** _e_ `c` ~~s~~ [spec](spec.md#a) [web](https://x.dev) [[due-dates]] [root](/src/a.ts) [top](#here)\n",
        "specs/f",
    );

    let spans = &doc.blocks[0].spans;
    let find = |text: &str| spans.iter().find(|s| s.text == text).unwrap();
    assert!(find("b").strong);
    assert!(find("e").emphasis);
    assert!(find("c").code);
    assert!(find("s").strike);
    let link = |text: &str| find(text).link.clone().unwrap();
    assert_eq!(link("spec").path.as_deref(), Some("specs/f/spec.md"));
    assert_eq!(link("spec").target, "spec.md#a");
    assert_eq!(link("web").path, None);
    assert_eq!(link("root").path.as_deref(), Some("src/a.ts"));
    assert_eq!(link("top").path, None);
    let wiki = spans.iter().find_map(|s| s.link.clone().filter(|l| l.wiki));
    assert_eq!(wiki.unwrap().target, "due-dates");
}

#[test]
fn an_image_is_a_span_with_its_alt_text_and_path() {
    let doc = parse(
        "See ![Login](images/login.webp) and ![x](https://e.com/a.png), not ![[shot.png]].\n",
        "specs/2026-10-14-x",
    );

    let spans = &doc.blocks[0].spans;
    let images: Vec<_> = spans
        .iter()
        .filter_map(|s| s.image.as_ref().map(|image| (s.text.as_str(), image)))
        .collect();
    assert_eq!(images.len(), 2, "{spans:?}");
    assert_eq!(images[0].0, "Login");
    assert_eq!(images[0].1.target, "images/login.webp");
    assert_eq!(
        images[0].1.path.as_deref(),
        Some("specs/2026-10-14-x/images/login.webp")
    );
    assert_eq!(images[1].0, "x");
    assert_eq!(images[1].1.path, None);
    assert!(
        plain(spans).contains("shot.png"),
        "the embed stays text: {spans:?}"
    );
    assert!(
        spans
            .iter()
            .filter(|s| s.text.contains("shot.png"))
            .all(|s| s.image.is_none() && s.link.is_none())
    );
}

/// The image spans of a paragraph's text, as their alt text, image path, and link path.
fn images(text: &str) -> Vec<(String, Option<String>, Option<String>)> {
    let doc = parse(text, "specs/2026-10-14-x");
    doc.blocks[0]
        .spans
        .iter()
        .filter_map(|s| {
            let image = s.image.as_ref()?;
            let link = s.link.as_ref().and_then(|l| l.path.clone());
            Some((s.text.clone(), image.path.clone(), link))
        })
        .collect()
}

#[test]
fn an_image_inside_a_link_has_the_link() {
    assert_eq!(
        images("[![a](a.png)](b.md)\n"),
        [(
            "a".to_string(),
            Some("specs/2026-10-14-x/a.png".to_string()),
            Some("specs/2026-10-14-x/b.md".to_string())
        )]
    );
}

#[test]
fn an_image_alt_text_keeps_its_marked_text() {
    assert_eq!(
        images("![a *b* `c`](x.png)\n"),
        [(
            "a b c".to_string(),
            Some("specs/2026-10-14-x/x.png".to_string()),
            None
        )]
    );
}

#[test]
fn a_nested_image_is_part_of_the_outer_alt_text() {
    let doc = parse("![a ![b](b.png) c](o.png) d\n", "specs/2026-10-14-x");

    let spans = &doc.blocks[0].spans;
    assert_eq!(spans.len(), 2, "{spans:?}");
    assert_eq!(spans[0].text, "a b c");
    assert_eq!(spans[0].image.as_ref().unwrap().target, "o.png");
    assert_eq!(spans[1].text, " d");
    assert_eq!(spans[1].image, None);
}

#[test]
fn an_image_alt_text_is_never_an_item_marker() {
    let doc = parse("- ![! warn](w.png)\n", "specs");

    let item = only(&doc, BlockKind::Item)[0];
    assert_eq!(item.marker, Some(ItemMarker::Plain));
    assert_eq!(item.spans[0].text, "! warn");
    assert!(item.spans[0].image.is_some());
}

#[test]
fn a_uri_scheme_is_not_a_repository_path() {
    let doc = parse(
        "![d](data:image/png;base64,AAAA) [f](file:///etc/passwd) [m](mailto:a@b.c) [c](C++.md) ![p](//e.com/x.png)\n",
        "specs/f",
    );

    let paths: Vec<_> = doc.blocks[0]
        .spans
        .iter()
        .filter_map(|s| match (&s.image, &s.link) {
            (Some(image), _) => Some(image.path.clone()),
            (None, Some(link)) => Some(link.path.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(
        paths,
        [None, None, None, Some("specs/f/C++.md".to_string()), None]
    );
}

#[test]
fn a_percent_encoded_target_is_decoded() {
    let doc = parse(
        "![s](images/my%20shot.webp) [n](caf%C3%A9.md#top) [bad](a%zz%FF.md)\n",
        "specs/f",
    );

    let paths: Vec<_> = doc.blocks[0]
        .spans
        .iter()
        .filter_map(|s| match (&s.image, &s.link) {
            (Some(image), _) => image.path.clone(),
            (None, Some(link)) => link.path.clone(),
            _ => None,
        })
        .collect();
    assert_eq!(
        paths,
        [
            "specs/f/images/my shot.webp",
            "specs/f/café.md",
            "specs/f/a%zz%FF.md"
        ]
    );
}

#[test]
fn headings_have_anchors_and_blocks_their_heading() {
    let doc = parse(
        "# Title\n\n## Q2: How does it work?\n\nText\n\n## Notes\n\n## Notes\n",
        "specs",
    );

    let headings = only(&doc, BlockKind::Heading);
    let anchors: Vec<_> = headings.iter().map(|h| h.anchor.clone().unwrap()).collect();
    assert_eq!(
        anchors,
        ["title", "q2-how-does-it-work", "notes", "notes-1"]
    );
    assert_eq!(headings[1].level, Some(2));
    let paragraph = only(&doc, BlockKind::Paragraph)[0];
    assert_eq!(paragraph.heading.as_deref(), Some("Q2: How does it work?"));
    assert_eq!(headings[0].heading.as_deref(), Some("Title"));
}

#[test]
fn the_hash_follows_the_text() {
    let one = parse("a\n", "specs");
    let two = parse("b\n", "specs");

    assert_eq!(one.hash.len(), 64);
    assert!(one.hash.chars().all(|c| c.is_ascii_hexdigit()));
    assert_ne!(one.hash, two.hash);
}

fn markdown_files(dir: &Path, files: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).unwrap().flatten() {
        let path = entry.path();
        if path.is_dir() {
            markdown_files(&path, files);
        } else if path.extension().is_some_and(|e| e == "md") {
            files.push(path);
        }
    }
}

/// SC-006: every file of the example and of `specs/` renders, each line in a block, the
/// frontmatter, or blank. `specs/` is written by hand: a file the parser cannot place a line of is
/// a parser bug, whatever the file says.
#[test]
fn every_example_and_specs_file_parses() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let mut files = Vec::new();
    markdown_files(&root.join("skills/uraeda/assets/example/specs"), &mut files);
    markdown_files(&root.join("specs"), &mut files);
    assert!(files.len() > 20);
    for file in files {
        let text = std::fs::read_to_string(&file).unwrap();
        let doc = parse(&text, "specs");
        let mut covered = vec![false; text.lines().count() + 1];
        if let Some(range) = doc.frontmatter_lines {
            for line in range.start..=range.end {
                covered[line as usize] = true;
            }
        }
        for block in &doc.blocks {
            assert!(block.start_line <= block.end_line, "{}", file.display());
            for line in block.start_line..=block.end_line {
                covered[line as usize] = true;
            }
        }
        for (index, line) in text.lines().enumerate() {
            assert!(
                covered[index + 1] || line.trim().is_empty(),
                "{}:{} is in no block: {line}",
                file.display(),
                index + 1
            );
        }
    }
}

#[test]
fn a_query_is_not_part_of_the_path() {
    let doc = parse(
        "![s](images/shot.webp?v=2) [n](notes.md?raw#top) [q](?only)\n",
        "specs/f",
    );

    let paths: Vec<_> = doc.blocks[0]
        .spans
        .iter()
        .filter_map(|s| match (&s.image, &s.link) {
            (Some(image), _) => Some(image.path.clone()),
            (None, Some(link)) => Some(link.path.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(
        paths,
        [
            Some("specs/f/images/shot.webp".to_string()),
            Some("specs/f/notes.md".to_string()),
            None
        ]
    );
}
