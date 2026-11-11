//! An agent runtime that lives in an extension's VM: `api.runtime(..)` registers it under the
//! extension's name, and the sessions reach it as any other [`Runtime`].
//!
//! Each of its methods is a call into the VM, answered within 10 seconds, 5 for its version. A
//! process's methods tell the VM and wait for nothing, and its events come back through the
//! VM's host, one at a time. When the VM ends, the runtime leaves the registry and every stream
//! still open ends with an `exit` that has no code, as the contract says of a runtime gone
//! silent.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use super::accounts::VmAccounts;
use super::vm::{CALL, CallError, Vm};
use crate::live::locked;
use crate::runner::{Denial, Event};
use crate::runtimes::{
    self, Accounts, AgentProcess, Capabilities, Emitter, Events, ModelList, Options, Outgoing,
    Registered, ReviewAsk, ReviewMessage, Runtime, RuntimeError, Signal,
};
use crate::shared::Shared;

/// How long a runtime has to say its version, as the contract bounds it.
const VERSION: Duration = Duration::from_secs(5);

/// The streams of a VM's open processes, by the id each was opened with.
type Emitters = Arc<Mutex<HashMap<u64, Emitter>>>;

/// What a runtime says of itself as it registers.
#[derive(Clone, Deserialize)]
struct Described {
    name: String,
    kind: String,
    icon: String,
    capabilities: Capabilities,
    /// Whether it lists models.
    models: bool,
    /// Whether it has a review of its own.
    review: bool,
    /// Whether it lists accounts.
    #[serde(default)]
    accounts: bool,
}

/// The runtime one VM registered, if any, and its processes' streams.
pub(super) struct Slot {
    shared: Shared,
    registered: Option<Registered>,
    emitters: Emitters,
}

impl Slot {
    pub(super) fn new(shared: &Shared) -> Slot {
        Slot {
            shared: shared.clone(),
            registered: None,
            emitters: Emitters::default(),
        }
    }

    /// Registers the VM's runtime under its extension's name.
    pub(super) fn register(&mut self, vm: &Vm, payload: Value) -> Result<Value, String> {
        let described: Described = serde_json::from_value(payload)
            .map_err(|error| format!("{}: the runtime's description: {error}", vm.name()))?;
        let runtime = Arc::new(VmRuntime {
            vm: vm.clone(),
            described,
            emitters: self.emitters.clone(),
        });
        let registered = runtimes::register(&self.shared, vm.name(), runtime);
        self.registered = Some(registered.map_err(|error| error.to_string())?);
        Ok(Value::Null)
    }

    /// Writes an event of a process on its stream: its `exit` ends the stream.
    pub(super) fn emit(&self, payload: Value) -> Result<Value, String> {
        let process = payload["process"].as_u64().unwrap_or_default();
        let event: Event = serde_json::from_value(payload["event"].clone())
            .map_err(|error| format!("this is no event of an agent: {error}"))?;
        // The runner's own events are no agent's to send.
        let runners = matches!(
            event,
            Event::Message { .. } | Event::Denial { .. } | Event::Allowed { .. } | Event::Skipped
        );
        if runners {
            return Err("this is no event of an agent".to_owned());
        }
        let last = matches!(event, Event::Exit { .. });
        let mut emitters = locked(&self.emitters);
        if let Some(emitter) = emitters.get(&process) {
            emitter.send(event);
        }
        if last {
            emitters.remove(&process);
        }
        Ok(Value::Null)
    }

    /// A process's events are over: a stream that got no `exit` ends with one that has no code.
    pub(super) fn end(&self, payload: &Value) {
        let process = payload["process"].as_u64().unwrap_or_default();
        locked(&self.emitters).remove(&process);
    }

    /// The VM is gone: its runtime leaves the registry, and its processes' streams end.
    pub(super) fn release(&mut self) {
        if let Some(registered) = self.registered.take() {
            registered.remove();
        }
        locked(&self.emitters).clear();
    }
}

/// A runtime in a VM, as the sessions hold it.
struct VmRuntime {
    vm: Vm,
    described: Described,
    emitters: Emitters,
}

impl VmRuntime {
    /// Asks the VM's runtime, and reads its answer.
    fn ask<T: DeserializeOwned>(
        &self,
        what: &str,
        with: Value,
        limit: Duration,
    ) -> Result<T, String> {
        asked(&self.vm, what, with, limit)
    }
}

