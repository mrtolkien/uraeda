//! Claude Code's accounts: each one a configuration folder of the `accounts` setting, which
//! reaches Claude Code only as `CLAUDE_CONFIG_DIR`. Nothing of a folder is opened here: Claude
//! Code reads its own, and Uraeda never reads or writes a credential.

use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use crate::live::{locked, wait};
use crate::runtimes::{Account, AccountState, AccountWindow, Accounts};

/// What one ask of a folder gives: its state, and its windows when its usage was read.
#[derive(Clone, Debug, PartialEq)]
pub(super) struct Asked {
    pub state: AccountState,
    pub windows: Option<Vec<AccountWindow>>,
}

/// The ask of a folder, by its path: an error when it could not say.
pub(super) type Ask = Arc<dyn Fn(&str) -> Result<Asked, String> + Send + Sync>;

/// The server's clock.
pub(super) type Now = Arc<dyn Fn() -> SystemTime + Send + Sync>;

/// The environment that puts a process in a folder: none for Claude Code's default folder,
/// `<home>/.claude`. With the variable set, Claude Code reads `.claude.json` inside the folder,
/// not `~/.claude.json`, so the default folder given by name would lose the user's MCP servers
/// and project trust.
pub(super) fn folder_env(folder: &str, home: &Path) -> Vec<(String, String)> {
    match Path::new(folder) == home.join(".claude") {
        true => Vec::new(),
        false => vec![("CLAUDE_CONFIG_DIR".to_owned(), folder.to_owned())],
    }
}

/// One listed folder: its id, absolute; the line as listed; its name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Folder {
    pub id: String,
    pub listed: String,
    pub name: String,
}

/// A folder's name by the rule: its last segment, without its dot and its `claude-`;
/// `default` for `.claude`.
fn name_by_rule(id: &str) -> String {
    let segment = Path::new(id).file_name().map(|name| name.to_string_lossy());
    let segment = segment.unwrap_or_default();
    let segment = segment.strip_prefix('.').unwrap_or(&segment);
    if segment == "claude" {
        return "default".to_owned();
    }
    let name = segment.strip_prefix("claude-").unwrap_or(segment);
    if name.is_empty() {
        id.to_owned()
    } else {
        name.to_owned()
    }
}

/// A path without its `.` parts, its doubled and trailing slashes.
fn normal(path: &Path) -> String {
    let parts = path.components().filter(|part| *part != Component::CurDir);
    let path: PathBuf = parts.collect();
    path.to_string_lossy().into_owned()
}

/// The folders of the setting's lines: `~/`, or `~` alone, is `home`; a line that is then no
/// absolute path is left out with its problem, and so is a folder already listed. A second
/// folder of a name already taken reads its path.
pub(super) fn folders(lines: &[String], home: &Path) -> (Vec<Folder>, Vec<String>) {
    let (mut folders, mut problems) = (Vec::<Folder>::new(), Vec::new());
    for line in lines.iter().map(|line| line.trim()) {
        if line.is_empty() {
            continue;
        }
        let expanded = match line {
            "~" => home.to_owned(),
            _ => match line.strip_prefix("~/") {
                Some(rest) => home.join(rest),
                None => PathBuf::from(line),
            },
        };
        if !expanded.is_absolute() {
            problems.push(format!("account folder {line} is not an absolute path"));
            continue;
        }
        let id = normal(&expanded);
        if folders.iter().any(|folder| folder.id == id) {
            continue;
        }
        let name = name_by_rule(&id);
        let taken = folders.iter().any(|folder| folder.name == name);
        let name = if taken { id.clone() } else { name };
        let listed = line.to_owned();
        folders.push(Folder { id, listed, name });
    }
    (folders, problems)
}

/// What is kept of a folder: its account as last asked, and when it was last asked, whose lock
/// is held while it is asked, so a second refresh waits for that ask rather than asking again.
struct Entry {
    folder: Folder,
    account: Mutex<Account>,
    tried: Mutex<Option<SystemTime>>,
}

/// Claude Code's accounts, the folders of the setting's lines, each as last asked. An account
/// never asked is `ready`, its usage unknown, unless its folder is no directory: `missing`,
/// checked as the accounts are built and at each refresh, by a look at the folder alone.
pub(super) struct ClaudeAccounts {
    lines: Vec<String>,
    problems: Vec<String>,
    entries: Vec<Arc<Entry>>,
    ask: Ask,
    now: Now,
}

