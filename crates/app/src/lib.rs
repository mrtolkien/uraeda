//! Uraeda's app on Native Shell: the native module the app's TSX imports as `uraeda/native`, the
//! app's native components, and the Linux host.

use nsh_core::prelude::*;

/// What the app's TSX may import from `uraeda/native`: nothing yet.
#[native_module("uraeda/native")]
fn native(_registry: &mut Registry) {}
