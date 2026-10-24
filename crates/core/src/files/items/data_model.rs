//! A data model's sections and tables: the entities a feature adds or changes, each a `##`
//! section, its tables' rows marked by their column headed "Change".

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::files::document::{Block, BlockKind, Document, plain};

/// What a data model's row does: its "Change" cell, "New", "Changed", or "Removed".
#[cfg_attr(feature = "napi", napi(string_enum = "kebab-case"))]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RowChangeKind {
    New,
    Changed,
    Removed,
}

impl RowChangeKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            RowChangeKind::New => "new",
            RowChangeKind::Changed => "changed",
            RowChangeKind::Removed => "removed",
        }
    }

    /// The change a cell's text names, trimmed.
    fn of(text: &str) -> Option<RowChangeKind> {
        match text.trim() {
            "New" => Some(RowChangeKind::New),
            "Changed" => Some(RowChangeKind::Changed),
            "Removed" => Some(RowChangeKind::Removed),
            _ => None,
        }
    }
}

/// A row of a data model's table, and its change.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RowChange {
    /// The row's block.
    pub row: u32,
    pub kind: RowChangeKind,
}

/// A table of a data model, and the rows its "Change" column marks.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataTable {
    /// The table's block.
    pub block: u32,
    /// The index of its column headed "Change", from 0, the one whose cells show a row's change;
    /// none without one.
    pub column: Option<u32>,
    /// Its marked rows, in order; none without a column headed "Change".
    pub changes: Vec<RowChange>,
}

/// A `##` section of a data model: an entity.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSection {
    /// Its heading's text.
    pub title: String,
    /// Its heading's anchor.
    pub anchor: String,
    /// Its heading's block.
    pub heading: u32,
    /// Its top-level blocks, deeper headings included, up to the next `##`.
    pub blocks: Vec<u32>,
    /// The tables among its blocks.
    pub tables: Vec<DataTable>,
}

/// A data model's items.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataModelItems {
    /// The top-level blocks before the first `##`, its `#` title aside.
    pub intro: Vec<u32>,
    pub sections: Vec<DataSection>,
}

/// The sections and tables of a data model.
pub(crate) fn data_model(doc: &Document) -> DataModelItems {
    let mut intro = Vec::new();
    let mut sections: Vec<DataSection> = Vec::new();
    for block in doc.blocks.iter().filter(|b| b.parent.is_none()) {
        let level = (block.kind == BlockKind::Heading).then(|| block.level.unwrap_or(1));
        match (level, sections.last_mut()) {
            (Some(1), _) => {}
            (Some(2), _) => sections.push(DataSection {
                title: plain(&block.spans).trim().to_string(),
                anchor: block.anchor.clone().unwrap_or_default(),
                heading: block.id,
                blocks: Vec::new(),
                tables: Vec::new(),
            }),
            (_, Some(section)) => {
                section.blocks.push(block.id);
                if block.kind == BlockKind::Table {
                    section.tables.push(table(doc, block));
                }
            }
            (_, None) => intro.push(block.id),
        }
    }
    DataModelItems { intro, sections }
}

/// A table and the changes of its rows, from its column headed "Change".
fn table(doc: &Document, table: &Block) -> DataTable {
    let rows: Vec<&Block> = doc.children(table.id).collect();
    let column = rows
        .first()
        .filter(|row| row.header == Some(true))
        .and_then(|header| {
            doc.children(header.id)
                .position(|cell| plain(&cell.spans).trim() == "Change")
        });
    let changes = column.map_or_else(Vec::new, |column| {
        rows.iter()
            .skip(1)
            .filter_map(|row| {
                let cell = doc.children(row.id).nth(column)?;
                Some(RowChange {
                    row: row.id,
                    kind: RowChangeKind::of(&plain(&cell.spans))?,
                })
            })
            .collect()
    });
    DataTable {
        block: table.id,
        column: column.map(|column| column as u32),
        changes,
    }
}
