//! Uraeda's app on Native Shell: the native module the app's TSX imports as `uraeda/native`, the
//! app's native components, and the Linux host.

mod about;
mod native;

use nsh_core::prelude::*;

/// What the app's TSX may import from `uraeda/native`: `native.rs` lists it. Native Shell finds
/// this function at the crate's root, and reads the module's name in this file.
#[native_module("uraeda/native")]
fn uraeda_native(registry: &mut Registry) {
    native::register(registry);
}
