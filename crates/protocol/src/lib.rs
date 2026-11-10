//! The protocol between Uraeda's server and its clients: the messages of the one WebSocket at
//! `/live`, the names of the records and actions, and the TypeScript types made from them.
//!
//! Its contract is `specs/2026-11-10-nsh-migration/contracts/protocol.md`.

mod change;
mod devices;
mod diff;
mod message;
mod registry;
mod typescript;

pub use change::{ApplyError, Op, Path, apply, get};
pub use devices::{Device, Devices, DevicesRename, DevicesRevoke};
pub use diff::diff;
pub use message::{ClientMessage, ErrorCode, PROTOCOL, Refusal, ServerMessage, SignIn, handshake};
pub use registry::{Action, Catalog, Record, Wire, catalog};
pub use typescript::typescript;
