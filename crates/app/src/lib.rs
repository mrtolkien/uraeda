//! Uraeda's app on Native Shell: the native module the app's TSX imports as `uraeda/native`, the
//! app's native components, and the Linux host.

mod about;
pub mod diagram;
mod editing;
#[cfg(all(target_os = "linux", feature = "host"))]
mod extension_view;
#[cfg(all(target_os = "linux", feature = "host"))]
pub use extension_view::share_app_assets;
mod fonts;
mod highlight;
#[cfg(all(target_os = "linux", feature = "host"))]
pub mod host;
mod native;
pub mod notify;
mod patch;
mod reply;
#[cfg(all(target_os = "linux", feature = "host"))]
pub mod server_start;
pub mod theme;
mod time;
mod vim_bridge;

use nsh_core::prelude::*;

/// What the app's TSX may import from `uraeda/native`: `native.rs` lists it. Native Shell finds
/// this function at the crate's root, and reads the module's name in this file.
#[native_module("uraeda/native")]
fn uraeda_native(registry: &mut Registry) {
    native::register(registry);
}

/// The app's native components on Linux, which Native Shell's runner registers on every view:
/// `uraeda.extension`, an extension's page in a view of its own.
#[cfg(feature = "host")]
#[native_components(linux)]
fn components(components: &nsh_platform_linux::Components) {
    extension_view::register(components);
}
