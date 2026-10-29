//! The items nested under an item, read for the page: each a row of its outline, at its depth,
//! keyed under the item, its code blocks left out.

use super::super::lines;
use super::{NestedItem, Node, children};

/// The lines of `nested` outside its fenced code blocks, fences included: a snippet's list is no
/// item of the outline.
fn outside_fences<'a>(nested: &[&'a str]) -> Vec<&'a str> {
    let mut is_in_fence = false;
    nested
        .iter()
        .copied()
        .filter(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
                is_in_fence = !is_in_fence;
                return false;
            }
            !is_in_fence
        })
        .collect()
}

/// The items nested under the item `key`, from its nested lines as written, at any depth, in the
/// order of the file, its code blocks left out.
pub(crate) fn nested_items(key: &str, nested: &[&str]) -> Vec<NestedItem> {
    fn walk(nodes: &[Node], depth: u32, out: &mut Vec<(u32, String)>) {
        for node in nodes {
            out.push((depth, node.text.join(" ")));
            walk(&node.children, depth + 1, out);
        }
    }
    let mut items = Vec::new();
    walk(&children(&outside_fences(nested)), 1, &mut items);
    let slugs = items
        .iter()
        .map(|(_, markdown)| crate::slug::from_text(&lines::plain(markdown).0))
        .collect();
    items
        .into_iter()
        .zip(lines::unique_keys(slugs))
        .map(|((depth, markdown), slug)| NestedItem {
            key: format!("{key}/{slug}"),
            depth,
            spans: super::super::document::parse(&markdown, "specs")
                .blocks
                .first()
                .map(|b| b.spans.clone())
                .unwrap_or_default(),
            text: markdown,
        })
        .collect()
}
