//! The edits of `PRIORITIES.md`: adding, moving, linking, editing, and removing proposals, each
//! splicing lines so every other line keeps its bytes.

use super::super::lines::{self, Item, Marker};
use super::super::markdown::link_text as escaped;
use super::{Proposal, Section, keys, parse, proposal_id};

fn proposal_at(text: &str, line: usize) -> Option<Proposal> {
    parse(text)
        .into_iter()
        .find(|proposal| proposal.line == line)
}

/// Turns the proposal starting at `line` into a link to `target`, alone: its sub-items go, as the
/// file it links takes them.
pub fn link(text: &str, line: usize, target: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = proposal_at(text, line).ok_or(())?;
        let item = format!(
            "{} [{}]({target})",
            proposal.item.marker.render(),
            escaped(&proposal.text)
        );
        let whole = Item {
            text_end: proposal.item.end,
            ..proposal.item.clone()
        };
        Ok::<_, ()>(lines::replace(text, &whole, &[item]))
    })
    .ok()
}

/// Removes the proposal starting at `line`, sub-items included, and adds a link to `target` on top
/// of **Now**, as [`add_started`] does.
pub fn move_to_started(text: &str, line: usize, link_text: &str, target: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = proposal_at(text, line).ok_or(())?;
        let without = lines::remove(text, &proposal.item);
        Ok::<_, ()>(add_started(&without, link_text, target))
    })
    .ok()
}

/// Whether a proposal links a started feature's or change's proposal:
/// `/specs/<YYYY-MM-DD-slug>/proposal.md` or `/specs/changes/<YYYY-MM-DD-slug>/proposal.md`.
fn is_started(proposal: &Proposal) -> bool {
    let Some(path) =
        (proposal.link.as_deref()).and_then(|link| crate::workspace::resolve("specs", link))
    else {
        return false;
    };
    match path.split('/').collect::<Vec<_>>().as_slice() {
        ["specs", folder, "proposal.md"] | ["specs", "changes", folder, "proposal.md"] => {
            crate::workspace::folder_slug(folder).is_some()
        }
        _ => false,
    }
}

/// Adds a link to `target`, a started feature's or change's proposal, on top of **Now**: after the
/// last started proposal of Now's first block, the proposals before its first blank line, numbered
/// after it, or else first, in the style of the first proposal. A blank line then parts it from the
/// proposals that are not started, and none is added when none follows.
pub fn add_started(text: &str, link_text: &str, target: &str) -> String {
    let result: Result<String, ()> = super::super::with_unix_newlines(text, |text| {
        let now: Vec<Proposal> = parse(text)
            .into_iter()
            .filter(|e| e.section == Section::Now)
            .collect();
        let link =
            |marker: &Marker| format!("{} [{}]({target})", marker.render(), escaped(link_text));
        let Some(first) = now.first() else {
            return Ok(insert(
                text,
                Section::Now,
                usize::MAX,
                &[link(&Marker::Bullet('-'))],
            ));
        };
        let block = 1 + now
            .windows(2)
            .take_while(|pair| pair[1].line == pair[0].item.end + 1)
            .count();
        let (at, item) = match now[..block].iter().rfind(|proposal| is_started(proposal)) {
            Some(last) => {
                let marker = match &last.item.marker {
                    Marker::Number(number) => Marker::Number(number + 1),
                    bullet => bullet.clone(),
                };
                (last.item.end, link(&marker))
            }
            None => (first.line - 1, link(&first.item.marker)),
        };
        let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
        // The next line starts a proposal that is not started, in the same block: a blank line
        // parts it.
        let parted = lines
            .get(at)
            .is_some_and(|next| lines::item_marker(next).is_some());
        let added = if parted {
            vec![item, String::new()]
        } else {
            vec![item]
        };
        let shift = added.len();
        lines.splice(at..at, added);
        // The numbered proposals after it count it in.
        for proposal in now.iter().filter(|proposal| proposal.line > at) {
            let line = &lines[proposal.line - 1 + shift];
            if let Some((Marker::Number(number), rest)) = lines::item_marker(line) {
                lines[proposal.line - 1 + shift] =
                    format!("{} {rest}", Marker::Number(number + 1).render());
            }
        }
        Ok(lines.join("\n"))
    });
    result.unwrap_or_else(|()| text.to_string())
}

fn find(text: &str, id: &str) -> Option<Proposal> {
    parse(text)
        .into_iter()
        .find(|proposal| proposal_id(proposal) == id)
}

/// Inserts `item`, lines of a proposal, in `section` before its proposal at `index`, or at its end.
fn insert(text: &str, section: Section, index: usize, item: &[String]) -> String {
    let proposals: Vec<Proposal> = parse(text)
        .into_iter()
        .filter(|e| e.section == section)
        .collect();
    let Some(before) = proposals.get(index) else {
        let heading = lines::headings(text)
            .find(|(_, line)| Section::from_heading(line) == Some(section))
            .map(|(number, _)| number);
        let last = proposals.last().map(|proposal| &proposal.item);
        let title = format!("## {}", section.title());
        return lines::append_to_section(text, last, heading, &title, item).0;
    };
    let mut lines: Vec<String> = text.split('\n').map(String::from).collect();
    let at = before.line - 1;
    lines.splice(at..at, item.iter().cloned());
    lines.join("\n")
}

/// Inserts the lines of a proposal, nested lines included, as written, before the proposal at
/// `index` of `section`, or at its end when `index` is past it. `None` when there is no line.
pub fn insert_proposal(
    text: &str,
    section: Section,
    index: usize,
    lines: &[String],
) -> Option<String> {
    if lines.is_empty() {
        return None;
    }
    super::super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, index, lines))
    })
    .ok()
}

