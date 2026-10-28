//! Where a drag drops a line of the priorities or a note of the inbox, or one of their nested items.

/// Where a drag drops what it moves: under the item `under`, or with `under_at` under its nested
/// item at `under_at`; else into the list `list`, a section of the priorities or a category of the
/// inbox, none for the inbox's notes without a category. `index` is its place there, counted once
/// it left.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DropAt {
    pub list: Option<String>,
    pub under: Option<String>,
    pub under_at: Option<u32>,
    pub index: u32,
}
