//! Uraeda's app on Native Shell: the native module the app's TSX imports as `uraeda/native`, the
//! app's native components, the Linux host, and the Mac app's way to its server.

mod about;
mod apart;
pub mod diagram;
mod editing;
#[cfg(all(target_os = "linux", feature = "host"))]
mod extension_view;
#[cfg(all(target_os = "linux", feature = "host"))]
pub use extension_view::share_app_assets;
mod fonts;
mod frames;
mod highlight;
#[cfg(all(target_os = "linux", feature = "host"))]
pub mod host;
mod local;
mod native;
pub mod notify;
mod page_trust;
mod page_watch;
#[cfg(all(any(target_os = "linux", target_os = "macos"), feature = "host"))]
mod pairing;
mod patch;
mod reply;
#[cfg(all(any(target_os = "linux", target_os = "macos"), feature = "host"))]
pub mod server_start;
pub mod theme;
mod time;
mod vim_bridge;

use nsh_core::prelude::*;

/// The app's id: its GTK application and window, `app/nsh.json`'s `id`, and the name of its
/// desktop entry and icons in `app/package/`, so a desktop groups its windows under its entry.
pub const APP_ID: &str = "dev.uraeda.app";

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
