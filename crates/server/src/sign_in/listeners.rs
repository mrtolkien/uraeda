//! Who hears of a change of the sign-in store: what ends with a session, and what shows the
//! devices.

use std::sync::{Mutex, PoisonError};

use crate::sign_in::store::Kind;

/// What a change of the store did: whether the file is to write, the ids of the sessions and the
/// devices that ended, and whether the list of devices changed.
#[derive(Default)]
pub(crate) struct Change {
    pub(crate) write: bool,
    pub(crate) ended: Vec<String>,
    pub(crate) devices: bool,
}

impl Change {
    /// A change to write, of a session or of a device.
    pub(crate) fn written(kind: Kind) -> Change {
        Change {
            write: true,
            ended: Vec::new(),
            devices: kind == Kind::Device,
        }
    }

    /// Adds another change to this one.
    pub(crate) fn merge(&mut self, other: Change) {
        self.write |= other.write;
        self.devices |= other.devices;
        self.ended.extend(other.ended);
    }
}

type Ended = Box<dyn Fn(&str) + Send + Sync>;
type Devices = Box<dyn Fn() + Send + Sync>;

/// The listeners of the store, told once the store let go of what it holds: a listener may ask
/// the store.
#[derive(Default)]
pub(crate) struct Listeners {
    ended: Mutex<Vec<Ended>>,
    devices: Mutex<Vec<Devices>>,
}

impl Listeners {
    /// Calls `listener` with the id of every session and device that ends, once each.
    pub(crate) fn on_ended(&self, listener: impl Fn(&str) + Send + Sync + 'static) {
        let mut ended = self.ended.lock().unwrap_or_else(PoisonError::into_inner);
        ended.push(Box::new(listener));
    }

    /// Calls `listener` each time the list of devices changes: one paired, renamed, revoked, or
    /// used for the first time in a day.
    pub(crate) fn on_devices(&self, listener: impl Fn() + Send + Sync + 'static) {
        let mut devices = self.devices.lock().unwrap_or_else(PoisonError::into_inner);
        devices.push(Box::new(listener));
    }

    /// Tells the listeners of a change.
    pub(crate) fn tell(&self, change: &Change) {
        let ended = self.ended.lock().unwrap_or_else(PoisonError::into_inner);
        for id in &change.ended {
            ended.iter().for_each(|listener| listener(id));
        }
        drop(ended);
        if change.devices {
            let devices = self.devices.lock().unwrap_or_else(PoisonError::into_inner);
            devices.iter().for_each(|listener| listener());
        }
    }
}