/// Asks a VM's runtime `runtime.<what>`, and reads its answer.
pub(super) fn asked<T: DeserializeOwned>(
    vm: &Vm,
    what: &str,
    with: Value,
    limit: Duration,
) -> Result<T, String> {
    let mut payload = with;
    payload["what"] = json!(format!("runtime.{what}"));
    let answer = vm.call(payload, limit).map_err(|error| words(&error))?;
    serde_json::from_value(answer).map_err(|error| format!("{what}: {error}"))
}

/// Why a call into a VM gave nothing, for a person.
pub(super) fn words(error: &CallError) -> String {
    match error {
        CallError::Threw(message) => message.clone(),
        CallError::NoAnswer => format!("no answer in {} s", CALL.as_secs()),
        CallError::Unloaded => "the extension was unloaded".to_owned(),
    }
}

impl Runtime for VmRuntime {
    fn name(&self) -> String {
        self.described.name.clone()
    }

    fn kind(&self) -> String {
        self.described.kind.clone()
    }

    fn icon(&self) -> String {
        self.described.icon.clone()
    }

    fn capabilities(&self) -> Capabilities {
        self.described.capabilities
    }

    fn open(&self, options: Options) -> Box<dyn AgentProcess> {
        let id = self.vm.next_id();
        let (emitter, events) = runtimes::events();
        locked(&self.emitters).insert(id, emitter.clone());
        let opened: Result<Opened, String> =
            self.ask("open", json!({ "process": id, "options": options }), CALL);
        let set_effort = match opened {
            Ok(opened) => opened.set_effort,
            Err(why) => {
                // A process that cannot run says so as its exit.
                locked(&self.emitters).remove(&id);
                emitter.send(Event::Exit {
                    code: None,
                    missing: None,
                    stderr: why,
                });
                false
            }
        };
        Box::new(VmProcess {
            vm: self.vm.clone(),
            id,
            events: Some(events),
            set_effort,
        })
    }

    fn has_session(&self, native_id: &str, account: Option<&str>) -> bool {
        let with = json!({ "nativeId": native_id, "account": account });
        self.ask("hasSession", with, CALL).unwrap_or(false)
    }

    fn accounts(&self) -> Option<Arc<dyn Accounts>> {
        let accounts = VmAccounts(self.vm.clone());
        self.described
            .accounts
            .then(|| Arc::new(accounts) as Arc<dyn Accounts>)
    }

    fn allow_rule(&self, denial: &Denial) -> Option<String> {
        let asked = self.ask("allowRule", json!({ "denial": denial }), CALL);
        asked.ok().flatten()
    }

    fn version(&self) -> Option<String> {
        self.ask("version", json!({}), VERSION).ok().flatten()
    }

    fn models(&self) -> Result<Option<ModelList>, RuntimeError> {
        if !self.described.models {
            return Ok(None);
        }
        let asked = self.ask("models", json!({}), CALL);
        asked.map(Some).map_err(RuntimeError::Failed)
    }

    fn review_message(&self, ask: &ReviewAsk) -> Option<ReviewMessage> {
        if !self.described.review {
            return None;
        }
        let asked = self.ask("reviewMessage", json!({ "ask": ask }), CALL);
        asked.ok().flatten()
    }
}

/// What `open` answers: whether the process changes its effort itself.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Opened {
    set_effort: bool,
}

/// A process a VM's runtime opened.
struct VmProcess {
    vm: Vm,
    id: u64,
    events: Option<Events>,
    set_effort: bool,
}

impl VmProcess {
    /// Tells the VM's process, without waiting.
    fn tell(&self, tell: &str, with: Value) {
        let mut payload = with;
        payload["what"] = json!("process.tell");
        payload["process"] = json!(self.id);
        payload["tell"] = json!(tell);
        self.vm.tell(payload);
    }
}

impl AgentProcess for VmProcess {
    fn events(&mut self) -> Events {
        self.events.take().unwrap_or_else(Events::ended)
    }

    fn send(&self, message: Outgoing) {
        self.tell("send", json!({ "message": message }));
    }

    fn interrupt(&self) {
        self.tell("interrupt", json!({}));
    }

    fn kill(&self, signal: Signal) {
        self.tell("kill", json!({ "signal": signal.name() }));
    }

    fn take_back(&self, id: &str) {
        self.tell("takeBack", json!({ "message": id }));
    }

    fn set_effort(&self, effort: Option<&str>) -> bool {
        if self.set_effort {
            self.tell("setEffort", json!({ "effort": effort }));
        }
        self.set_effort
    }

    fn close(&self) {
        self.tell("close", json!({}));
    }
}
