//! The record `Agent`: the runtimes sessions run on, each on or off as a repository has it.

use uraeda_protocol::{Agent, AgentArgs, AgentRefreshModels, RuntimeRecord, UsageWindow};

use crate::live::{Bus, Call, Fault, Registry};
use crate::runner::Runner;
use crate::runtimes::Runtimes;
use crate::shared::Shared;

/// Registers the record `Agent`, and the action that asks the runtimes for their models.
pub(super) fn register(registry: &Registry) {
    registry.record::<Agent>(read);
    registry.action::<AgentRefreshModels>(refresh);
}

/// Says the runtimes changed, for every repository.
pub(super) fn changed(shared: &Shared) {
    shared.get::<Bus>().changed_all::<Agent>();
}

/// The value of the record `Agent`: every registered runtime, the one a new session of the
/// repository runs on first, then in the order they first registered.
fn read(shared: &Shared, args: AgentArgs) -> Result<Agent, Fault> {
    let runtimes = shared.get::<Runtimes>();
    let runner = Runner::find(shared);
    // Each read asks the accounts' stale usage, at most once a minute per account: an answer
    // that changed one says so again.
    if let Some(runner) = &runner {
        runner.refresh_all_accounts();
    }
    let records = runtimes
        .ordered(args.repo.as_deref())
        .into_iter()
        .filter_map(|id| {
            let runtime = runtimes.get(&id)?;
            let status = runtimes.status(&id);
            let usage = runner.as_ref().map(|runner| runner.usage(&id));
            let window = |window: crate::runner::UsageWindow| UsageWindow {
                id: window.id,
                label: window.label,
                resets_at: window.resets_at,
                used: window.used,
            };
            Some(RuntimeRecord {
                name: runtime.name(),
                title: runtimes.title(&id),
                icon: runtime.icon(),
                available: status.available,
                version: status.version,
                is_on: runtimes.is_on(&id, args.repo.as_deref()),
                capabilities: runtime.capabilities(),
                models: runtimes.models(&id),
                usage: usage.unwrap_or_default().into_iter().map(window).collect(),
                accounts: runner
                    .as_ref()
                    .map(|runner| runner.account_records(&id))
                    .unwrap_or_default(),
                id,
            })
        });
    Ok(Agent {
        runtimes: records.collect(),
    })
}

/// The action `agent.refreshModels`: asks each runtime for its model list again, at most once
/// a minute, without waiting for it. The lists that changed reach the record.
#[expect(clippy::unnecessary_wraps, reason = "an action's shape")]
fn refresh(call: &Call, (): ()) -> Result<(), Fault> {
    let runtimes = call.shared().get::<Runtimes>();
    let bus = call.bus().clone();
    tokio::task::spawn_blocking(move || {
        let names = runtimes.names();
        let names: Vec<&str> = names.iter().map(String::as_str).collect();
        runtimes.refresh_models(&names);
        bus.changed_all::<Agent>();
    });
    Ok(())
}
