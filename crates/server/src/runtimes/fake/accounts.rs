//! The fake's accounts: the ones a test scripts in [`Behaviour::accounts`](super::Behaviour),
//! as its last refresh read them, as a runtime's are: a change a test makes is seen at the
//! next ask, which announces it. Each refresh is counted.

use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;

use super::Inner;
use crate::live::locked;
use crate::runtimes::{Account, Accounts};

/// The accounts of a fake, as its behaviour lists them now.
pub(super) struct Scripted(pub(super) Arc<Inner>);

impl Accounts for Scripted {
    fn list(&self) -> Vec<Account> {
        let asked = locked(&self.0.asked).clone();
        asked.unwrap_or_else(|| locked(&self.0.behaviour).accounts.clone())
    }

    fn name_of(&self, id: &str) -> String {
        let behaviour = locked(&self.0.behaviour);
        let mut listed = behaviour.accounts.iter();
        let found = listed.find(|account| account.id == id);
        found.map_or_else(|| id.to_owned(), |account| account.name.clone())
    }

    fn problems(&self) -> Vec<String> {
        locked(&self.0.behaviour).account_problems.clone()
    }

    fn refresh(&self, _max_age: Duration) {
        self.0.account_asks.fetch_add(1, Ordering::SeqCst);
        let read = locked(&self.0.behaviour).accounts.clone();
        *locked(&self.0.asked) = Some(read);
    }
}
