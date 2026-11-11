//! Accounts, an optional part of the runtime contract: the logins of an agent a runtime offers,
//! each with its usage, and the rule a new session picks one by.
//!
//! - **A runtime owns what an account is**: Claude Code's are configuration folders. It lists
//!   them as last asked, names them, says their problems, and asks their usage again when it is
//!   stale: see [`Accounts`].
//! - **The runner owns the pick**, [`pick`], the move of a session a limit refused,
//!   [`pick_with_room`], and the merge of each account's asked usage with its running
//!   processes' reports, [`merged`].

use std::time::{Duration, SystemTime};

pub use uraeda_protocol::{AccountState, AccountWindow};

use crate::runner::UsageWindow;

/// How old an account's usage may be before it is asked again.
pub const USAGE_MAX_AGE: Duration = Duration::from_secs(60);

/// How long a pick waits for the usage it asks, before it picks on what is known.
pub const PICK_WAIT: Duration = Duration::from_secs(10);

/// An account a runtime offers.
#[derive(Clone, Debug, PartialEq)]
pub struct Account {
    /// What a session stores: for Claude Code, its folder as an absolute path.
    pub id: String,
    pub name: String,
    pub state: AccountState,
    /// Shortest first: Claude Code's five hours, then its week.
    pub windows: Vec<AccountWindow>,
    /// When its windows were last read: none while they never were. Kept after an ask that
    /// could not read them, as the windows are: the merge with a process's reports needs it.
    pub asked_at: Option<SystemTime>,
    /// Whether its usage is known: false while it was never read, and while its last ask could
    /// not read it. The pick ranks an account that is not known after every one that is.
    pub known: bool,
}

/// The accounts a runtime offers. Every method is called on a blocking thread, as a runtime's.
pub trait Accounts: Send + Sync {
    /// The accounts as last asked, in the listed order.
    fn list(&self) -> Vec<Account>;

    /// The name of the account `id`, listed or not.
    fn name_of(&self, id: &str) -> String;

    /// What needs the human, in the runtime's words: "account b is signed out, in ~/.claude-b".
    fn problems(&self) -> Vec<String>;

    /// Asks again each account whose last ask, answered or not, is older than `max_age`, and
    /// returns once they answered: the runtime keeps that time itself, and bounds its own wait.
    fn refresh(&self, max_age: Duration);
}

/// A running process's report of one window of its account, with when it came.
#[derive(Clone, Debug, PartialEq)]
pub struct Report {
    pub account: String,
    pub at: SystemTime,
    pub window: UsageWindow,
}

/// When an ISO 8601 time is: none for a text that is no time.
pub fn instant(time: &str) -> Option<SystemTime> {
    let at: jiff::Timestamp = time.parse().ok()?;
    Some(SystemTime::from(at))
}

/// The accounts with the freshest usage of each window their ask gave: the ask's, which counts
/// from `asked_at` even after a failed ask, or the latest report of a process that ran on the
/// account, at its `at`. A report only updates a window the ask gave, never adds one, so the
/// first window stays the shortest. An account is known when its ask's usage is, or when a
/// report of its first window is fresher. A window whose reset passed reads as unused.
pub fn merged(accounts: Vec<Account>, reports: &[Report], now: SystemTime) -> Vec<Account> {
    let merge = |mut account: Account| {
        let mut newer: Vec<&Report> = reports
            .iter()
            .filter(|report| {
                report.account == account.id && account.asked_at.is_none_or(|read| report.at > read)
            })
            .collect();
        newer.sort_by_key(|report| report.at);
        let first = account.windows.first().map(|window| window.id.clone());
        account.known |= newer
            .iter()
            .any(|report| Some(&report.window.id) == first.as_ref());
        for window in &mut account.windows {
            let latest = newer.iter().rfind(|report| report.window.id == window.id);
            if let Some(report) = latest {
                window.resets_at = Some(report.window.resets_at.clone());
                window.used = report.window.used;
            }
            let reset = window.resets_at.as_deref().and_then(instant);
            if reset.is_some_and(|reset| reset <= now) {
                window.resets_at = None;
                window.used = 0.0;
            }
        }
        account
    };
    accounts.into_iter().map(merge).collect()
}

/// The share used of an account's first, shortest window: an account with none is unused, and
/// a share that is no number ranks last.
fn short_used(account: &Account) -> f64 {
    let used = account.windows.first().map_or(0.0, |window| window.used);
    if used.is_nan() { f64::INFINITY } else { used }
}

/// When its first window resets: never for a window not open, so it ranks last.
fn short_reset(account: &Account) -> Option<SystemTime> {
    let window = account.windows.first()?;
    window.resets_at.as_deref().and_then(instant)
}

/// Signed in, and no window after the first used up: Claude Code's week.
fn eligible(account: &Account) -> bool {
    let mut longer = account.windows.iter().skip(1);
    account.state == AccountState::Ready && longer.all(|window| window.used < 1.0)
}

/// The account a new session starts on: among the signed-in accounts whose longer windows are
/// not used up, the one with the most of its first window left; on a tie, the one whose first
/// window resets first, a window not open last; then the first listed. An account whose usage
/// is not known ranks after every known one. When every signed-in account is used up, the
/// first signed-in one listed; with none signed in, none.
pub fn pick(accounts: &[Account]) -> Option<&Account> {
    let mut ranked: Vec<(usize, &Account)> = accounts
        .iter()
        .enumerate()
        .filter(|(_, account)| eligible(account))
        .collect();
    ranked.sort_by(|(a_at, a), (b_at, b)| {
        let reset = |account: &Account| short_reset(account).unwrap_or(SystemTime::UNIX_EPOCH);
        let opened = |account: &Account| short_reset(account).is_none();
        (!a.known)
            .cmp(&!b.known)
            .then(short_used(a).total_cmp(&short_used(b)))
            .then(opened(a).cmp(&opened(b)))
            .then(reset(a).cmp(&reset(b)))
            .then(a_at.cmp(b_at))
    });
    let first = ranked.first().map(|(_, account)| *account);
    first.or_else(|| {
        let mut ready = accounts.iter();
        ready.find(|account| account.state == AccountState::Ready)
    })
}

/// The account a session a limit refused moves to: the pick of those signed in, whose usage is
/// known, and with room in every window. None when none has room: the run then waits.
pub fn pick_with_room(accounts: &[Account]) -> Option<&Account> {
    let roomy = |account: &&Account| {
        let room = account.windows.iter().all(|window| window.used < 1.0);
        account.state == AccountState::Ready && account.known && room
    };
    let with_room: Vec<Account> = accounts.iter().filter(roomy).cloned().collect();
    let picked = pick(&with_room)?.id.clone();
    accounts.iter().find(|account| account.id == picked)
}

#[cfg(test)]
mod tests;
