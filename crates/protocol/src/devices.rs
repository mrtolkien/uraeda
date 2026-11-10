//! The paired devices: the record the owner reads them in, and the actions on one.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::registry::{Action, Record};

/// The devices paired with the server, each signing in with a token of its own.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Devices {
    /// The oldest pairing first.
    pub devices: Vec<Device>,
}

/// A paired device.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    /// What names the device: the part of its token before the dot, which is no secret.
    pub id: String,
    /// The name it gave as it paired, or the owner gave it since.
    pub name: String,
    /// When it paired, in RFC 3339, as `2026-11-10T09:00:00Z`.
    pub created: String,
    /// The day it last signed in, in RFC 3339: a use is recorded once a day at most.
    pub used: String,
}

impl Record for Devices {
    const NAME: &'static str = "Devices";
    type Args = ();
    type Value = Self;
}

/// Revokes a device: its token signs in nowhere any more, and its open connections close.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DevicesRevoke {
    /// The device's `id`.
    pub id: String,
}

impl Action for DevicesRevoke {
    const NAME: &'static str = "devices.revoke";
    type Input = Self;
    type Output = ();
}

/// Renames a device.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DevicesRename {
    /// The device's `id`.
    pub id: String,
    /// Its new name: the blanks around it go, and it holds a letter at least.
    pub name: String,
}

impl Action for DevicesRename {
    const NAME: &'static str = "devices.rename";
    type Input = Self;
    type Output = ();
}
