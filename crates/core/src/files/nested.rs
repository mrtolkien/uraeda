//! The items nested under a list's item, as `PRIORITIES.md`'s entries and `INBOX.md`'s notes hold
//! them, at any depth, as a tree, and the edits of such an outline: editing, adding, removing,
//! indenting, outdenting, and moving one item among its siblings. An edit rewrites the items it
//! touches, and only them: their nested items are written again, each indented to its parent's text.

use super::lines::{self, Item, Marker};

/// An item of an outline, the list's own item at its root.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Node {
    pub marker: Marker,
    /// Its text: its first line after its marker, then its continuation lines, trimmed.
    pub text: Vec<String>,
    pub children: Vec<Node>,
}

/// An item nested under a list's item, for editing: its address, its depth, and its text.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NestedItem {
    /// Its address, `<item's key>/<slug of its text>`, unique under its item as the items' keys
    /// are: stable while its text stays.
    pub key: String,
    /// 1 for the item's own items, 2 for theirs, ...
    pub depth: u32,
    /// The markdown of its text, after its marker, on one line.
    pub text: String,
    pub spans: Vec<super::document::Span>,
}

/// An edit of an outline: of a list's item, or of one of the items nested under it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OutlineEdit {
    /// Its text becomes this line.
    Edit(String),
    /// A new item, this line, beside it: below it, after its own items, or above it.
    Insert { line: String, below: bool },
    /// A new item, this line, as its last item.
    Append(String),
    /// It goes, with its items.
    Remove,
    /// It becomes the last item of the one above it, its own items with it.
    Indent,
    /// It becomes the item after its parent, its own items with it; a list's item's own item
    /// becomes an item of the list, the one after it.
    Outdent,
    /// It changes place with the item above it, or below it, among its siblings.
    Up,
    Down,
}

impl OutlineEdit {
    /// The edit `kind` names, as the server sends it: `edit`, `insert-below`, `insert-above`,
    /// `append-child`, `remove`, `indent`, `outdent`, `up`, or `down`; `text` for those that write
    /// a line.
    pub fn from_kind(kind: &str, text: Option<&str>) -> Option<OutlineEdit> {
        let line = || Some(lines::one_line(text?)).filter(|line| !line.is_empty());
        Some(match kind {
            "edit" => OutlineEdit::Edit(line()?),
            "insert-below" => OutlineEdit::Insert {
                line: line()?,
                below: true,
            },
            "insert-above" => OutlineEdit::Insert {
                line: line()?,
                below: false,
            },
            "append-child" => OutlineEdit::Append(line()?),
            "remove" => OutlineEdit::Remove,
            "indent" => OutlineEdit::Indent,
            "outdent" => OutlineEdit::Outdent,
            "up" => OutlineEdit::Up,
            "down" => OutlineEdit::Down,
            _ => return None,
        })
    }
}

/// The items of `lines`, an item's nested lines as written, as a tree: an item is the child of the
/// one before it indented less. A line that starts no item continues the item above it.
pub(crate) fn children(lines: &[&str]) -> Vec<Node> {
    let mut roots = Vec::new();
    let mut indents: Vec<usize> = Vec::new();
    for line in lines {
        let trimmed = line.trim_start();
        let indent = line.len() - trimmed.len();
        match lines::item_marker(trimmed) {
            Some((marker, rest)) => {
                while indents.last().is_some_and(|&open| open >= indent) {
                    indents.pop();
                }
                level(&mut roots, indents.len()).push(Node {
                    marker,
                    text: vec![rest.to_string()],
                    children: Vec::new(),
                });
                indents.push(indent);
            }
            None => {
                if let Some(open) = indents.len().checked_sub(1) {
                    if let Some(node) = level(&mut roots, open).last_mut() {
                        node.text.push(trimmed.to_string());
                    }
                }
            }
        }
    }
    roots
}

/// The items at `depth` under `roots`, along the last item of each level: where the next item at
/// that depth goes.
fn level(roots: &mut Vec<Node>, depth: usize) -> &mut Vec<Node> {
    if depth == 0 || roots.is_empty() {
        return roots;
    }
    let last = roots.len() - 1;
    level(&mut roots[last].children, depth - 1)
}

/// The items nested under the item `key`, from its nested lines as written, at any depth, in the
/// order of the file.
pub(crate) fn nested_items(key: &str, nested: &[&str]) -> Vec<NestedItem> {
    fn walk(nodes: &[Node], depth: u32, out: &mut Vec<(u32, String)>) {
        for node in nodes {
            out.push((depth, node.text.join(" ")));
            walk(&node.children, depth + 1, out);
        }
    }
    let mut items = Vec::new();
    walk(&children(nested), 1, &mut items);
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
            spans: super::document::parse(&markdown, "specs")
                .blocks
                .first()
                .map(|b| b.spans.clone())
                .unwrap_or_default(),
            text: markdown,
        })
        .collect()
}