impl ClaudeAccounts {
    /// The accounts of the lines, keeping what `before` knew of a folder still listed.
    pub(super) fn new(
        lines: Vec<String>,
        home: &Path,
        ask: Ask,
        now: Now,
        before: Option<&Self>,
    ) -> Self {
        let (listed, problems) = folders(&lines, home);
        let kept = |folder: &Folder| {
            let before = before?
                .entries
                .iter()
                .find(|entry| entry.folder.id == folder.id)?;
            let mut account = locked(&before.account).clone();
            account.name.clone_from(&folder.name);
            Some((account, *locked(&before.tried)))
        };
        let entries = listed.into_iter().map(|folder| {
            let (account, tried) = kept(&folder).unwrap_or_else(|| (fresh(&folder), None));
            let entry = Entry {
                folder,
                account: Mutex::new(account),
                tried: Mutex::new(tried),
            };
            check(&entry);
            Arc::new(entry)
        });
        let entries = entries.collect();
        ClaudeAccounts {
            lines,
            problems,
            entries,
            ask,
            now,
        }
    }

    /// The setting's lines it was built from.
    pub(super) fn lines(&self) -> &[String] {
        &self.lines
    }

    /// Asks a folder when it is a directory and its last ask, answered or not, is older than
    /// `max_age`; else waits for the ask under way, if any.
    fn refresh_one(&self, entry: &Entry, max_age: Duration) {
        let mut tried = locked(&entry.tried);
        let now = (self.now)();
        let fresh = tried.is_some_and(|at| now.duration_since(at).unwrap_or_default() < max_age);
        if locked(&entry.account).state == AccountState::Missing || fresh {
            return;
        }
        *tried = Some(now);
        let asked = (self.ask)(&entry.folder.id);
        let mut account = locked(&entry.account);
        match asked {
            // A usage that was not read keeps the windows last read, and is unknown again.
            Ok(Asked {
                state,
                windows: None,
            }) => {
                account.state = state;
                account.known = false;
            }
            Ok(Asked {
                state,
                windows: Some(windows),
            }) => {
                account.state = state;
                account.windows = windows;
                account.asked_at = Some((self.now)());
                account.known = true;
            }
            Err(_) => account.known = false,
        }
        drop(account);
        // A folder that went while it was asked is missing still.
        check(entry);
    }
}

/// A folder's account before its first ask.
fn fresh(folder: &Folder) -> Account {
    Account {
        id: folder.id.clone(),
        name: folder.name.clone(),
        state: AccountState::Ready,
        windows: Vec::new(),
        asked_at: None,
        known: false,
    }
}

/// Marks the account `missing` when its folder is no directory, and `ready` once it is again.
fn check(entry: &Entry) {
    let missing = !Path::new(&entry.folder.id).is_dir();
    let mut account = locked(&entry.account);
    if missing && account.state != AccountState::Missing {
        account.state = AccountState::Missing;
        account.known = false;
    } else if !missing && account.state == AccountState::Missing {
        account.state = AccountState::Ready;
    }
}

impl Accounts for ClaudeAccounts {
    fn list(&self) -> Vec<Account> {
        let entries = self.entries.iter();
        entries
            .map(|entry| locked(&entry.account).clone())
            .collect()
    }

    fn name_of(&self, id: &str) -> String {
        let mut entries = self.entries.iter();
        let found = entries.find(|entry| entry.folder.id == id);
        found.map_or_else(|| name_by_rule(id), |entry| entry.folder.name.clone())
    }

    fn problems(&self) -> Vec<String> {
        let of = |state: AccountState| {
            let entries = self.entries.iter();
            let listed = entries.map(|entry| (entry, locked(&entry.account).state));
            let listed = listed.filter(move |(_, now)| *now == state);
            listed.map(|(entry, _)| (entry.folder.name.clone(), entry.folder.listed.clone()))
        };
        let signed_out = of(AccountState::SignedOut)
            .map(|(name, listed)| format!("account {name} is signed out, in {listed}"));
        let missing = of(AccountState::Missing)
            .map(|(name, listed)| format!("account {name} has no folder at {listed}"));
        let own = self.problems.iter().cloned();
        own.chain(signed_out).chain(missing).collect()
    }

    /// The folders first, so a pick that stops waiting knows which are gone; then every stale
    /// one is asked at once, each on a blocking thread of its own.
    fn refresh(&self, max_age: Duration) {
        self.entries.iter().for_each(|entry| check(entry));
        let asks = self.entries.iter().map(|entry| {
            let entry = entry.clone();
            let accounts = self.shared();
            tokio::task::spawn_blocking(move || accounts.refresh_one(&entry, max_age))
        });
        wait(futures_util::future::join_all(asks));
    }
}

impl ClaudeAccounts {
    /// A copy that shares its entries, for a blocking thread.
    fn shared(&self) -> ClaudeAccounts {
        ClaudeAccounts {
            lines: self.lines.clone(),
            problems: Vec::new(),
            entries: self.entries.clone(),
            ask: self.ask.clone(),
            now: self.now.clone(),
        }
    }
}

#[cfg(test)]
mod tests;
