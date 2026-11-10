//! Why a handler gives no value, as the client is told: one of the protocol's codes, and a message
//! for a person.

use uraeda_core::actions::ActionError;
use uraeda_core::actions::place::PlaceError;
use uraeda_core::api::ApiError;
use uraeda_core::git::GitError;
use uraeda_core::repositories::ListError;
use uraeda_protocol::{ErrorCode, ServerMessage};

/// What a record's read or an action's run fails with: the `error` its client gets.
///
/// The core's errors convert with `?`, and keep the core's own code: `refused`, `conflict` for a
/// change made elsewhere, and `hook`, whose message is the hook's output. Anything else is a
/// handler's own: [`Fault::refused`] for what the server will not do, as things are, and
/// [`Fault::internal`] for a failure of the server, which is also logged.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Fault {
    code: ErrorCode,
    message: String,
}

impl Fault {
    /// A fault of any code.
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Fault {
        Fault {
            code,
            message: message.into(),
        }
    }

    /// The server will not do it, as things are: the message says why.
    pub fn refused(message: impl Into<String>) -> Fault {
        Fault::new(ErrorCode::Refused, message)
    }

    /// What the client acted on changed since it read it.
    pub fn conflict(message: impl Into<String>) -> Fault {
        Fault::new(ErrorCode::Conflict, message)
    }

    /// The server failed: the message is logged, and sent.
    pub fn internal(message: impl Into<String>) -> Fault {
        Fault::new(ErrorCode::Internal, message)
    }

    /// Its code.
    pub fn code(&self) -> ErrorCode {
        self.code
    }

    /// Its message.
    pub fn message(&self) -> &str {
        &self.message
    }

    /// The `error` that answers the `sub`, the `call`, or the `resume` of this id.
    pub(super) fn answer(self, id: u32) -> ServerMessage {
        ServerMessage::Error {
            id: Some(id),
            code: self.code,
            message: self.message,
        }
    }
}

impl From<ApiError> for Fault {
    /// The core's refusal, under its own code. A hook's message is its whole output.
    fn from(error: ApiError) -> Fault {
        let code = match error.code {
            "conflict" => ErrorCode::Conflict,
            "hook" => ErrorCode::Hook,
            _ => ErrorCode::Refused,
        };
        let output = error.output.filter(|output| !output.is_empty());
        Fault::new(code, output.unwrap_or(error.message))
    }
}

/// The core's errors that are refusals: each converts as the core's `ApiError` reads it.
macro_rules! refusals {
    ($($error:ty),*) => {
        $(impl From<$error> for Fault {
            fn from(error: $error) -> Fault {
                ApiError::from(error).into()
            }
        })*
    };
}

refusals!(ActionError, GitError, ListError, PlaceError);
