//! Story links: which links name a story, and which paragraphs embed one.

use uraeda_core::files::document::{BlockKind, parse};
use uraeda_core::files::stories::{StoryTarget, story_link, story_links};

/// A row of the table: its case, its markdown, and the story embedded, as its path, export, and
/// label.
type Row = (
    &'static str,
    &'static str,
    Option<(&'static str, &'static str, &'static str)>,
);

/// One row per paragraph, link, path, and fragment: the story the paragraph embeds, as its path,
/// export, and label.
#[test]
fn which_paragraphs_embed_a_story() {
    let rows: &[Row] = &[
        (
            "from the root",
            "[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)",
            Some((
                "packages/web/src/SidebarHandle.stories.tsx",
                "Dragging",
                "Dragging the handle",
            )),
        ),
        (
            "relative to the file",
            "[Invoice list](mockups/InvoiceList.stories.tsx#Empty)",
            Some((
                "specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx",
                "Empty",
                "Invoice list",
            )),
        ),
        (
            "spaces around",
            "  [A](/a.stories.ts#A)  ",
            Some(("a.stories.ts", "A", "A")),
        ),
        (
            "a marked label",
            "[**Thin** line](/a.stories.jsx#ThinLine)",
            Some(("a.stories.jsx", "ThinLine", "Thin line")),
        ),
        (
            "mjs",
            "[A](/a.stories.mjs#A)",
            Some(("a.stories.mjs", "A", "A")),
        ),
        (
            "svelte",
            "[A](/a.stories.svelte#A)",
            Some(("a.stories.svelte", "A", "A")),
        ),
        (
            "js",
            "[A](/a.stories.js#$a_1)",
            Some(("a.stories.js", "$a_1", "A")),
        ),
        ("vue", "[A](/a.stories.vue#A)", None),
        ("not a stories file", "[A](/src/Button.tsx#A)", None),
        ("no export", "[A](/a.stories.tsx)", None),
        (
            "an export that is no identifier",
            "[A](/a.stories.tsx#1st)",
            None,
        ),
        ("a dash", "[A](/a.stories.tsx#Drag-ging)", None),
        ("a non-ASCII export", "[A](/a.stories.tsx#A²)", None),
        (
            "an option's paragraph",
            "- **A**: thin\n\n  [A](/a.stories.tsx#A)\n",
            Some(("a.stories.tsx", "A", "A")),
        ),
        ("text around", "See [A](/a.stories.tsx#A).", None),
        (
            "two links",
            "[A](/a.stories.tsx#A) [B](/a.stories.tsx#B)",
            None,
        ),
        ("a web link", "[A](https://x.dev/a.stories.tsx#A)", None),
        ("an image", "![A](/a.stories.tsx#A)", None),
    ];
    for (case, markdown, expected) in rows {
        let doc = parse(markdown, "specs/2026-11-02-invoices");
        let found = story_links(&doc)
            .first()
            .map(|s| (s.path.clone(), s.export.clone(), s.label.clone()));
        assert_eq!(
            found
                .as_ref()
                .map(|(p, e, l)| (p.as_str(), e.as_str(), l.as_str())),
            *expected,
            "{case}"
        );
    }
}

/// A story link in a list item is a link to the Storybook page, not an embed.
#[test]
fn a_story_link_in_a_list_item_is_inline() {
    let doc = parse("- [A](/a.stories.tsx#A)\n", "specs/x");

    assert!(story_links(&doc).is_empty());
    let item = doc
        .blocks
        .iter()
        .find(|block| block.kind == BlockKind::Item)
        .unwrap();
    assert_eq!(
        item.spans[0].link.as_ref().unwrap().story,
        Some(StoryTarget {
            path: "a.stories.tsx".into(),
            export: "A".into(),
        })
    );
}

/// An agent's message has no folder: its links are read from the repository's root.
#[test]
fn an_agent_link_is_read_from_the_root() {
    let expected = Some(StoryTarget {
        path: "packages/web/src/SidebarHandle.stories.tsx".into(),
        export: "Dragging".into(),
    });

    assert_eq!(
        story_link("/packages/web/src/SidebarHandle.stories.tsx#Dragging"),
        expected
    );
    assert_eq!(
        story_link("packages/web/src/SidebarHandle.stories.tsx#Dragging"),
        expected
    );
    assert_eq!(story_link("https://x.dev/a.stories.tsx#A"), None);
    assert_eq!(story_link("#A"), None);
}

/// An embed names the block of its own paragraph, where its comments land.
#[test]
fn an_embed_names_its_paragraph() {
    let doc = parse("# T\n\nText.\n\n[A](/a.stories.tsx#A)\n", "specs/x");
    let paragraphs: Vec<u32> = doc
        .blocks
        .iter()
        .filter(|block| block.kind == BlockKind::Paragraph)
        .map(|block| block.id)
        .collect();

    let stories = story_links(&doc);

    assert_eq!(stories.len(), 1);
    assert_eq!(stories[0].block, paragraphs[1]);
}

/// A round option's second paragraph, nested in its list item, embeds its story and names its own
/// block.
#[test]
fn an_options_paragraph_embeds() {
    let doc = parse("- **A**: thin\n\n  [A](/a.stories.tsx#A)\n", "specs/x");
    let paragraph = doc
        .blocks
        .iter()
        .find(|block| block.kind == BlockKind::Paragraph)
        .unwrap();

    let stories = story_links(&doc);

    assert_eq!(stories.len(), 1);
    assert_eq!(stories[0].block, paragraph.id);
}