/// The path to the item at `at` in the order of the file, from 0: its index among its siblings at
/// each level.
fn path_of(nodes: &[Node], at: usize) -> Option<Vec<usize>> {
    fn find(nodes: &[Node], at: usize, count: &mut usize, path: &mut Vec<usize>) -> bool {
        for (index, node) in nodes.iter().enumerate() {
            path.push(index);
            if *count == at {
                return true;
            }
            *count += 1;
            if find(&node.children, at, count, path) {
                return true;
            }
            path.pop();
        }
        false
    }
    let mut path = Vec::new();
    find(nodes, at, &mut 0, &mut path).then_some(path)
}

/// The items under the item at `parent`, a path: `nodes` themselves for an empty one.
fn siblings<'a>(nodes: &'a mut Vec<Node>, parent: &[usize]) -> Option<&'a mut Vec<Node>> {
    let mut nodes = nodes;
    for &index in parent {
        nodes = &mut nodes.get_mut(index)?.children;
    }
    Some(nodes)
}

/// The lines of `node` and its items, its marker at column `indent`: each item at its parent's
/// text, each continuation line too.
fn render(node: &Node, indent: usize, out: &mut Vec<String>) {
    let marker = node.marker.render();
    let inner = indent + marker.len() + 1;
    let first = node.text.first().map_or("", String::as_str);
    out.push(format!("{}{marker} {first}", " ".repeat(indent)));
    for line in node.text.iter().skip(1) {
        out.push(format!("{}{line}", " ".repeat(inner)));
    }
    for child in &node.children {
        render(child, inner, out);
    }
}

/// Whether nested lines can be written again from their tree: each line an item or an item's
/// continuation. Code, or text before the first item, would be lost or moved: such an item's
/// outline is never rewritten.
fn is_rewritable(nested: &[&str]) -> bool {
    let mut is_in_item = false;
    for line in nested {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            return false;
        }
        if lines::item_marker(trimmed).is_some() {
            is_in_item = true;
        } else if !is_in_item && !trimmed.is_empty() {
            return false;
        }
    }
    true
}

/// A list's item as a tree, the item at its root, from `lines`, the text's lines; `None` when its
/// nested lines cannot be written again (see [`is_rewritable`]).
fn tree(lines: &[&str], item: &Item) -> Option<Node> {
    let nested = &lines[item.text_end..item.end];
    is_rewritable(nested).then(|| Node {
        marker: item.marker.clone(),
        text: lines::item_text(lines, item)
            .into_iter()
            .map(String::from)
            .collect(),
        children: children(nested),
    })
}

/// The whole of an item, its nested lines included, for [`lines::replace`].
fn whole(item: &Item) -> Item {
    Item {
        text_end: item.end,
        ..item.clone()
    }
}

/// A new item's marker, beside `sibling`: its bullet, or `-` beside a number.
pub(crate) fn marker_beside(sibling: &Marker) -> Marker {
    match sibling {
        Marker::Bullet(bullet) => Marker::Bullet(*bullet),
        Marker::Number(_) => Marker::Bullet('-'),
    }
}

/// A new item, `line`, as the last item nested under the list's item `item`.
pub(crate) fn append_child(text: &str, item: &Item, line: &str) -> Option<String> {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut root = tree(&lines, item)?;
    root.children.push(Node {
        marker: root
            .children
            .last()
            .map_or(Marker::Bullet('-'), |last| marker_beside(&last.marker)),
        text: vec![line.to_string()],
        children: Vec::new(),
    });
    let mut written = Vec::new();
    render(&root, 0, &mut written);
    Some(lines::replace(text, &whole(item), &written))
}

/// The list's item `item`, its nested items with it, as the last item nested under `above`, a
/// list's item before it.
pub(crate) fn indent_under(text: &str, above: &Item, item: &Item) -> Option<String> {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut parent = tree(&lines, above)?;
    parent.children.push(tree(&lines, item)?);
    let mut written = Vec::new();
    render(&parent, 0, &mut written);
    // The item goes first: it is after the one above, whose lines keep their numbers.
    let without = lines::remove(text, item);
    Some(lines::replace(&without, &whole(above), &written))
}

/// The lines of the list's item `item` without its nested item at `at`, its own items with it, and
/// that item as the lines of a list's item: what a drop that makes it one takes out. `None` when
/// there is no such item, or nested lines that cannot be written again.
pub(crate) fn take(text: &str, item: &Item, at: usize) -> Option<(String, Vec<String>)> {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut root = tree(&lines, item)?;
    let path = path_of(&root.children, at)?;
    let (&index, parent) = path.split_last()?;
    let mut node = siblings(&mut root.children, parent)?.remove(index);
    node.marker = marker_beside(&node.marker);
    let mut written = Vec::new();
    render(&root, 0, &mut written);
    let mut taken = Vec::new();
    render(&node, 0, &mut taken);
    Some((lines::replace(text, &whole(item), &written), taken))
}

