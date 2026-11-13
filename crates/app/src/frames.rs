//! The server's binary frames, read before the store parses them: a message whose large part,
//! a record's first value, came compressed (the protocol's contract, "Frames"). Here and not in
//! TSX: Native Shell's JavaScript is interpreted, and its `zlib` would link brotli and zstd into
//! the browser's first load. The inflate is the protocol crate's, the server's own reader.

use nsh_core::prelude::*;

/// A binary frame, read.
#[derive(Clone, Debug, Default, PartialEq, JsObject)]
pub(crate) struct Unpacked {
    /// The message's JSON text, its large part inflated, when the frame could be read.
    pub text: Option<String>,
    /// The id the frame's head names, when it could not be: its subscription or call fails.
    pub id: Option<f64>,
    /// Why it could not be read, for a person.
    pub problem: Option<String>,
}

/// The server's binary frames.
#[module]
pub(crate) struct Frames;

#[module(flat)]
impl Frames {
    /// Reads a binary frame of the server: the JSON text of its message, or why it cannot be read,
    /// with the id its head names. It inflates no more than the frame declares, and never more
    /// than 16 MiB.
    pub(crate) fn unpack_frame(frame: Vec<u8>) -> Unpacked {
        match uraeda_protocol::unpack(&frame) {
            Ok(text) => Unpacked {
                text: Some(text),
                ..Unpacked::default()
            },
            Err(refused) => Unpacked {
                text: None,
                id: refused.id.map(f64::from),
                problem: Some(refused.why),
            },
        }
    }
}
