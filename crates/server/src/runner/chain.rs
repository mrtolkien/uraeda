//! The step chain: each workflow step is a run of its own, which ends with its step, and Uraeda
//! starts the next step's run itself until the next human gate, as the run options decision
//! says. A chained run is no automatic continue: it counts nothing toward the cap, and a run
//! stopped never chains.

use std::path::Path;

use uraeda_core::api;
use uraeda_core::steps::StepName;

use super::manager::Runner;
use super::send::{Message, Run, check_send};
use super::status::CATCH_UP;
use crate::live::Fault;
use crate::records::features::recommend;

impl Runner {
    /// Sends the next step's message after a run of `step`, when the feature moved on to
    /// another run step that waits on the agent, and the session's run was not taken over
    /// since `taken`: in the session the next step's options give, through the way every
    /// workflow message takes. A feature at `catch-up` is left to the catcher: a catch-up
    /// runs by itself only once the human turned it on, and once per tip of the default
    /// branch.
    ///
    /// # Errors
    ///
    /// The refusal of a run that cannot be sent, which its turn shows as its last line.
    pub(super) fn chain_next(
        &self,
        session: &str,
        folder: &str,
        step: &str,
        taken: u64,
    ) -> Result<(), Fault> {
        let row = self.row(session)?;
        let root = Path::new(&row.repo);
        let next = api::next_step(root, folder)?;
        let ran = StepName::parse(step).and_then(|step| step.run_step());
        let moved_on = next
            .step
            .run_step
            .as_deref()
            .is_some_and(|to| Some(to) != ran);
        if next.step.waits_on != "agent" || next.step.name == CATCH_UP || !moved_on {
            return Ok(());
        }
        let feature = api::read_feature(root, folder)?;
        // The ended session's agent may not run the next step: the session it goes to checks
        // its own.
        let message = recommend(&feature, &next, None);
        let Some(step) = message.step else {
            return Err(Fault::refused(message.reason.unwrap_or_default()));
        };
        let run = Run {
            trigger: "next-step".to_owned(),
            step: Some(step),
            ..Run::default()
        };
        let input = Message {
            text: message.text,
            workflow: Some(run),
            ..Message::default()
        };
        let checked = check_send(input, false)?;
        self.serial(&row, || {
            // The human's Stop, or any takeover of the session's run, while it read, drops
            // the send.
            if self.takeovers(session) != taken {
                return Ok(());
            }
            self.send_to(session, checked).map(|_| ())
        })
    }
}