/// Moves the list's item `items[from]`, or with `from_at` its nested item at `from_at`, its own
/// items with it, under the list's item `items[to]`, or with `to_at` under its nested item at
/// `to_at`, at `index` among the items there once it left them. `items` are the list's items in the
/// order of the file, and `at`s count nested items in that order. `None` when an item is missing,
/// would go under itself, `index` is past the end, or nested lines cannot be written again.
pub(crate) fn move_under(
    text: &str,
    items: &[Item],
    (from, from_at): (usize, Option<usize>),
    (to, to_at): (usize, Option<usize>),
    index: usize,
) -> Option<String> {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut target = tree(&lines, items.get(to)?)?;
    let mut parent = match to_at {
        None => Vec::new(),
        Some(at) => path_of(&target.children, at)?,
    };
    let node = if from == to {
        // Within one item: taken out of its tree, which the parent's path may cross.
        let source = path_of(&target.children, from_at?)?;
        if parent.starts_with(&source) {
            return None;
        }
        let (&own, above) = source.split_last()?;
        let node = siblings(&mut target.children, above)?.remove(own);
        if parent.len() > above.len() && parent.starts_with(above) && parent[above.len()] > own {
            parent[above.len()] -= 1;
        }
        node
    } else {
        let mut source = tree(&lines, items.get(from)?)?;
        match from_at {
            None => source,
            Some(at) => {
                let path = path_of(&source.children, at)?;
                let (&own, above) = path.split_last()?;
                siblings(&mut source.children, above)?.remove(own)
            }
        }
    };
    let nodes = siblings(&mut target.children, &parent)?;
    if index > nodes.len() {
        return None;
    }
    let mut node = node;
    if let Some(beside) = nodes.first().or(nodes.last()) {
        node.marker = marker_beside(&beside.marker);
    }
    nodes.insert(index, node);
    let mut written = Vec::new();
    render(&target, 0, &mut written);
    if from == to {
        return Some(lines::replace(text, &whole(&items[to]), &written));
    }
    // The later of the two items is written first: the earlier one's lines keep their numbers.
    let source = &items[from];
    let rest = |text: &str| -> Option<String> {
        Some(match from_at {
            None => lines::remove(text, source),
            Some(at) => take(text, source, at)?.0,
        })
    };
    if source.line > items[to].line {
        let without = rest(text)?;
        Some(lines::replace(&without, &whole(&items[to]), &written))
    } else {
        let with = lines::replace(text, &whole(&items[to]), &written);
        rest(&with)
    }
}

/// An edit of the item at `at` of the items nested under the list's item `item`, in the order of
/// the file. An item it holds outdented becomes a list's item after it. `None` when there is no
/// such item, nowhere to go, or nested lines that cannot be written again.
pub(crate) fn on_nested(text: &str, item: &Item, at: usize, edit: &OutlineEdit) -> Option<String> {
    let lines: Vec<&str> = text.split('\n').collect();
    let mut root = tree(&lines, item)?;
    let path = path_of(&root.children, at)?;
    let (&index, parent) = path.split_last()?;
    let mut after = Vec::new();
    {
        let nodes = siblings(&mut root.children, parent)?;
        match edit {
            OutlineEdit::Edit(line) => nodes.get_mut(index)?.text = vec![line.clone()],
            OutlineEdit::Remove => {
                nodes.remove(index);
            }
            OutlineEdit::Insert { line, below } => {
                let marker = marker_beside(&nodes.get(index)?.marker);
                let node = Node {
                    marker,
                    text: vec![line.clone()],
                    children: Vec::new(),
                };
                nodes.insert(index + usize::from(*below), node);
            }
            OutlineEdit::Append(line) => {
                let node = nodes.get_mut(index)?;
                let marker = node
                    .children
                    .last()
                    .map_or(Marker::Bullet('-'), |last| marker_beside(&last.marker));
                node.children.push(Node {
                    marker,
                    text: vec![line.clone()],
                    children: Vec::new(),
                });
            }
            OutlineEdit::Indent => {
                let above = index.checked_sub(1)?;
                let node = nodes.remove(index);
                nodes[above].children.push(node);
            }
            OutlineEdit::Up => nodes.swap(index.checked_sub(1)?, index),
            OutlineEdit::Down => {
                if index + 1 >= nodes.len() {
                    return None;
                }
                nodes.swap(index, index + 1);
            }
            OutlineEdit::Outdent => {
                let node = nodes.remove(index);
                match parent.split_last() {
                    // Under another item: after it, among its siblings.
                    Some((&own, grand)) => {
                        siblings(&mut root.children, grand)?.insert(own + 1, node);
                    }
                    // The list's item's own item: an item of the list, after it.
                    None => after.push(node),
                }
            }
        }
    }
    let mut written = Vec::new();
    render(&root, 0, &mut written);
    for node in &after {
        render(node, 0, &mut written);
    }
    Some(lines::replace(text, &whole(item), &written))
}
