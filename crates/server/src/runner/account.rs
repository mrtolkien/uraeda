//! The accounts a session runs on: the pick as its first turn starts, each account's usage from
//! its asks and its processes' reports, the ask shared by the pick and the pages, and the
//! records the UI reads.

use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use uraeda_protocol::{AccountRecord, Extensions};

use super::event::UsageWindow;
use super::live::Timer;
use super::manager::Runner;
use super::picks;
use super::session::Session;
use crate::live::{Bus, Fault, locked};
use crate::runtimes::accounts::{
    self, Account, Accounts, PICK_WAIT, Report, USAGE_MAX_AGE, instant,
};

/// The refusal of a new session's turn on a runtime that lists accounts, none signed in.
pub(crate) fn no_account(runtime: &str) -> String {
    format!(
        "No {runtime} account is signed in: sign one in, or empty Accounts in Settings, \
         Extensions"
    )
}

/// An ask of a runtime's accounts under way, which others wait for rather than asking again.
#[derive(Default)]
struct Asking {
    done: Mutex<bool>,
    told: Condvar,
}

/// What the runner keeps of the accounts: the latest report of each window of each account,
/// kept after its process closed until a newer ask makes it moot, the asks under way, and the
/// timer of the next reset.
#[derive(Default)]
pub(super) struct Kept {
    /// By the runtime's name, the account, and the window's id.
    reports: Mutex<HashMap<(String, String, String), Report>>,
    asking: Mutex<HashMap<String, Arc<Asking>>>,
    reset: Mutex<Option<Timer>>,
}

impl Runner {
    fn kept(&self) -> Arc<Kept> {
        self.shared.get::<Kept>()
    }

    /// Keeps a report of a window of an account, as that account's latest.
    pub(super) fn account_report(&self, runtime: &str, account: &str, window: UsageWindow) {
        let key = (runtime.to_owned(), account.to_owned(), window.id.clone());
        let report = Report {
            account: account.to_owned(),
            at: self.now(),
            window,
        };
        locked(&self.kept().reports).insert(key, report);
        self.announce_accounts();
    }

    /// The reports of a runtime's accounts that are not moot: one older than its account's ask,
    /// or of an account no longer listed, is dropped.
    fn reports(&self, runtime: &str, listed: &[Account]) -> Vec<Report> {
        let kept = self.kept();
        let mut reports = locked(&kept.reports);
        reports.retain(|(of, account, _), report| {
            let known = listed.iter().find(|known| known.id == *account);
            let fresh = known.is_some_and(|known| known.asked_at.is_none_or(|at| report.at > at));
            of != runtime || fresh
        });
        let own = reports.iter().filter(|((of, _, _), _)| of == runtime);
        own.map(|(_, report)| report.clone()).collect()
    }

    /// A runtime's accounts, each with its freshest usage: none for a runtime without them.
    pub(super) fn accounts_of(&self, runtime: &str) -> (Option<Arc<dyn Accounts>>, Vec<Account>) {
        let Some(accounts) = self
            .runtimes()
            .get(runtime)
            .and_then(|runtime| runtime.accounts())
        else {
            return (None, Vec::new());
        };
        let listed = accounts.list();
        let reports = self.reports(runtime, &listed);
        let merged = accounts::merged(listed, &reports, self.now());
        (Some(accounts), merged)
    }

    /// The runtime's accounts for the UI, `is_next` on the one a new session would start on.
    pub(crate) fn account_records(&self, runtime: &str) -> Vec<AccountRecord> {
        let (_, merged) = self.accounts_of(runtime);
        let next = accounts::pick(&merged).map(|account| account.id.clone());
        let record = |account: Account| AccountRecord {
            is_next: Some(&account.id) == next.as_ref(),
            id: account.id,
            name: account.name,
            state: account.state,
            windows: account.windows,
        };
        merged.into_iter().map(record).collect()
    }

