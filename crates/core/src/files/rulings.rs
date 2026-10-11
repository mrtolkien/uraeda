//! The rulings of a feature, `## R1: ...`.

use super::document::Document;
use super::items::{Ruling, headings, section};

pub fn items(doc: &Document) -> Vec<Ruling> {
    headings(doc)
        .into_iter()
        .filter(|(_, level, _)| *level == 2)
        .filter_map(|(index, _, text)| {
            let (id, title) = text.split_once(':')?;
            let number = id.strip_prefix('R')?;
            (!number.is_empty() && number.bytes().all(|b| b.is_ascii_digit())).then(|| Ruling {
                id: id.to_string(),
                title: title.trim().to_string(),
                heading_block: doc.blocks[index].id,
                blocks: section(doc, index, 2),
            })
        })
        .collect()
}
