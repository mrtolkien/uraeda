//! Where a drag drops a line of the priorities or a note of the inbox, or one of their nested items.

use super::{Result, refused};

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

/// A drop's one place, once checked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Target<'a> {
    /// Under the item `item`, or with `at` under its nested item at `at`.
    Under {
        item: &'a str,
        at: Option<usize>,
        index: usize,
    },
    /// Into the list `list`, none for the inbox's notes without a category.
    List { list: Option<&'a str>, index: usize },
}

impl DropAt {
    /// The one place this drop names: refused when it names both an item and a list, an empty
    /// item or list, or a nested item without its item, so that no part of it is silently left
    /// out, and no empty heading written.
    pub(super) fn target(&self) -> Result<Target<'_>> {
        let index = self.index as usize;
        match (self.under.as_deref(), self.list.as_deref()) {
            (Some(_), Some(_)) => Err(refused(
                "a drop goes under an item or into a list, not both",
            )),
            (Some(item), None) if item.trim().is_empty() => {
                Err(refused("a drop under an item needs the item"))
            }
            (Some(item), None) => Ok(Target::Under {
                item,
                at: self.under_at.map(|at| at as usize),
                index,
            }),
            (None, _) if self.under_at.is_some() => {
                Err(refused("a drop under a nested item needs its item"))
            }
            (None, Some(list)) if list.trim().is_empty() => {
                Err(refused("a drop into a list needs the list"))
            }
            (None, list) => Ok(Target::List { list, index }),
        }
    }
}