/// Adds a line at the end of a section. `None` when the line is empty.
pub fn add(text: &str, section: Section, line: &str) -> Option<String> {
    let line = lines::one_line(line);
    if line.is_empty() {
        return None;
    }
    super::super::with_unix_newlines(text, |text| {
        Ok::<_, ()>(insert(text, section, usize::MAX, &[format!("- {line}")]))
    })
    .ok()
}

/// Moves a proposal, its nested lines included, before the proposal at `index` of `section`, or to
/// its end.
pub fn move_proposal(text: &str, id: &str, section: Section, index: usize) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = find(text, id).ok_or(())?;
        let item: Vec<String> = text.split('\n').collect::<Vec<_>>()
            [proposal.item.line - 1..proposal.item.end]
            .iter()
            .map(|l| l.to_string())
            .collect();
        let without = lines::remove(text, &proposal.item);
        // A proposal moved within its section counts its old place out.
        Ok::<_, ()>(insert(&without, section, index, &item))
    })
    .ok()
}

/// Replaces a proposal's text with `line`, its marker and nested lines kept.
pub fn edit(text: &str, id: &str, line: &str) -> Option<String> {
    let line = lines::one_line(line);
    if line.is_empty() {
        return None;
    }
    super::super::with_unix_newlines(text, |text| {
        let proposal = find(text, id).ok_or(())?;
        let item = format!("{} {line}", proposal.item.marker.render());
        Ok::<_, ()>(lines::replace(text, &proposal.item, &[item]))
    })
    .ok()
}

/// Removes the proposal of `section` whose lines, nested ones included, are exactly `lines`: the
/// one there is, or among several, the one whose key is `key`. `None` when there is none, or
/// several and none has that key: a proposal of the same text the human wrote is never taken for
/// it.
pub fn remove_written(
    text: &str,
    section: Section,
    lines: &[String],
    key: Option<&str>,
) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let all: Vec<&str> = text.split('\n').collect();
        let proposals = parse(text);
        let keys = keys(&proposals);
        let same: Vec<(&Proposal, &String)> = proposals
            .iter()
            .zip(&keys)
            .filter(|(proposal, _)| {
                proposal.section == section
                    && all[proposal.item.line - 1..proposal.item.end]
                        .iter()
                        .copied()
                        .eq(lines.iter().map(String::as_str))
            })
            .collect();
        let found = match same.as_slice() {
            [(one, _)] => *one,
            _ => same
                .iter()
                .find(|(_, found)| key == Some(found.as_str()))
                .map(|(proposal, _)| *proposal)
                .ok_or(())?,
        };
        Ok::<_, ()>(lines::remove(text, &found.item))
    })
    .ok()
}

/// Removes the proposal an add wrote: the last of its section whose lines, nested ones included,
/// are exactly `lines`, returned with the text without it. `None` unless exactly one section ends
/// with it.
pub fn remove_added(text: &str, lines: &[String]) -> Option<(String, Proposal)> {
    let mut removed = None;
    let without = super::super::with_unix_newlines(text, |text| {
        let all: Vec<&str> = text.split('\n').collect();
        let proposals = parse(text);
        let last: Vec<&Proposal> = proposals
            .iter()
            .enumerate()
            .filter(|(at, proposal)| {
                proposals
                    .get(at + 1)
                    .is_none_or(|next| next.section != proposal.section)
                    && all[proposal.item.line - 1..proposal.item.end]
                        .iter()
                        .copied()
                        .eq(lines.iter().map(String::as_str))
            })
            .map(|(_, proposal)| proposal)
            .collect();
        let [one] = last.as_slice() else {
            return Err(());
        };
        removed = Some((*one).clone());
        Ok::<_, ()>(lines::remove(text, &one.item))
    })
    .ok()?;
    Some((without, removed?))
}

/// Removes a proposal, with its nested lines.
pub fn remove(text: &str, id: &str) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = find(text, id).ok_or(())?;
        Ok::<_, ()>(lines::remove(text, &proposal.item))
    })
    .ok()
}

/// Removes the first proposal whose link leads to `path`, from the top level, with its nested
/// lines: the text without it, and the proposal's text. `None` when no proposal links it.
pub fn remove_linked(text: &str, path: &str) -> Option<(String, String)> {
    let mut name = None;
    let without = super::super::with_unix_newlines(text, |text| {
        let proposal = parse(text)
            .into_iter()
            .find(|proposal| {
                (proposal.link.as_deref()).and_then(|link| crate::workspace::resolve("specs", link))
                    == Some(path.to_string())
            })
            .ok_or(())?;
        name = Some(proposal.text.clone());
        Ok::<_, ()>(lines::remove(text, &proposal.item))
    })
    .ok()?;
    Some((without, name?))
}

/// Puts `lines`, a proposal's lines as written, back in place of the first proposal whose link
/// leads to `path`, from the top level: the Undo of [`link`]. `None` when no proposal links it, or
/// when the proposal has nested lines since, which would go with it.
pub fn unlink(text: &str, path: &str, lines: &[String]) -> Option<String> {
    super::super::with_unix_newlines(text, |text| {
        let proposal = parse(text)
            .into_iter()
            .find(|proposal| {
                (proposal.link.as_deref()).and_then(|link| crate::workspace::resolve("specs", link))
                    == Some(path.to_string())
            })
            .filter(|proposal| proposal.item.text_end == proposal.item.end)
            .ok_or(())?;
        Ok::<_, ()>(lines::replace(text, &proposal.item, lines))
    })
    .ok()
}
