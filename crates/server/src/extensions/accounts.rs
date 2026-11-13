//! The accounts of a runtime in an extension's VM, `accounts` of its `Runtime`: each method a
//! call into the VM, within 10 seconds. One that throws or does not answer reads as no
//! account, no problem, or a refresh done.

use std::time::{Duration, SystemTime};

use serde::Deserialize;
use serde_json::json;

use super::runtime::asked;
use super::vm::{CALL, Vm};
use crate::runtimes::{Account, AccountState, AccountWindow, Accounts};

/// The accounts of a VM's runtime.
pub(super) struct VmAccounts(pub(super) Vm);

/// An account as `uraeda/server` types it: `askedAt` in milliseconds since 1970.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Listed {
    id: String,
    name: String,
    state: AccountState,
    windows: Vec<AccountWindow>,
    asked_at: Option<f64>,
    known: bool,
}

impl From<Listed> for Account {
    fn from(listed: Listed) -> Account {
        let millis = |at: f64| Duration::from_millis(at.max(0.0) as u64);
        Account {
            id: listed.id,
            name: listed.name,
            state: listed.state,
            windows: listed.windows,
            asked_at: listed
                .asked_at
                .map(|at| SystemTime::UNIX_EPOCH + millis(at)),
            known: listed.known,
        }
    }
}

impl Accounts for VmAccounts {
    fn list(&self) -> Vec<Account> {
        let listed: Result<Vec<Listed>, String> = asked(&self.0, "accounts.list", json!({}), CALL);
        listed
            .unwrap_or_default()
            .into_iter()
            .map(Account::from)
            .collect()
    }

    fn name_of(&self, id: &str) -> String {
        let named = asked(&self.0, "accounts.nameOf", json!({ "account": id }), CALL);
        named.unwrap_or_else(|_| id.to_owned())
    }

    fn problems(&self) -> Vec<String> {
        asked(&self.0, "accounts.problems", json!({}), CALL).unwrap_or_default()
    }

    fn refresh(&self, max_age: Duration) {
        let with = json!({ "maxAgeMs": max_age.as_millis() as u64 });
        let _: Result<serde_json::Value, String> = asked(&self.0, "accounts.refresh", with, CALL);
    }
}