    /// Asks the stale usage of a runtime's accounts, and waits for it at most `PICK_WAIT`: an
    /// ask under way is joined, not made again. Once answered, what it changed is announced:
    /// a refresh that changed nothing announces nothing, so a page that reads the agent's
    /// record on each announce does not loop.
    pub(crate) fn refresh_accounts(&self, runtime: &str) {
        let Some(accounts) = self
            .runtimes()
            .get(runtime)
            .and_then(|runtime| runtime.accounts())
        else {
            return;
        };
        let kept = self.kept();
        let (asking, asks) = {
            let mut under_way = locked(&kept.asking);
            match under_way.get(runtime) {
                Some(asking) => (asking.clone(), false),
                None => {
                    let asking = Arc::new(Asking::default());
                    under_way.insert(runtime.to_owned(), asking.clone());
                    (asking, true)
                }
            }
        };
        if asks {
            let (runner, name, told) = (self.clone(), runtime.to_owned(), asking.clone());
            self.spawn(move |_| {
                let before = (runner.account_records(&name), accounts.problems());
                accounts.refresh(USAGE_MAX_AGE);
                locked(&runner.kept().asking).remove(&name);
                *locked(&told.done) = true;
                told.told.notify_all();
                if (runner.account_records(&name), accounts.problems()) != before {
                    runner.announce_accounts();
                }
            });
        }
        let done = locked(&asking.done);
        let _ = asking
            .told
            .wait_timeout_while(done, PICK_WAIT, |done| !*done);
    }

    /// Asks every runtime's stale accounts, without waiting: with each check of the runtimes,
    /// at the start and every minute, and as the agent's record is read, at most once a minute
    /// per account.
    pub(crate) fn refresh_all_accounts(&self) {
        for name in self.runtimes().names() {
            self.spawn(move |runner| runner.refresh_accounts(&name));
        }
    }

    /// Says the accounts changed, to the agent's record and the extensions' problems, and arms
    /// the timer of the next reset of a window, which the records then read as open.
    pub(super) fn announce_accounts(&self) {
        self.agent_changed();
        self.shared.get::<Bus>().changed_all::<Extensions>();
        let now = self.now();
        let resets = self.runtimes().names().into_iter().flat_map(|name| {
            let records = self.account_records(&name).into_iter();
            records.flat_map(|record| record.windows.into_iter())
        });
        let next = resets.filter_map(|window| window.resets_at.as_deref().and_then(instant));
        let next = next.filter(|at| *at > now).min();
        let wait = next.and_then(|next| next.duration_since(now).ok());
        let timer = wait.filter(|_| !self.state().closed).map(|wait| {
            let wait = wait.max(Duration::from_millis(1));
            self.after(wait, Runner::announce_accounts)
        });
        *locked(&self.kept().reset) = timer;
    }

    /// The account a session's process opens on. A session keeps its account from its first
    /// started turn on, listed or not, and one that ran with none stays on the server's login.
    /// Until then each open picks again, on usage asked within `PICK_WAIT`, and stores the
    /// pick; a runtime that lists none clears a pick no turn started on.
    ///
    /// # Errors
    ///
    /// A refusal in the record's words when the runtime lists accounts and none is signed in.
    pub(super) fn account_for(&self, row: &Session) -> Result<Option<String>, Fault> {
        let store = self.store();
        let ran = store
            .turns(&row.id)?
            .iter()
            .any(|turn| turn.started_at.is_some());
        if ran {
            return Ok(row.account.clone());
        }
        let runtime = picks::session_runtime(self, row)?;
        let listed = runtime
            .accounts()
            .is_some_and(|accounts| !accounts.list().is_empty());
        let picked = match listed {
            false => None,
            true => {
                self.refresh_accounts(&row.agent);
                let (_, merged) = self.accounts_of(&row.agent);
                let picked = accounts::pick(&merged).map(|account| account.id.clone());
                Some(picked.ok_or_else(|| Fault::refused(no_account(&runtime.name())))?)
            }
        };
        if picked != row.account {
            store.edit_session(&row.id, |row| row.account.clone_from(&picked))?;
        }
        Ok(picked)
    }

    /// The name of a session's account, by its runtime, else the folder's last part: none for
    /// a session on no account.
    pub(crate) fn account_name(&self, row: &Session) -> Option<String> {
        let account = row.account.as_deref()?;
        let runtime = self.runtimes().get(&row.agent);
        let named = runtime.and_then(|runtime| Some(runtime.accounts()?.name_of(account)));
        let last = || {
            account
                .rsplit('/')
                .find(|part| !part.is_empty())
                .map(str::to_owned)
        };
        named.or_else(last)
    }
}
