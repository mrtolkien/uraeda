//! The server API's other side: each operation the prelude of an extension's VM asks of the
//! server, by name. `api/prelude.js` builds what an extension sees over them, and
//! `api/server.d.ts` declares it.
//!
//! | The extension calls                          | Operations                                 |
//! | -------------------------------------------- | ------------------------------------------ |
//! | `api.log`, `console.log`                     | `log`                                      |
//! | `api.on`                                     | `listen`                                   |
//! | `api.record(..).changed`                     | `changed`                                  |
//! | `api.settings`, `api.repositories`           | `settings`, `repositories`                 |
//! | `api.runtime`, and its processes' events     | `runtime`, `emit`, `emit.end`              |
//! | `fetch`                                      | `fetch`                                    |
//! | `uraeda:fs`                                  | `fs.<name>`                                |
//! | `uraeda:process`                             | `process.spawn`, `.write`, `.end`, `.kill` |
//!
//! A record, an action, a route, and an event's handler are kept in the VM: the server calls
//! them by name, and the prelude answers for one that is not there.
//!
//! Everything a VM starts through here is its host's, and released with it: its processes, its
//! runtime, and its processes' streams.

use std::path::PathBuf;

use serde_json::{Value, json};
use uraeda_protocol::ExtensionRecord;

use super::process::Processes;
use super::runtime::Slot;
use super::vm::{Host, Vm};
use super::{fetch, fs};
use crate::live::Bus;
use crate::records::repositories;
use crate::shared::Shared;

/// What one extension's VM reaches of the server.
pub(super) struct ServerHost {
    shared: Shared,
    processes: Processes,
    runtime: Slot,
}

impl ServerHost {
    /// The host of the extension whose folder is `folder`.
    pub(super) fn new(shared: &Shared, folder: PathBuf) -> ServerHost {
        ServerHost {
            shared: shared.clone(),
            processes: Processes::new(shared, folder),
            runtime: Slot::new(shared),
        }
    }

    /// Says a record of the extension changed, in one repository or in every one.
    fn changed(&self, vm: &Vm, payload: &Value) {
        let (record, repository) = (payload["record"].as_str(), payload["repository"].as_str());
        self.shared
            .get::<Bus>()
            .changed_where::<ExtensionRecord>(|args| {
                args.extension == vm.name()
                    && Some(args.name.as_str()) == record
                    && repository.is_none_or(|repository| args.repo == repository)
            });
    }

    /// The repositories the extension is on in, each by its name and its main checkout.
    fn repositories(&self, vm: &Vm) -> Value {
        let listed = repositories::all(&self.shared).into_iter();
        let on =
            listed.filter(|repository| super::is_on(&self.shared, vm.name(), &repository.name));
        on.map(|repository| json!({ "name": repository.name, "path": repository.path }))
            .collect()
    }
}

impl Host for ServerHost {
    fn op(&mut self, vm: &Vm, op: &str, payload: Value) -> Result<Value, String> {
        match op {
            "log" => {
                let message = payload["message"].as_str().unwrap_or_default();
                say!("{}: {message}", vm.name());
            }
            "listen" => {
                vm.listen(payload["event"].as_str().unwrap_or_default());
            }
            "changed" => self.changed(vm, &payload),
            "settings" => {
                let repository = payload["repository"].as_str();
                return Ok(super::settings(&self.shared, vm.name(), repository));
            }
            "repositories" => return Ok(self.repositories(vm)),
            "runtime" => return self.runtime.register(vm, payload),
            "emit" => return self.runtime.emit(payload),
            "emit.end" => self.runtime.end(&payload),
            "fetch" => return fetch::start(vm, payload),
            _ => {
                return match op.split_once('.') {
                    Some(("fs", op)) => fs::op(op, &payload),
                    Some(("process", op)) => self.processes.op(vm, op, payload),
                    _ => Err(format!("the server has no operation `{op}`")),
                };
            }
        }
        Ok(Value::Null)
    }

    fn release(&mut self) {
        self.processes.release();
        self.runtime.release();
    }
}
