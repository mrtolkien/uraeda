//! The paired devices, as the owner reads and changes them: the value of the record `Devices`,
//! and what the actions `devices.revoke` and `devices.rename` do, served by the live engine.

use uraeda_protocol::{Device, Devices, DevicesRename, DevicesRevoke, ErrorCode};

use crate::live::{Bus, Fault, Registry};
use crate::shared::Shared;
use crate::sign_in::store::Kind;
use crate::sign_in::{date, state, store};

/// The longest name a device has, in characters.
const NAME: usize = 80;

/// Registers the record `Devices` and its two actions with the live engine, and says on the bus
/// each time the list changes, whatever changed it: an action, a pairing, a sign-out, the sweep.
pub(super) fn register(shared: &Shared) {
    let registry = shared.get::<Registry>();
    registry.record::<Devices>(|shared, ()| Ok(list(shared)));
    registry.action::<DevicesRevoke>(|call, input| revoke(call.shared(), &input));
    registry.action::<DevicesRename>(|call, input| rename(call.shared(), &input));
    let bus = shared.get::<Bus>();
    on_change(shared, move || bus.changed::<Devices>(&()));
}

/// The value of the record `Devices`: every paired device, the oldest pairing first.
pub fn list(shared: &Shared) -> Devices {
    let devices = state(shared).store.devices().into_iter();
    let devices = devices.map(|device| Device {
        id: device.id,
        name: device.name.unwrap_or_default(),
        created: date::text(device.created),
        used: date::text(device.used),
    });
    Devices {
        devices: devices.collect(),
    }
}

/// The action `devices.revoke`: the device's token signs in nowhere any more, and its open
/// connections close.
///
/// # Errors
///
/// `refused` for an id no device has, and `internal` when the sign-in file cannot be written:
/// the device is revoked for this run of the server all the same.
pub fn revoke(shared: &Shared, input: &DevicesRevoke) -> Result<(), Fault> {
    let store = &state(shared).store;
    match store.end(Kind::Device, &input.id).map_err(internal)? {
        true => Ok(()),
        false => Err(unknown(&input.id)),
    }
}

/// The action `devices.rename`: gives a device another name.
///
/// # Errors
///
/// `bad-input` for a name without a letter, `refused` for an id no device has, and `internal`
/// when the sign-in file cannot be written.
pub fn rename(shared: &Shared, input: &DevicesRename) -> Result<(), Fault> {
    let nameless = || {
        Fault::new(
            ErrorCode::BadInput,
            "a device's name holds a letter at least",
        )
    };
    let name = named(&input.name).ok_or_else(nameless)?;
    let store = &state(shared).store;
    match store.rename(&input.id, &name).map_err(internal)? {
        true => Ok(()),
        false => Err(unknown(&input.id)),
    }
}

/// Calls `listener` each time the record `Devices` changes: a device paired, renamed, revoked,
/// ended, or used for the first time in a day. The record's subscribers are told so already.
pub fn on_change(shared: &Shared, listener: impl Fn() + Send + Sync + 'static) {
    state(shared).store.listeners.on_devices(listener);
}

/// A device's name as given, without the blanks around it, cut at 80 characters: nothing when
/// nothing is left.
pub(crate) fn named(name: &str) -> Option<String> {
    let name: String = name.trim().chars().take(NAME).collect();
    (!name.is_empty()).then_some(name)
}

/// The fault of an id no device has.
fn unknown(id: &str) -> Fault {
    Fault::refused(format!("no device is paired as `{id}`"))
}

/// The fault of a sign-in file that could not be written.
fn internal(problem: store::Problem) -> Fault {
    Fault::internal(problem.to_string())
}
